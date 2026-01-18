<template>
  <el-dialog v-model="visible" :title="`Actions · ${process?.name ?? ''} · ${action?.name ?? ''}`" width="80%">
    <div v-if="loading" class="action-dialog-loading">
      <el-skeleton :rows="3" animated />
    </div>
    <el-scrollbar v-else class="action-result-scrollbar" height="60vh" view-class="action-result-list">
      <template v-if="results?.length">
        <div v-for="(entry, idx) in results" :key="`${entry.process?.pm_id ?? 'unknown'}-${entry.process?.name ?? idx}`"
          class="action-result-row">
          <div class="action-result-meta">
            [{{ entry.process?.name ?? 'unknown' }}:{{ entry.process?.pm_id ?? '?' }}
            <span v-if="entry.process?.namespace">/{{ entry.process?.namespace }}</span>]
          </div>
          <div class="action-result-payload" v-html="formatActionPayload(entry)" />
        </div>
      </template>
      <p v-else class="section-empty">No response received.</p>
    </el-scrollbar>
  </el-dialog>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import type { PM2 } from 'koishi-plugin-pm2'
import type { ProcessRow, ActionEntry } from './dashboard.vue'

const props = defineProps<{
  visible: boolean
  process: ProcessRow | undefined
  action: ActionEntry | undefined
  results: PM2.MonitorActionResult[] | null
  loading: boolean
}>()

const emit = defineEmits(['update:visible'])

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatActionPayload = (entry: PM2.MonitorActionResult) => {
  const payload = entry?.data?.return ?? entry?.data
  if (payload == null) return '<em>No response received.</em>'
  if (typeof payload === 'string') return payload
  try {
    const serialized = JSON.stringify(payload, null, 2)
    return `<pre>${escapeHtml(serialized)}</pre>`
  } catch (err) {
    return `<pre>${escapeHtml(String(payload))}</pre>`
  }
}

</script>

<style lang="scss" scoped>
.action-dialog-loading {
  padding: 24px 0;
}

.action-result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-result-scrollbar {
  margin: 0 -4px;
}

.action-result-row {
  border: var(--fg3) 1px solid;
  border-radius: 4px;
  padding: 12px 14px;
  margin: 2px;
}

.action-result-meta {
  font-size: 12px;
  color: var(--fg2);
  margin-bottom: 6px;
}

.action-result-payload {
  margin: 0;
  font-family: 'Fira Code', 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}

.section-empty {
  margin: 10px 0 0 0;
  color: var(--fg2);
  font-size: 13px;
}
</style>
