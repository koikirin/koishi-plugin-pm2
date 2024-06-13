<template>
  <el-dialog v-model="visible" :title="`Alert · ${props.initial ? 'Edit' : 'Add'} · ${props.process?.name || ''}`"
    :close-on-click-modal="false" width="60%">
    <k-schema :schema="schema" :initial="initial" v-model="config" />
    <div class="alert-dialog-actions">
      <el-button type="primary" @click="save">Save</el-button>
      <el-button @click="visible = false">Cancel</el-button>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>

import { Schema, store } from '@koishijs/client'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { } from '@koishijs/plugin-status'
import type { PM2 } from 'koishi-plugin-pm2'
import type { ProcessRow } from './dashboard.vue'
import { vi } from 'element-plus/es/locale/index.mjs'

const props = defineProps<{
  visible: boolean
  process: ProcessRow | undefined
  initial: PM2.Alert | undefined
}>()

const emit = defineEmits(['update:visible', 'submit'])

const schema = computed(() => {
  return Schema.object({
    name: Schema.string().description('The name of the process. Use `*` to match all processes.').required(false).hidden(),
    event: Schema.union(['restart', 'delete', 'stop', 'reload', 'graceful reload', 'start', 'exit', 'online', 'restart overlimit', Schema.object({
      type: Schema.const('exit').default('exit').hidden(),
      eq: Schema.number().required(false),
      neq: Schema.number().required(false),
    }).description('exit(code)')]).description('The type of process:event.').default('exit'),
    sid: Schema.union(['auto', ...Object.keys(store.status?.['bots'] || {})]).description('platform:selfId').default('auto'),
    cid: Schema.string().description('platform:channelId').required(),
    message: Schema.string().description('The custom i18n message to send with the notification.').required(false),
  })
})

const config = ref<PM2.Alert>({} as any)

watch(() => ({
  initial: props.initial,
  visible: props.visible,
}), (value) => {
  if (value.initial) config.value = schema.value(value.initial)
}, { immediate: true })

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const initial = computed(() => {
  return props.initial || config.value
})

const save = () => {
  let parsed: PM2.Alert
  try {
    parsed = schema.value(config.value)
  } catch (err) {
    ElMessage.error(`Invalid configuration: ${(err as Error).message}`)
    return
  }
  emit('submit', {
    ...parsed,
    name: props.process?.name || '*',
  })
  visible.value = false
}


</script>

<style lang="scss">
.alert-dialog-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
