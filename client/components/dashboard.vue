<template>
  <k-layout menu="pm2">
    <el-scrollbar class="process-scroll">
      <el-table ref="tableRef" :data="groupedRows" style="width: 100%" :row-key="rowKey" :row-class-name="rowClassName"
        @expand-change="onExpandChange">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div v-if="isProcessRow(row) && row.metrics?.length" class="expand-section">
              <h4 class="expand-title">Metrics</h4>
              <div class="metrics-container">
                <div v-for="metric in row.metrics" :key="metric.name" class="metric-card" :style="monitorStyle(metric)">
                  <div class="metric-name">{{ metric.name }}</div>
                  <div class="metric-value">
                    {{ metric.value }}
                    <span v-if="metric.unit" class="metric-unit">{{ metric.unit }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="isProcessRow(row) && row.actions?.length" class="expand-section">
              <h4 class="expand-title">Actions</h4>
              <div class="actions-container">
                <el-button v-for="action in row.actions" :key="action.name" size="small" class="action-chip" plain
                  @click="triggerCustomAction(row, action)">
                  <span class="action-name">{{ action.name }}</span>
                </el-button>
              </div>
            </div>

            <div v-if="isProcessRow(row)" class="expand-section">
              <div class="expand-header">
                <h4 class="expand-title">Alerts</h4>
                <div class="expand-actions">
                  <el-button size="small" type="primary" @click="showAddAlert(row)">Add Alert</el-button>
                  <el-popconfirm :title="`Clear all alerts?`" :description="`Target: ${row.name}`"
                    confirm-button-text="Confirm" cancel-button-text="Cancel" width="260" @confirm="clearAlerts(row)">
                    <template #reference>
                      <el-button size="small" type="danger">Clear Alerts</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
              <el-table v-if="row.alerts?.length" :data="row.alerts" size="small" border class="alert-table">
                <el-table-column prop="event" label="Event" min-width="80">
                  <template #default="{ row: alert }">
                    <span>{{ alert.event['type'] ?? alert.event }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="sid" label="From" min-width="120" />
                <el-table-column prop="cid" label="To" min-width="120" />
                <el-table-column label="Message" min-width="240">
                  <template #default="{ row: alert }">
                    <span v-if="alert.message" class="alert-message">{{ alert.message }}</span>
                    <span v-else class="alert-message placeholder">Default template</span>
                  </template>
                </el-table-column>
                <el-table-column label="Actions" min-width="120" align="center">
                  <template #default="{ row: alert }">
                    <div class="alert-row-actions">
                      <el-button size="small" text title="Send test alert" aria-label="Send test alert"
                        @click="testAlert(row, alert)">
                        &#128276;
                      </el-button>
                      <el-button size="small" text title="Edit alert" aria-label="Edit alert"
                        @click="showEditAlert(row, alert)">
                        &#9998;
                      </el-button>
                      <el-popconfirm :title="`Remove ${alert.event['type'] ?? alert.event} alert?`"
                        :description="alert.name === '*' ? 'Alert applies to all processes.' : `Target: ${alert.name ?? row.name}`"
                        confirm-button-text="Delete" cancel-button-text="Cancel" width="260"
                        @confirm="removeAlert(row, alert)">
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
        <el-table-column prop="name" label="Process" min-width="160">
          <template #default="{ row }">
            <div v-if="isNamespaceRow(row)" class="namespace-row">
              <span class="namespace-name">{{ row.name }}</span>
            </div>
            <div v-else-if="isClusterRow(row)" class="cluster-name">
              <span class="cluster-title">{{ row.name }}</span>
              <span class="cluster-count">{{ row.count }} instances</span>
            </div>
            <div v-else class="process-name" :class="{ 'cluster-process': isClusterProcess(row) }">
              <span class="process-title">{{ row.name }}</span>
              <span class="process-id">#{{ row.pm_id }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="pm2_env.status" label="Status" min-width="90" class-name="status-column">
          <template #default="{ row }">
            <div v-if="isProcessRow(row)" class="status-cell">
              <div class="status-wrap">
                <el-tag :type="statusType(row.pm2_env.status)" :effect="mode">{{ row.pm2_env.status }}</el-tag>
                <div class="status-badges">
                  <el-tooltip v-if="row.pm2_env.autorestart" content="Auto restart enabled" placement="top">
                    <span class="status-badge auto" aria-label="Auto restart enabled">A</span>
                  </el-tooltip>
                  <el-tooltip v-if="row.pm2_env.cron_restart && row.pm2_env.cron_restart != '0'"
                    content="Cron restart configured" placement="top">
                    <span class="status-badge cron" aria-label="Cron restart configured">C</span>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="pm2_env.pm_uptime" label="Uptime" min-width="60">
          <template #default="{ row }">
            <span v-if="isProcessRow(row)">
              {{ row.pm2_env.status === 'online' ? formatUptime(row.pm2_env.pm_uptime) : 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="pm2_env.restart_time" label="Restarts" min-width="60">
          <template #default="{ row }">
            <span v-if="isProcessRow(row)">{{ row.pm2_env.restart_time }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="monit.cpu" label="CPU" min-width="100">
          <template #default="{ row }">
            <div v-if="isProcessRow(row)" class="metric-cell" :style="metricStyle(row, 'cpu')">
              <span class="metric-text">{{ row.monit.cpu }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="monit.memory" label="Memory" min-width="100">
          <template #default="{ row }">
            <div v-if="isProcessRow(row)" class="metric-cell" :style="metricStyle(row, 'memory')">
              <span class="metric-text">{{ formatMemory(row.monit.memory) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Actions" min-width="100">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" type="primary" title="Restart" aria-label="Restart"
                @click="performAction(row, 'restart')">&#8635;</el-button>
              <el-button size="small" type="success" title="Reload" aria-label="Reload"
                @click="performAction(row, 'reload')">&#8634;</el-button>
              <el-button size="small" type="danger" title="Stop" aria-label="Stop"
                @click="performAction(row, 'stop')">&#9632;</el-button>
              <!-- <el-button size="small" type="danger" title="Delete" aria-label="Delete"
                @click="performAction(row, 'delete')">&#10006;</el-button> -->
              <el-button size="small" type="info" title="Logs" aria-label="Logs"
                @click="showLogs(row)">&#9776;</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-scrollbar>


    <log-view v-model:visible="logsDialogVisible" :process="logsCurrent" :logs="logsData" max-height="60vh" />

    <action-result v-model:visible="actionDialogVisible" :process="current" :action="actionCurrent"
      :results="actionData" :loading="actionDialogLoading" />

    <add-alert v-model:visible="alertDialogVisible" :process="current" :initial="editingAlert" @submit="submitAlert" />

  </k-layout>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
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
  historic?: boolean
  history?: MetricPoint[]
}

export type MetricPoint = {
  time: number
  value: number
}

export type ActionEntry = {
  name: string
  type?: string
  arity: number
}

export type ProcessRow = PM2.Process & {
  kind: 'process'
  metrics?: MetricEntry[]
  actions?: ActionEntry[]
}

const ctx = useContext()
const config = useConfig()
const mode = useColorMode()

const list = ref<ProcessRow[]>([])
const current = ref<ProcessRow>()
const logsCurrent = ref<ProcessRow | NamespaceRow | ClusterRow>()
const logsDialogVisible = ref(false)
const logsData = ref<LogRecord[]>([])
const actionDialogVisible = ref(false)
const actionDialogLoading = ref(false)
const actionCurrent = ref<ActionEntry>()
const actionData = ref<PM2.MonitorActionResult[]>([])
const alertDialogVisible = ref(false)
const editingAlert = ref<PM2.Alert | undefined>()

let timer: number

const expansionState = ref(new Map<string, boolean>())
const tableRef = ref()
const isSyncingExpansion = ref(false)
const namespaceRows = ref(new Map<string, NamespaceRow>())
const clusterRows = ref(new Map<string, ClusterRow>())

export type NamespaceRow = {
  kind: 'namespace'
  name: string
}

export type ClusterRow = {
  kind: 'cluster'
  namespace: string
  name: string
  count: number
}

const isNamespaceRow = (row: ProcessRow | NamespaceRow | ClusterRow): row is NamespaceRow => {
  return row.kind === 'namespace'
}

const isClusterRow = (row: ProcessRow | NamespaceRow | ClusterRow): row is ClusterRow => {
  return row.kind === 'cluster'
}

const isProcessRow = (row: ProcessRow | NamespaceRow | ClusterRow): row is ProcessRow => {
  return row.kind === 'process'
}

const isClusterProcess = (row: ProcessRow | NamespaceRow | ClusterRow) => {
  if (!isProcessRow(row)) return false
  return row.pm2_env?.exec_mode === 'cluster'
    || (typeof row.pm2_env?.instances === 'number' && row.pm2_env.instances > 1)
}

const isRowExpanded = (row: ProcessRow | NamespaceRow | ClusterRow) => {
  const key = rowKey(row)
  if (expansionState.value.has(key)) return expansionState.value.get(key) ?? false
  return !isProcessRow(row)
}

const rowClassName = ({ row }: { row: ProcessRow | NamespaceRow | ClusterRow }) => {
  if (isNamespaceRow(row)) return 'namespace-row'
  if (isClusterRow(row)) {
    return isRowExpanded(row) ? 'cluster-row cluster-expanded' : 'cluster-row'
  }
  return ''
}

const rowKey = (row: ProcessRow | NamespaceRow | ClusterRow) => {
  if (isNamespaceRow(row)) return `namespace:${row.name}`
  if (isClusterRow(row)) return `cluster:${row.namespace}:${row.name}`
  return `process:${row.pm_id}`
}


const getNamespaceRow = (namespace: string): NamespaceRow => {
  const cached = namespaceRows.value.get(namespace)
  if (cached) return cached
  const created = { kind: 'namespace', name: namespace } as NamespaceRow
  namespaceRows.value.set(namespace, created)
  return created
}

const getClusterRow = (namespace: string, name: string, count: number): ClusterRow => {
  const key = rowKey({ kind: 'cluster', namespace, name, count } as ClusterRow)
  const cached = clusterRows.value.get(key)
  if (cached) {
    cached.count = count
    return cached
  }
  const created = { kind: 'cluster', namespace, name, count } as ClusterRow
  clusterRows.value.set(key, created)
  return created
}

const groupedRows = computed<Array<ProcessRow | NamespaceRow | ClusterRow>>(() => {
  const namespaceMap = new Map<string, ProcessRow[]>()
  for (const proc of list.value) {
    const ns = proc.pm2_env?.namespace || 'default'
    const bucket = namespaceMap.get(ns) || []
    bucket.push(proc)
    namespaceMap.set(ns, bucket)
  }

  const result: Array<ProcessRow | NamespaceRow | ClusterRow> = []
  const namespaces = Array.from(namespaceMap.keys()).sort()
  for (const ns of namespaces) {
    const namespaceRow = getNamespaceRow(ns)
    result.push(namespaceRow)
    if (!isRowExpanded(namespaceRow)) continue

    const clusterMap = new Map<string, ProcessRow[]>()
    const procs = namespaceMap.get(ns) || []
    for (const proc of procs) {
      const name = proc.name
      const bucket = clusterMap.get(name) || []
      bucket.push(proc)
      clusterMap.set(name, bucket)
    }

    const clusterNames = Array.from(clusterMap.keys()).sort()
    for (const name of clusterNames) {
      const clusterProcs = clusterMap.get(name) || []
      const isClusterMode = clusterProcs.some(proc => proc.pm2_env?.exec_mode === 'cluster'
        || (typeof proc.pm2_env?.instances === 'number' && proc.pm2_env.instances > 1))
      if (isClusterMode) {
        const clusterRow = getClusterRow(ns, name, clusterProcs.length)
        result.push(clusterRow)
        if (!isRowExpanded(clusterRow)) continue
      }
      clusterProcs.sort((a, b) => a.pm_id - b.pm_id)
      result.push(...clusterProcs)
    }
  }
  return result
})

const syncExpansion = async () => {
  if (isSyncingExpansion.value) return
  isSyncingExpansion.value = true
  try {
    await nextTick()
    const table = tableRef.value
    if (!table) return
    for (const row of groupedRows.value) {
      table.toggleRowExpansion?.(row, isRowExpanded(row))
    }
  } finally {
    isSyncingExpansion.value = false
  }
}

const onExpandChange = (row: ProcessRow | NamespaceRow | ClusterRow, expandedRows: Array<ProcessRow | NamespaceRow | ClusterRow>) => {
  if (isSyncingExpansion.value) return
  const key = rowKey(row)
  const isExpanded = expandedRows.some(item => rowKey(item) === key)
  expansionState.value.set(key, isExpanded)
  expansionState.value = new Map(expansionState.value)
  if (isNamespaceRow(row) || isClusterRow(row)) {
    syncExpansion()
  }
}

const hydrateProcess = (target: ProcessRow, source: PM2.Process) => {
  Object.assign(target, source)
  target.kind = 'process'
  target.metrics = Object.entries(source.pm2_env?.axm_monitor || {}).map(([name, data]) => ({
    name,
    value: data.value,
    unit: data.unit || '',
    history: data.historic ? source.history?.monitors?.[name] || [] : [],
    historic: Boolean(data.historic),
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
      oldProc.history = proc.history
    } else {
      const enriched = { ...proc } as ProcessRow
      hydrateProcess(enriched, proc)
      enriched.history = proc.history
      list.value.push(enriched)
    }
  }

  for (let i = list.value.length - 1; i >= 0; i--) {
    const oldProc = list.value[i]
    if (!newMap.has(oldProc.pm_id)) {
      list.value.splice(i, 1)
    }
  }

  expansionState.value = new Map(
    Array.from(expansionState.value.entries()).filter(([key]) => {
      if (!key.startsWith('process:')) return true
      return newMap.has(Number(key.replace('process:', '')))
    })
  )

  syncExpansion()
}

const buildSparkline = (values: number[], maxValue: number, color: string) => {
  if (!values?.length) return ''
  const width = 120
  const height = 28
  const normalized = values.length === 1 ? [values[0], values[0]] : values
  const step = width / (normalized.length - 1)
  const points = normalized.map((value, index) => {
    const x = index * step
    const y = height - Math.min(1, Math.max(0, value / (maxValue || 1))) * height
    return `${x},${y}`
  }).join(' ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" /></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const metricStyle = (process: ProcessRow, type: 'cpu' | 'memory') => {
  const values = (process.history?.samples || []).map(sample => type === 'cpu' ? sample.cpu : sample.memory)
  if (!values.length) return {}
  const maxValue = Math.max(...values, 1)
  const color = type === 'cpu' ? 'rgba(64, 158, 255, 0.35)' : 'rgba(103, 194, 58, 0.35)'
  const backgroundImage = buildSparkline(values, maxValue, color)
  return backgroundImage ? {
    backgroundImage: `url("${backgroundImage}")`,
  } : {}
}

const monitorStyle = (metric: MetricEntry) => {
  if (!metric.history?.length) return {}
  const values = metric.history.map(sample => sample.value)
  const maxValue = Math.max(...values, 1)
  const color = 'rgba(230, 162, 60, 0.35)'
  const backgroundImage = buildSparkline(values, maxValue, color)
  return backgroundImage ? {
    backgroundImage: `url("${backgroundImage}")`,
  } : {}
}

onMounted(async () => {
  await refresh()
  timer = window.setInterval(refresh, config.value.pm2?.refreshInterval || 2000)
  syncExpansion()
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

const performAction = async (row: ProcessRow | NamespaceRow | ClusterRow, action: 'restart' | 'reload' | 'stop' | 'delete') => {
  const label = isProcessRow(row)
    ? `${row.name}#${row.pm_id}`
    : isNamespaceRow(row)
      ? `namespace:${row.name}`
      : `cluster:${row.name}`
  if (config.value.pm2?.enableConfirm?.includes(action) ?? true) {
    try {
      await ElMessageBox.confirm(
        `Are you sure to ${action} process ${label}?`,
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

  const target = isProcessRow(row) ? row.pm_id : isNamespaceRow(row) ? row.name : row.name
  await send('pm2/action', target, action)
  await refresh()
}

const triggerCustomAction = async (process: ProcessRow, action: ActionEntry) => {
  current.value = process
  actionCurrent.value = action
  actionDialogVisible.value = true
  actionDialogLoading.value = true
  try {
    const responses = await send('pm2/trigger-action', process.name, action.name)
    actionData.value = responses || []
  } catch (err) {
    actionData.value = []
    console.error('Failed to trigger PM2 monitor action', process.name, action.name, err)
    ElMessage.error(`Failed to trigger ${action.name}`)
  } finally {
    actionDialogLoading.value = false
  }
}

ctx.action('pm2.save', {
  action: () => send('pm2/save').then(() => {
    ElMessage.success('PM2 process list saved successfully')
  }).catch(err => {
    console.error('Failed to save PM2 process list', err)
    ElMessage.error('Failed to save PM2 process list')
  })
})

ctx.action('pm2.log', {
  action: () => showLogs()
})

const logTarget = ref<number | string>('PM2')

const showLogs = async (row?: ProcessRow | NamespaceRow | ClusterRow) => {
  let target: number | string
  if (!row) {
    logsCurrent.value = { name: 'PM2' } as any
    target = 'PM2'
  } else if (isNamespaceRow(row) || isClusterRow(row)) {
    logsCurrent.value = { name: row.name } as any
    target = row.name
  } else {
    logsCurrent.value = row
    target = row.pm_id
  }
  logTarget.value = target
  logsData.value = await send('pm2/start-log', target).then(data => data.map(item => ({ data: item })))
  logsDialogVisible.value = true
}

watch(logsDialogVisible, (visible) => {
  if (!visible && logsCurrent.value) {
    send('pm2/stop-log', logTarget.value ?? 'PM2').catch(err => {
      console.error('Failed to stop PM2 log', err)
    })
    logsCurrent.value = undefined
    logsData.value = []
  }
})

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

:deep(.el-table__expanded-cell) {
  padding: 0 !important;
}

:deep(.el-table__expand-column .cell) {
  padding-left: 8px !important;
  padding-right: 8px !important;
}

:deep(.el-table__expand-icon) {
  width: 20px;
  height: 20px;
  line-height: 20px;
}

:deep(.el-table__body .el-table__row .el-table__cell:nth-child(2) .cell),
:deep(.el-table__header .el-table__row .el-table__cell:nth-child(2) .cell) {
  padding-left: 8px !important;
  overflow: visible;
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


.namespace-name {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  margin-left: -12px;
}

:deep(.namespace-row td) {
  padding-top: 4px;
  padding-bottom: 4px;
  border-bottom: 0 !important;
}

:deep(.namespace-row + .el-table__row td) {
  border-top: 0 !important;
}

:deep(.namespace-row + .el-table__expanded-row) {
  display: none !important;
  height: 0 !important;
  line-height: 0 !important;
  font-size: 0 !important;
}

:deep(.namespace-row + .el-table__expanded-row td),
:deep(.namespace-row + .el-table__expanded-row .cell) {
  padding: 0 !important;
  border: 0 !important;
  height: 0 !important;
  line-height: 0 !important;
  font-size: 0 !important;
}

:deep(.cluster-row + .el-table__expanded-row) {
  display: none !important;
  height: 0 !important;
  line-height: 0 !important;
  font-size: 0 !important;
}

.cluster-name {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  line-height: 1.2;
}

.cluster-title {
  font-weight: 600;
}

.cluster-count {
  font-size: 12px;
  color: var(--fg2);
}

:deep(.cluster-row.cluster-expanded td) {
  border-bottom: 0 !important;
}

:deep(.cluster-row.cluster-expanded + .el-table__expanded-row + .el-table__row td) {
  border-top: 0 !important;
}

:deep(.cluster-row) td {
  padding-top: 4px;
  padding-bottom: 4px;
}

:deep(.cluster-row + .el-table__expanded-row td),
:deep(.cluster-row + .el-table__expanded-row .cell) {
  padding: 0 !important;
  border: 0 !important;
  height: 0 !important;
  line-height: 0 !important;
  font-size: 0 !important;
}

.process-name {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1.2;
}

.process-name.cluster-process {
  padding-left: 12px;
}

.process-id {
  font-size: 12px;
  color: var(--fg2);
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

.metric-cell {
  position: relative;
  padding: 4px 6px;
  border-radius: 6px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
}

.metric-text {
  position: relative;
  z-index: 1;
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
  overflow: visible;
}

:deep(.status-column),
:deep(.status-column .cell) {
  overflow: visible;
}

.status-wrap {
  position: relative;
  display: inline-flex;
  overflow: visible;
  padding-top: 4px;
  padding-right: 4px;
}

.status-badges {
  position: absolute;
  top: -4px;
  right: -4px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: var(--fg4, var(--k-color-border)) 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--fg2);
  background: var(--bg1);
  box-shadow: 0 0 0 1px var(--bg2);
}

.status-badge.auto {
  color: var(--k-color-success, var(--k-color-primary));
  border-color: currentColor;
}

.status-badge.cron {
  color: var(--k-color-success, var(--k-color-primary));
  border-color: currentColor;
}

.alert-table {
  width: 100%;
}

.alert-row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2px;
  width: 100%;
}

.alert-row-actions :deep(.el-button) {
  min-width: 32px;
  padding: 2px 4px;
}

.alert-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
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
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
