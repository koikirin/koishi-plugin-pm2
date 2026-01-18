<template>
  <k-layout menu="pm2">
    <el-scrollbar class="process-scroll">
      <el-table :data="list" style="width: 100%" row-key="pm_id">
        <el-table-column type="expand">
          <template #default="{ row: process }">
            <div v-if="process.metrics?.length" class="expand-section">
              <h4 class="expand-title">Metrics</h4>
              <div class="metrics-container">
                <div v-for="metric in process.metrics" :key="metric.name" class="metric-card">
                  <div class="metric-name">{{ metric.name }}</div>
                  <div class="metric-value">
                    {{ metric.value }}
                    <span v-if="metric.unit" class="metric-unit">{{ metric.unit }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="process.actions?.length" class="expand-section">
              <h4 class="expand-title">Actions</h4>
              <div class="actions-container">
                <el-button v-for="action in process.actions" :key="action.name" size="small" class="action-chip" plain
                  @click="triggerCustomAction(process, action)">
                  <span class="action-name">{{ action.name }}</span>
                </el-button>
              </div>
            </div>

            <div class="expand-section">
              <div class="expand-header">
                <h4 class="expand-title">Alerts</h4>
                <div class="expand-actions">
                  <el-button size="small" type="primary" @click="showAddAlert(process)">Add Alert</el-button>
                  <el-popconfirm :title="`Clear all alerts?`" :description="`Target: ${process.name}`"
                    confirm-button-text="Confirm" cancel-button-text="Cancel" width="260"
                    @confirm="clearAlerts(process)">
                    <template #reference>
                      <el-button size="small" type="danger">Clear Alerts</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
              <el-table v-if="process.alerts?.length" :data="process.alerts" size="small" border class="alert-table">
                <el-table-column prop="event" label="Event" min-width="120">
                  <template #default="{ row: alert }">
                    <span>{{ alert.event['type'] ?? alert.event }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sid" label="From" min-width="160" />
                <el-table-column prop="cid" label="To" min-width="160" />
                <el-table-column label="Message" min-width="320">
                  <template #default="{ row: alert }">
                    <span v-if="alert.message" class="alert-message">{{ alert.message }}</span>
                    <span v-else class="alert-message placeholder">Default template</span>
                  </template>
                </el-table-column>
                <el-table-column label="Actions" min-width="150" align="center">
                  <template #default="{ row: alert }">
                    <div class="alert-row-actions">
                      <el-button size="small" text title="Send test alert" aria-label="Send test alert"
                        @click="testAlert(process, alert)">
                        &#128276;
                      </el-button>
                      <el-button size="small" text title="Edit alert" aria-label="Edit alert"
                        @click="showEditAlert(process, alert)">
                        &#9998;
                      </el-button>
                      <el-popconfirm :title="`Remove ${alert.event['type'] ?? alert.event} alert?`"
                        :description="alert.name === '*' ? 'Alert applies to all processes.' : `Target: ${alert.name ?? process.name}`"
                        confirm-button-text="Delete" cancel-button-text="Cancel" width="260"
                        @confirm="removeAlert(process, alert)">
                        <template #reference>
                          <el-button size="small" type="danger" text title="Delete alert" aria-label="Delete alert">
                            &#10006;
                          </el-button>
                        </template>
                      </el-popconfirm>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <p v-else class="section-empty">No alerts configured for this process.</p>
            </div>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="pm_id" label="ID" /> -->
        <el-table-column prop="name" label="Process" />
        <el-table-column prop="pm2_env.status" label="Status" min-width="120">
          <template #default="{ row: process }">
            <div class="status-cell">
              <el-tag :type="statusType(process.pm2_env.status)" :effect="mode">{{ process.pm2_env.status }}</el-tag>
              <div class="status-badges">
                <el-tooltip v-if="process.pm2_env.autorestart" content="Auto restart enabled" placement="top">
                  <span class="status-badge auto" aria-label="Auto restart enabled">&#8635;</span>
                </el-tooltip>
                <el-tooltip v-if="process.pm2_env.cron_restart && process.pm2_env.cron_restart != 0"
                  content="Cron restart configured" placement="top">
                  <span class="status-badge cron" aria-label="Cron restart configured">⏰︎</span>
                </el-tooltip>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="pm2_env.pm_uptime" label="Uptime">
          <template #default="{ row: process }">
            {{ process.pm2_env.status === 'online' ? formatUptime(process.pm2_env.pm_uptime) : 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="pm2_env.restart_time" label="Restarts" />
        <el-table-column prop="monit.cpu" label="CPU">
          <template #default="{ row: process }">
            {{ process.monit.cpu }}%
          </template>
        </el-table-column>
        <el-table-column prop="monit.memory" label="Memory">
          <template #default="{ row: process }">
            {{ formatMemory(process.monit.memory) }}
          </template>
        </el-table-column>
        <el-table-column label="Actions">
          <template #default="{ row: process }">
            <el-button-group>
              <el-button size="small" type="primary" title="Restart" aria-label="Restart"
                @click="performAction(process, 'restart')">&#8635;</el-button>
              <el-button size="small" type="success" title="Reload" aria-label="Reload"
                @click="performAction(process, 'reload')">&#8634;</el-button>
              <el-button size="small" type="danger" title="Stop" aria-label="Stop"
                @click="performAction(process, 'stop')">&#9632;</el-button>
              <!-- <el-button size="small" type="danger" title="Delete" aria-label="Delete"
                @click="performAction(process, 'delete')">&#10006;</el-button> -->
              <el-button size="small" type="info" title="Logs" aria-label="Logs"
                @click="showLogs(process)">&#9776;</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-scrollbar>


    <log-view v-model:visible="logsDialogVisible" :process="current" :logs="logsData" max-height="60vh" />

    <action-result v-model:visible="actionDialogVisible" :process="current" :action="actionCurrent"
      :results="actionData" :loading="actionDialogLoading" />

    <add-alert v-model:visible="alertDialogVisible" :process="current" :initial="editingAlert" @submit="submitAlert" />

  </k-layout>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { send, receive, useContext, useConfig, useColorMode } from '@koishijs/client'
import { PM2 } from 'koishi-plugin-pm2'
import LogView from './logs.vue'
import AddAlert from './alert.vue'
import ActionResult from './action.vue'
import { LogRecord } from '../utils'

export type MetricEntry = {
  name: string
  value: unknown
  unit?: string
}

export type ActionEntry = {
  name: string
  type?: string
  arity: number
}

export type ProcessRow = PM2.Process & {
  metrics?: MetricEntry[]
  actions?: ActionEntry[]
}

const ctx = useContext()
const config = useConfig()
const mode = useColorMode()

const list = ref<ProcessRow[]>([])
const current = ref<ProcessRow>()

const logsDialogVisible = ref(false)
const logsData = ref<LogRecord[]>([])
const actionDialogVisible = ref(false)
const actionDialogLoading = ref(false)
const actionCurrent = ref<ActionEntry>()
const actionData = ref<PM2.MonitorActionResult[]>([])
const alertDialogVisible = ref(false)
const editingAlert = ref<PM2.Alert | undefined>()

let timer: number

const hydrateProcess = (target: ProcessRow, source: PM2.Process) => {
  Object.assign(target, source)
  target.metrics = Object.entries(source.pm2_env?.axm_monitor || {}).map(([name, data]) => ({
    name,
    value: data.value,
    unit: data.unit || '',
  }))
  target.actions = Object.entries(source.pm2_env?.axm_actions || {}).filter(([key, data]) => data?.action_type === 'custom').map(([key, data]) => ({
    name: data.action_name,
    type: data.action_type,
    arity: data.arity || 0,
  }))
}

const refresh = async () => {
  const newList: PM2.Process[] = await send('pm2/list')
  if (!newList || !newList.length) return
  const newMap = new Map(newList.map(p => [p.pm_id, p]))
  const oldMap = new Map(list.value.map(p => [p.pm_id, p]))

  for (const proc of newList) {
    const oldProc = oldMap.get(proc.pm_id)
    if (oldProc) {
      hydrateProcess(oldProc, proc)
    } else {
      const enriched = { ...proc } as ProcessRow
      hydrateProcess(enriched, proc)
      list.value.push(enriched)
    }
  }

  for (let i = list.value.length - 1; i >= 0; i--) {
    const oldProc = list.value[i]
    if (!newMap.has(oldProc.pm_id)) {
      list.value.splice(i, 1)
    }
  }
}

onMounted(async () => {
  await refresh()
  timer = window.setInterval(refresh, config.value.pm2?.refreshInterval || 2000)
})

onUnmounted(() => {
  clearInterval(timer)
})

const statusType = (status: string) => {
  switch (status) {
    case 'online': return 'success'
    case 'stopping': return 'warning'
    case 'stopped': return 'info'
    case 'waiting restart': return 'warning'
    case 'launching': return 'info'
    case 'errored': return 'danger'
    default: return 'info'
  }
}

const formatUptime = (uptime: number) => {
  if (!uptime) return '-'
  const now = Date.now()
  const diff = now - uptime
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days) return `${days}d`
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24
  if (hours) return `${hours}h`
  const minutes = Math.floor(diff / (1000 * 60)) % 60
  if (minutes) return `${minutes}m`
  const seconds = Math.floor(diff / 1000) % 60
  return `${seconds}s`

}

const formatMemory = (memory: number) => {
  if (memory < 1024) return `${memory} B`
  if (memory < 1024 * 1024) return `${(memory / 1024).toFixed(2)} KB`
  return `${(memory / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const performAction = async (process: ProcessRow, action: 'restart' | 'reload' | 'stop' | 'delete') => {
  if (config.value.pm2?.enableConfirm?.includes(action) ?? true) {
    try {
      await ElMessageBox.confirm(
        `Are you sure you want to ${action} ${process.name}?`,
        'Confirm Action',
        {
          confirmButtonText: 'Confirm',
          cancelButtonText: 'Cancel',
          type: action === 'delete' ? 'warning' : 'info',
        },
      )
    } catch {
      return
    }
  }

  await send('pm2/action', process.pm_id, action)
  await refresh()
}

const triggerCustomAction = async (process: ProcessRow, action: ActionEntry) => {
  current.value = process
  actionCurrent.value = action
  actionDialogVisible.value = true
  actionDialogLoading.value = true
  try {
    const responses = await send('pm2/trigger-action', process.pm_id ?? process.name, action.name)
    actionData.value = responses || []
  } catch (err) {
    actionData.value = []
    console.error('Failed to trigger PM2 monitor action', process.pm_id, action.name, err)
    ElMessage.error(`Failed to trigger ${action.name}`)
  } finally {
    actionDialogLoading.value = false
  }
}

ctx.action('pm2.log', {
  action: () => showLogs()
})

const showLogs = async (process?: ProcessRow) => {
  if (process) {
    current.value = process
    logsData.value = await send('pm2/start-log', process.pm_id).then(data => data.map(item => ({ data: item })))
    logsDialogVisible.value = true
  } else {
    current.value = { name: 'PM2' } as any
    logsData.value = await send('pm2/start-log', 'PM2').then(data => data.map(item => ({ data: item })))
    logsDialogVisible.value = true
  }
}

receive('pm2/patch-log', (args) => {
  const [id, newLogs]: [number, string[]] = args
  logsData.value.push(...newLogs.map(item => ({ data: item })))
})

const showAddAlert = (process: ProcessRow) => {
  current.value = process
  editingAlert.value = undefined
  alertDialogVisible.value = true
}

const showEditAlert = (process: ProcessRow, alert: PM2.Alert) => {
  current.value = process
  editingAlert.value = alert
  alertDialogVisible.value = true
}

const submitAlert = async (alert: PM2.Alert) => {
  try {
    if (editingAlert.value) {
      await send('pm2/edit-alert', editingAlert.value, alert)
    } else {
      await send('pm2/add-alert', alert)
    }
    await refresh()
    ElMessage.success(editingAlert.value ? 'Alert updated successfully' : 'Alert added successfully')
  } catch (err) {
    console.error('Failed to save alert', err)
    ElMessage.error(editingAlert.value ? 'Failed to update alert' : 'Failed to add alert')
  } finally {
    editingAlert.value = undefined
  }
}

const removeAlert = (process: ProcessRow, alert: PM2.Alert) => {
  const alertName = alert.name ?? process.name
  const payload = { ...alert, name: alertName }
  send('pm2/remove-alert', payload).then(() => {
    ElMessage.success('Alert removed successfully')
    refresh()
  }).catch(err => {
    console.error('Failed to remove alert', err)
    ElMessage.error('Failed to remove alert')
  })
}

const testAlert = (_process: ProcessRow, alert: PM2.Alert) => {
  send('pm2/test-alert', alert).then(() => {
    ElMessage.success('Test alert sent')
  }).catch(err => {
    console.error('Failed to send test alert', err)
    ElMessage.error('Failed to send test alert')
  })
}

const clearAlerts = (process: ProcessRow) => {
  send('pm2/clear-alerts', process.name).then(() => {
    ElMessage.success('All alerts cleared successfully')
    refresh()
  }).catch(err => {
    console.error('Failed to clear alerts', err)
    ElMessage.error('Failed to clear alerts')
  })
}

watch(alertDialogVisible, (visible) => {
  if (!visible) editingAlert.value = undefined
})

</script>

<style scoped lang="scss">
.expand-section {
  padding: 10px 20px;
  border-top: var(--k-status-divider, var(--k-color-divider-dark)) 1px solid;
}

.expand-section:first-of-type {
  border-top: none;
}

.expand-title {
  margin: 4px 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.expand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.expand-actions {
  display: flex;
  gap: 8px;
}

.section-empty {
  margin: 10px 0 0 0;
  color: var(--fg2);
  font-size: 13px;
}

.metrics-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.metric-card {
  border: var(--k-status-divider, var(--k-color-divider-dark)) 1px solid;
  border-radius: 4px;
  padding: 10px;
  flex: 1 1 150px;
  box-sizing: border-box;
  text-align: center;
  max-width: 200px;
}

.metric-name {
  font-size: 12px;
  color: var(--fg2);
}

.metric-value {
  font-size: 16px;
  font-weight: bold;
  display: flex;
  justify-content: center;
  gap: 4px;
}

.metric-unit {
  font-size: 16px;
  color: var(--fg2);
}

.actions-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.actions-container .el-button + .el-button) {
  margin-left: 0;
}

.action-chip {
  border: var(--k-status-divider, var(--k-color-divider-dark)) 1px solid;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.action-name {
  font-weight: 600;
  margin-right: 6px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badges {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: var(--fg4, var(--k-color-border)) 1px solid;
  border-radius: 999px;
  font-size: 14px;
  color: var(--fg2);
}

.status-badge.auto {
  color: var(--k-color-success, var(--k-color-primary));
  border-color: currentColor;
}

.status-badge.cron {
  color: var(--k-color-success, var(--k-color-primary));
  border-color: currentColor;
}

.alert-row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.alert-row-actions :deep(.el-button) {
  min-width: 32px;
  padding: 4px 6px;
}

.alert-table {
  width: 100%;
}

.alert-message {
  display: inline-block;
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
}

.alert-message.placeholder {
  color: var(--fg2);
  font-style: italic;
}

.log-view {
  padding: 1rem;
  max-height: 60vh;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.process-scroll :deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}

.el-button--success {
  --el-button-hover-text-color: var(--k-color-success);
  --el-button-hover-border-color: var(--k-color-success);
}

.el-button--info {
  --el-button-hover-text-color: var(--k-color-info);
  --el-button-hover-border-color: var(--k-color-info);
}

.el-button--danger {
  --el-button-hover-text-color: var(--k-color-danger);
  --el-button-hover-border-color: var(--k-color-danger);
}
</style>
