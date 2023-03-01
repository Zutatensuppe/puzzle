<template>
  <div class="ingame-color-picker">
    <ColorPicker
      v-model="pickerVal"
      @open="emit('open')"
      @close="emit('close')"
    />
    <Slider
      v-model="sliderVal"
      class="mb-2"
      :swatches="swatches"
    />
  </div>
</template>
<script setup lang="ts">
import { Slider } from '@ckpack/vue-color'
import { ref, watch } from 'vue'
import ColorPicker from './ColorPicker.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'open'): void
  (e: 'close'): void
}>()

const swatches = [
  { s: 0.5, l: 0.9 },
  { s: 0.6, l: 0.8 },
  { s: 0.6, l: 0.65 },
  { s: 0.6, l: 0.5 },
  { s: 0.6, l: 0.35 },
  { s: 0.6, l: 0.2 },
  { s: 0.5, l: 0.1 },
  { s: 0, l: 1 },
  { s: 0, l: 0.8 },
  { s: 0, l: 0.65 },
  { s: 0, l: 0.5 },
  { s: 0, l: 0.35 },
  { s: 0, l: 0.2 },
  { s: 0, l: 0 },
]

const sliderVal = ref<string>(`${props.modelValue}`)
const pickerVal = ref<string>(`${props.modelValue}`)

watch(() => props.modelValue, (value: string) => {
  if (sliderVal.value !== value) {
    sliderVal.value = value
  }
  if (pickerVal.value !== value) {
    pickerVal.value = value
  }
})

watch(sliderVal, (value: any) => {
  const emitValue = typeof value === 'string' ? value : value.hex
  if (props.modelValue !== emitValue) {
    emit('update:modelValue', value)
  }
}, { deep: true })

watch(pickerVal, (value: any) => {
  const emitValue = typeof value === 'string' ? value : value.hex
  if (props.modelValue !== emitValue) {
    emit('update:modelValue', value)
  }
}, { deep: true })
</script>
