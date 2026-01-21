import { Context, Schema } from '@koishijs/client'
import './icons'
import Page from './components/dashboard.vue'

declare module '@koishijs/client' {
  interface Config {
    pm2?: {
      enableConfirm: ('restart' | 'reload' | 'stop' | 'delete')[]
      refreshInterval: number
    }
  }
}

export default (ctx: Context) => {
  ctx.page({
    name: 'PM2 Dashboard',
    path: '/pm2',
    icon: 'pm2:icon',
    component: Page,
    authority: 4,
  })

  ctx.menu('pm2', [{
    id: '.save',
    icon: 'save',
    label: 'Save Process List',
  }, {
    id: '.log',
    icon: 'pm2:logs',
    label: 'Daemon Logs',
  }])

  const schema = Schema.object({
    pm2: Schema.object({
      enableConfirm: Schema.array(Schema.union(['restart', 'reload', 'stop']))
        .description('Enable confirmation for process actions.')
        .default(['stop'])
        .role('checkbox'),
      refreshInterval: Schema.number()
        .description('The interval (in milliseconds) to refresh the process list.')
        .default(2000)
        .min(1000),
    }),
  })

  ctx.settings({
    id: 'pm2',
    title: 'PM2 Settings',
    schema,
  })
}
