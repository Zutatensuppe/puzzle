<template>
  <div>
    <v-autocomplete
      v-model="selected"
      v-model:search="input"
      :items="autocompleteValues"
      density="compact"
      hide-no-data
      hide-details
      label="Tag"
      @keydown.enter.prevent="add"
      @keydown.tab.prevent="add"
      @keyup="onKeyUp"
    />
    <div
      v-if="values.length > 0"
      class="mt-4 d-flex"
    >
      <v-chip
        v-for="(tag,idx) in values"
        :key="idx"
        class="is-clickable mr-2"
        append-icon="mdi-close"
        @click="rm(tag)"
      >
        {{ tag }}
      </v-chip>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
  autocompleteTags?: (input: string, exclude: string[]) => string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void
}>()

const selected = ref<string>('')
const input = ref<string>('')
const values = ref<string[]>(props.modelValue)
const autocompleteValues = ref<string[]>([])

const onKeyUp = () => {
  if (input.value && props.autocompleteTags) {
    autocompleteValues.value = props.autocompleteTags(
      input.value,
      values.value,
    )
  }
}

watch(selected, (newVal) => {
  if (newVal) {
    addVal(newVal)
  }
})

const addVal = (value: string) => {
  const newval = value.replace(/,/g, '').trim()
  if (!newval) {
    return
  }
  if (!values.value.includes(newval)) {
    values.value.push(newval)
  }
  input.value = ''
  selected.value = ''
  autocompleteValues.value = []
  emit('update:modelValue', values.value)
}

const add = () => {
  addVal(input.value)
}

const rm = (val: string) => {
  values.value = values.value.filter(v => v !== val)
  emit('update:modelValue', values.value)
}

watch(() => props.modelValue, (newValue) => {
  values.value = newValue
})
</script>
