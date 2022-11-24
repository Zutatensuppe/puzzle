<template>
  <div>
    <div class="input-holder">
      <input
        ref="inputEl"
        class="input"
        type="text"
        v-model="input"
        placeholder="Plants, People"
        @keydown.enter.prevent="add"
        @keydown.tab.prevent="add"
        @keyup="onKeyUp"
        />
      <div class="enter-hint color-highlight" v-if="input">[Press ENTER/TAB to add]</div>
    </div>
    <div v-if="autocomplete.values" class="autocomplete">
      <ul>
        <li
          v-for="(val,idx) in autocomplete.values"
          :key="idx"
          :class="{active: idx===autocomplete.idx}"
          @click="addVal(val)"
          >{{val}}</li>
      </ul>
    </div>
    <span v-for="(tag,idx) in values" :key="idx" class="bit is-clickable" @click="rm(tag)">{{tag}} ✖</span>
  </div>
</template>
<script setup lang="ts">
import { Ref, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
  autocompleteTags?: (input: string, exclude: string[]) => string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void
}>()

const input = ref<string>('')
const values = ref<string[]>(props.modelValue)
const autocomplete = ref<{ idx: number, values: string[] }>({
  idx: -1,
  values: [] as string[],
})

const inputEl = ref<HTMLInputElement>() as Ref<HTMLInputElement>

const onKeyUp = (ev: KeyboardEvent) => {
  if (ev.code === 'ArrowDown' && autocomplete.value.values.length > 0) {
    if (autocomplete.value.idx < autocomplete.value.values.length - 1) {
      autocomplete.value.idx++
    }
    ev.stopPropagation()
    return false
  }
  if (ev.code === 'ArrowUp' && autocomplete.value.values.length > 0) {
    if (autocomplete.value.idx > 0) {
      autocomplete.value.idx--
    }
    ev.stopPropagation()
    return false
  }
  if (ev.key === ',') {
    add()
    ev.stopPropagation()
    return false
  }

  if (ev.code === 'Escape') {
    autocomplete.value.values = []
    autocomplete.value.idx = -1
    ev.stopPropagation()
    return false
  }

  if (input.value && props.autocompleteTags) {
    autocomplete.value.values = props.autocompleteTags(
      input.value,
      values.value
    )
    autocomplete.value.idx = -1
  } else {
    autocomplete.value.values = []
    autocomplete.value.idx = -1
  }
}

const addVal = (value: string) => {
  const newval = value.replace(/,/g, '').trim()
  if (!newval) {
    return
  }
  if (!values.value.includes(newval)) {
    values.value.push(newval)
  }
  input.value = ''
  autocomplete.value.values = []
  autocomplete.value.idx = -1
  emit('update:modelValue', values.value)
  inputEl.value.focus()
}

const add = () => {
  const value = autocomplete.value.idx >= 0
    ? autocomplete.value.values[autocomplete.value.idx]
    : input.value
  addVal(value)
}

const rm = (val: string) => {
  values.value = values.value.filter(v => v !== val)
  emit('update:modelValue', values.value)
}

watch(() => props.modelValue, (newValue) => {
  values.value = newValue
})
</script>
