<template>
  <el-dialog v-model="visible" :title="`Log · ${process?.name || ''}`" width="80%">
    <virtual-list class="log-list k-text-selectable" :data="logs" :count="300" :max-height="maxHeight">
      <template #="record">
        <div :class="{ line: true, start: isStart(record) }">
          <code v-html="renderLine(record)"></code>
        </div>
      </template>
    </virtual-list>
  </el-dialog>
</template>

<script lang="ts" setup>

import { VirtualList } from '@koishijs/client'
import type { ProcessRow, NamespaceRow, ClusterRow } from './dashboard.vue'
import { LogRecord } from '../utils'
import ansi from 'ansi_up'
import { computed } from 'vue';

const props = defineProps<{
  visible: boolean
  process: ProcessRow | NamespaceRow | ClusterRow | undefined
  logs: LogRecord[]
  maxHeight?: string
}>()

const emit = defineEmits(['update:visible'])

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

// this package does not have consistent exports in different environments
const converter = new (ansi['default'] || ansi)()

function isStart(record: LogRecord) {
  return record.data === ''
}

function renderLine(record: LogRecord) {
  return converter.ansi_to_html(record.data)
}

</script>

<style lang="scss" scoped>
.log-list {
  color: var(--terminal-fg);
  background-color: var(--terminal-bg);

  :deep(.el-scrollbar__view) {
    padding: 1rem 1rem;
  }

  .line.start {
    margin-top: 1rem;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: -0.5rem;
      border-top: 1px solid var(--terminal-separator);
    }
  }

  .line:first-child {
    margin-top: 0;

    &::before {
      display: none;
    }
  }

  .line {
    padding: 0 0.5rem;
    border-radius: 2px;
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    word-break: break-all;
    position: relative;

    &:hover {
      color: var(--terminal-fg-hover);
      background-color: var(--terminal-bg-hover);
    }

    ::selection {
      background-color: var(--terminal-bg-selection);
    }
  }
}
</style>
