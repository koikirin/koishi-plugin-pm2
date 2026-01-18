import { Context, deepEqual, h, isNullable, omit, Schema, Service } from 'koishi'
import EventEmitter from 'events'
import { resolve } from 'path'
import { Client, Events } from '@koishijs/plugin-console'
import API, { ProcessDescription } from 'pm2/lib/API'
import { LogUtils } from './api'
import { parsePlatform, serialized, throttle } from './utils'
import enUS from './locales/en-US.yml'

declare module '@koishijs/console' {
  interface Events {
    'pm2/list'(): Promise<PM2.Process[]>
    'pm2/action'(id: number | string, action: string): Promise<void>
    'pm2/trigger-action'(id: number | string, action: string): Promise<PM2.MonitorActionResult[]>
    'pm2/start-log'(id: number | string): Promise<string[]>
    'pm2/stop-log'(id: number | string): Promise<void>
    'pm2/add-alert'(alert: PM2.Alert): Promise<void>
    'pm2/edit-alert'(original: PM2.Alert, alert: PM2.Alert): Promise<void>
    'pm2/test-alert'(alert: PM2.Alert): Promise<void>
    'pm2/remove-alert'(alert: PM2.Alert): Promise<void>
    'pm2/clear-alerts'(name: string, events?: string[]): Promise<void>

    // Client side events
    'pm2/patch-log'(id: number | string, logs: string[]): void
  }

  interface Client {
    pm2?: {
      lastHeartbeat?: number
    }
  }
}

declare module 'koishi' {
  interface Context {
    pm2: PM2
  }

  interface Events {
    'pm2/process-event'(event: string, env: PM2.Env, manually: boolean): void
  }
}

class LogManager {
  private buffers: Record<number, string[]> = {}
  private listeners: Record<number, Set<string>> = {}
  private broadcasters: Record<number, () => void> = {}

  constructor(protected ctx: Context, protected pm2: PM2) { }

  async init() {
    const onLog = (packet: {
      data: string
      at: number
      process: {
        pm_id: number
        name: string
        rev?: string
        namespace: string
      }
    }, type: 'out' | 'err' | 'PM2') => {
      const id = packet.process.pm_id ?? 'PM2'
      if (!this.listeners[id]) return
      const data = packet.data.replace(/\n$/, '')
      this.buffers[id].push(LogUtils.format({
        app_name: packet.process.pm_id + '|' + packet.process.name,
        type,
        path: '',
      }, data))
      this.broadcasters[id]()
    }

    this.pm2.bus.on('log:out', (packet) => onLog(packet, 'out'))
    this.pm2.bus.on('log:err', (packet) => onLog(packet, 'err'))
    this.pm2.bus.on('log:PM2', (packet) => onLog(packet, 'PM2'))
  }

  pushEntry(entries: LogUtils.AppEntry[], entry: LogUtils.AppEntry) {
    if (entry.path.toLowerCase && entry.path.toLowerCase() !== '/dev/null') {
      if (entries.find(file => file.path === entry.path)) return
      entries.push(entry)
    }
  }

  async start(id: number | string, cid: string, exclusive?: 'out' | 'err'): Promise<string[]> {
    this.listeners[id] ||= new Set()
    if (!this.listeners[id].size) {
      this.buffers[id] = []
      this.broadcasters[id] = this.ctx.throttle(() => {
        if (!this.buffers[id].length) return
        const buffer = this.buffers[id].splice(0)
        const toRemoved: string[] = []
        Object.values(this.ctx.console.clients).filter(client => this.listeners[id].has(client.id)).forEach(client => {
          if (client.pm2?.lastHeartbeat && Date.now() - client.pm2.lastHeartbeat > this.pm2.config.listSyncTimeout) {
            toRemoved.push(client.id)
            return
          }
          client.send({
            type: 'pm2/patch-log',
            body: [id, buffer],
          })
        })
        toRemoved.forEach(cid => this.stopAll(cid))
      }, 200)
    }
    this.listeners[id].add(cid)

    if (this.pm2.config.logTailLines) {
      const entries: LogUtils.AppEntry[] = []

      if (id === 'PM2' || id === 'pm2') {
        this.pushEntry(entries, {
          path: this.pm2.api.pm2_home + '/pm2.log',
          app_name: 'PM2',
          type: 'PM2',
        })
      } else {
        const procs = await new Promise<ProcessDescription[]>((resolve, reject) => {
          this.pm2.api.describe(id, (err, desc) => {
            if (err) return reject(err)
            resolve(desc)
          })
        })

        for (const proc of procs) {
          if (proc.pm2_env && (id === 'all' || proc.pm2_env.name === id || proc.pm2_env.pm_id === id)) {
            if (proc.pm2_env.pm_out_log_path && exclusive !== 'err') {
              this.pushEntry(entries, {
                path: proc.pm2_env.pm_out_log_path,
                app_name: proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
                type: 'out',
              })
            }
            if (proc.pm2_env.pm_err_log_path && exclusive !== 'out') {
              this.pushEntry(entries, {
                path: proc.pm2_env.pm_err_log_path,
                app_name: proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
                type: 'err',
              })
            }
          }
        }
      }

      return await LogUtils.tail(entries, this.pm2.config.logTailLines, false)
    } else {
      return []
    }
  }

  stop(id: number | string, cid: string) {
    this.listeners[id]?.delete(cid)
    if (this.listeners[id]?.size === 0) {
      delete this.listeners[id]
      delete this.buffers[id]
      delete this.broadcasters[id]
    }
  }

  stopAll(cid: string) {
    for (const id in this.listeners) {
      this.stop(Number(id), cid)
    }
  }
}

export class PM2 extends Service {
  static name = 'pm2'

  api: API
  bus: EventEmitter | null = null
  logs: LogManager

  list: () => Promise<PM2.Process[]>
  trigger: (id: number | string, actionName: string) => Promise<PM2.MonitorActionResult[]>

  constructor(protected ctx: Context, public config: PM2.Config) {
    super(ctx, 'pm2')

    ctx.i18n.define('en-US', enUS)

    this.api = new API()
    this.logs = new LogManager(ctx, this)

    this.list = throttle(ctx, this._list.bind(this), 1000)
    this.trigger = serialized(ctx, this._trigger.bind(this))

    const that = this

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    ctx.on('ready', async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          this.api.connect((err) => {
            if (err) return reject(err)
            resolve()
          })
        })

        this.bus = await new Promise<any>((resolve, reject) => {
          this.api.launchBus((err, bus) => {
            if (err) return reject(err)
            resolve(bus)
          })
        })

        await that.logs.init()

        this.bus.on('process:event', (packet: {
          event: string
          manually: boolean
          process: PM2.Env
          at: number
        }) => {
          if (that.config.ignoreStoppingExit && packet.event === 'exit' && packet.process.status === 'stopping') return
          if (that.config.ignoreStoppedExit && packet.event === 'exit' && packet.process.status === 'stopped') return
          this.ctx.emit(packet, 'pm2/process-event', packet.event, packet.process, packet.manually)
        })

        ctx.logger.info('connected to pm2')
      } catch (err) {
        ctx.logger.warn('failed to connect to pm2:', err)
      }
    })

    ctx.on('dispose', () => this.api.close())

    ctx.on('pm2/process-event', async (event, env, manually) => {
      for (const alert of this.config.alerts) {
        if ((alert.name === env.name || alert.name === '*') && (alert.event['type'] ?? alert.event) === event) {
          if (event === 'exit' && typeof alert.event === 'object') {
            if (!isNullable(alert.event.eq) && env.exit_code !== alert.event.eq) continue
            if (!isNullable(alert.event.neq) && env.exit_code === alert.event.neq) continue
          }
          this.alert(alert, { ...env, event, manually }).catch(err => {
            ctx.logger.warn('failed to deliver pm2 alert:', err)
          })
        }
      }
    })

    const addListener = <K extends keyof Events>(event: K, callback: Events[K], options?: { authority?: number }) => {
      return ctx.console.addListener(event, callback, { authority: options?.authority ?? 4 })
    }

    addListener('pm2/list', async function (this: Client) {
      ;(this.pm2 ??= {}).lastHeartbeat = Date.now()
      return that.list().then(list => list.map((proc: PM2.Process) => {
        delete proc.pm2_env.env
        proc.alerts = (that.config.alerts || []).filter(alert => alert.name === proc.name || alert.name === '*')
        return proc
      }))
    })

    addListener('pm2/action', (id, action) => {
      return new Promise((resolve, reject) => {
        const target = ['restart', 'reload', 'stop', 'delete', 'reset']
        if (!target.includes(action)) return reject(new Error(`Unsupported action: ${action}`))
        that.api[action](id, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })

    addListener('pm2/trigger-action', (id, actionName) => this.trigger(id, actionName))

    addListener('pm2/start-log', async function (this: Client, id) {
      return that.logs.start(id, this.id)
    })

    addListener('pm2/stop-log', async function (this: Client, id) {
      return that.logs.stop(id, this.id)
    })

    addListener('pm2/add-alert', async (alert) => {
      that.config.alerts.push(alert)
      that.ctx.scope.update(that.config, false)
    })

    addListener('pm2/edit-alert', async (original, alert) => {
      const index = that.config.alerts.findIndex(item => deepEqual(omit(item, ['message']), omit(original, ['message'])))
      if (index === -1) return
      that.config.alerts[index] = alert
      that.ctx.scope.update(that.config, false)
    })

    addListener('pm2/test-alert', async (alert) => {
      const proc = await that.list().then(procs => procs.find(p => p.name === alert.name || alert.name === '*'))
      await that.alert(alert, { ...proc.pm2_env, event: alert.event['type'] ?? alert.event, manually: true })
    })

    addListener('pm2/remove-alert', async (alert) => {
      if (!alert?.name) return
      that.config.alerts = that.config.alerts.filter(item => !deepEqual(omit(item, ['message']), omit(alert, ['message'])))
      that.ctx.scope.update(that.config, false)
    })

    addListener('pm2/clear-alerts', async (name, events) => {
      if (!name) return
      that.config.alerts = that.config.alerts.filter(item => {
        if (item.name !== name) return true
        if (events && !events.includes(item.event['type'] ?? item.event)) return true
        return false
      })
      that.ctx.scope.update(that.config, false)
    })

    ctx.on('console/connection', (client: Client) => {
      if (!(client.id in ctx.console.clients)) {
        that.logs.stopAll(client.id)
      }
    })

    ctx.command('pm2', { authority: 4 })

    ctx.command('pm2.list')
      .action(async ({ session }) => {
        const list = await that.list()
        return session.text('.output', list)
      })

    for (const action of ['start', 'restart', 'reload', 'stop', 'delete'] as const) {
      ctx.command(`pm2.${action} <id>`)
        .action(async ({ session }, id) => {
          const procs = await new Promise<PM2.Process[]>((resolve, reject) => {
            that.api[action](id, (err, res) => {
              if (err) return reject(err)
              resolve(res)
            })
          })
          if (procs.length) {
            return session.text('.output', procs[0])
          } else {
            return session.text('.not-found', { id })
          }
        })
    }
  }

  async _list(): Promise<PM2.Process[]> {
    return await new Promise((resolve, reject) => {
      this.api.list((err, list) => {
        if (err) return reject(err)
        resolve(list)
      })
    })
  }

  async _trigger(id: number | string, actionName: string): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      let counter = 0, processCount = 0, timeout: () => void | null = null
      const results: any[] = []
      const listener = (ret) => {
        if (ret.process.name === id || ret.process.pm_id === id || ret.process.namespace === id || id === 'all') {
          results.push(ret)
          if (++counter === processCount) {
            this.bus.off('axm:reply', listener)
            timeout?.()
            resolve(results)
          }
        }
      }
      this.bus.on('axm:reply', listener)

      timeout = this.ctx.setTimeout(() => {
        this.bus.off('axm:reply', listener)
        reject(new Error(`PM2 action "${actionName}" timed out.`))
      }, this.config.actionTimeout)

      this.api.Client.executeRemote('msgProcess', {
        msg: actionName,
        ...(isNaN(id as any) ? { name: id } : { id }),
      }, function (err, data) {
        if (err) return reject(err)
        if (!data?.process_count) reject(new Error('No process received command.'))
        processCount = data.process_count
      })
    })
  }

  async alert(alert: PM2.Alert, env: PM2.Env & { event: string; manually: boolean }) {
    const [platform, channelId] = parsePlatform(alert.cid)
    const bot = this.ctx.bots[alert.sid] ?? this.ctx.bots.find(bot => bot.platform === platform)
    if (!bot) {
      this.ctx.logger.warn(`Cannot find bot for PM2 alert: ${alert.name}/${alert.event['type'] ?? alert.event} to ${alert.cid}`)
      return
    }
    if (alert.message) {
      return bot.sendMessage(channelId, h.parse(alert.message, env))
    } else {
      const locales = []
      if (this.ctx.get('database')) {
        locales.push(...await this.ctx.get('database').getChannel(platform, channelId, ['locales']).then(channel => channel?.locales ?? []))
      }
      const message = this.ctx.i18n.render(locales, [`pm2.alerts.${alert.event['type'] ?? alert.event}`], env)
      return bot.sendMessage(channelId, message)
    }
  }
}

export namespace PM2 {
  export const inject = {
    required: ['console'],
    optional: ['database', 'console.services.status'],
  }

  export interface Alert {
    name: string
    event: 'restart' | 'delete' | 'stop' | 'reload' | 'graceful reload' | 'start' | 'exit' | 'online' | 'restart overlimit' | {
      type: 'exit'
      eq?: number
      neq?: number
    }
    sid?: string
    cid: string
    message?: string
  }

  export interface Config {
    alerts: Alert[]
    logSyncInterval: number
    listSyncInterval: number
    listSyncTimeout: number
    actionTimeout: number
    logTailLines: number
    ignoreStoppingExit: boolean
    ignoreStoppedExit: boolean
  }

  export const Config: Schema<Config> = Schema.object({
    alerts: Schema.array(Schema.object({
      name: Schema.string().description('The name of the process. Use `*` to match all processes.'),
      event: Schema.union(['restart', 'delete', 'stop', 'reload', 'graceful reload', 'start', 'exit', 'online', 'restart overlimit', Schema.object({
        type: Schema.const('exit').default('exit').hidden(),
        eq: Schema.number().required(false),
        neq: Schema.number().required(false),
      }).description('exit(code)')]).description('The type of process:event.'),
      sid: Schema.string().description('platform:selfId').required(false),
      cid: Schema.string().description('platform:channelId'),
      message: Schema.string().description('The custom i18n message to send with the notification.').required(false),
    })).description('PM2 process event notifications.').default([]).hidden(),
    logSyncInterval: Schema.number().description('The interval (in milliseconds) to sync logs from PM2.').default(200),
    listSyncInterval: Schema.number().description('The interval (in milliseconds) to sync process list from PM2.').default(1000),
    listSyncTimeout: Schema.number().description('The timeout (in milliseconds) acts as heartbeat for clients requesting process list.').default(30000),
    actionTimeout: Schema.number().description('The timeout (in milliseconds) for PM2 monitor actions.').default(10000),
    logTailLines: Schema.number().description('The number of log lines to tail when starting log streaming.').default(100),
    ignoreStoppingExit: Schema.boolean().description('Disable exit alerts when a process is stopping.').default(true),
    ignoreStoppedExit: Schema.boolean().description('Disable exit alerts when a process has stopped.').default(false),
  })

  export interface Env {
    /** Process name */
    name: string
    /** Namespace */
    namespace?: string
    /** Process ID */
    pm_id: number
    /** Process status */
    status: string
    /** Restart time */
    restart_time: number
    /** Execution path */
    pm_exec_path?: string
    /** Cron restart pattern */
    cron_restart?: string
    /** Wait for ready signal */
    wait_ready?: boolean
    /** last uptime */
    pm_uptime?: number

    /** AXM monitor data */
    axm_monitor?: {
      [key: string]: {
        type: string
        value: number | string
        unit?: string
        historic?: boolean
        [key: string]: any
      }
    }

    /** AXM actions */
    axm_actions?: {
      [key: string]: {
        action_name: string
        action_type: string
        arity?: number
        [key: string]: any
      }
    }

    [key: string]: any
  }

  export interface Process {
    /** Process ID */
    pm_id: number
    /** Process name */
    name: string
    /** Process namespace */
    namespace?: string
    /** PM2 environment */
    pm2_env: Env & {
      /** Environment variables */
      env?: { [key: string]: any }
    }
    /** Process PID */
    pid?: number
    /** CPU usage */
    monit?: {
      cpu: number
      memory: number
    }

    alerts?: Alert[]
  }

  export interface MonitorActionResult {
    process: {
      name?: string
      pm_id?: number
      namespace?: string
    }
    data?: {
      return?: string | any
      action_name?: string
      at?: number
    }
    at: number
  }

}

export default PM2
