<template>
  <div class="color-picker">
    <div
      class="current-color"
      :style="currentColorStyle"
      @click="openPicker"
    />
    <div
      v-if="showingPicker"
      class="color-picker-background"
    >
      <Photoshop
        v-model="valTemp"
        @ok="onPickerOk"
        @cancel="onPickerCancel"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Photoshop } from '@ckpack/vue-color'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'open'): void
  (e: 'close'): void
}>()

const val = ref<string>(`${props.modelValue}`)
const valTemp = ref<string>(`${props.modelValue}`)
const showingPicker = ref<boolean>(false)

const currentColorStyle = computed(() => ({
  'background-color': val.value,
}))

watch(() => props.modelValue, (value: string) => {
  val.value = `${value}`
})

const openPicker = () => {
  valTemp.value = val.value
  showingPicker.value = true
  emit('open')
}
const onPickerOk = () => {
  console.log(valTemp)
  val.value = (valTemp.value as any).hex
  showingPicker.value = false
  emit('close')
}
const onPickerCancel = () => {
  showingPicker.value = false
  emit('close')
}

watch(val, (value: any) => {
  if (typeof value === 'string') {
    emit('update:modelValue', value)
  } else {
    emit('update:modelValue', value.hex)
  }
}, { deep: true })
</script>
