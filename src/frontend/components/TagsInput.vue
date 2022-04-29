<template>
  <div>
    <div class="input-holder">
      <input
        ref="input"
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
<script lang="ts">
import { defineComponent, PropType } from 'vue'

export default defineComponent({
  props: {
    modelValue: {
      type: Array as PropType<string[]>,
      required: true,
    },
    autocompleteTags: {
      type: Function,
    },
  },
  emits: {
    'update:modelValue': null,
  },
  data () {
    return {
      input: '',
      values: [] as string[],
      autocomplete: {
        idx: -1,
        values: [] as string[],
      },
    }
  },
  watch: {
    modelValue(newValue, oldValue) {
      this.values = newValue
    },
  },
  created () {
    this.values = this.modelValue
  },
  methods: {
    onKeyUp (ev: KeyboardEvent) {
      if (ev.code === 'ArrowDown' && this.autocomplete.values.length > 0) {
        if (this.autocomplete.idx < this.autocomplete.values.length - 1) {
          this.autocomplete.idx++
        }
        ev.stopPropagation()
        return false
      }
      if (ev.code === 'ArrowUp' && this.autocomplete.values.length > 0) {
        if (this.autocomplete.idx > 0) {
          this.autocomplete.idx--
        }
        ev.stopPropagation()
        return false
      }
      if (ev.key === ',') {
        this.add()
        ev.stopPropagation()
        return false
      }

      if (ev.code === 'Escape') {
        this.autocomplete.values = []
        this.autocomplete.idx = -1
        ev.stopPropagation()
        return false
      }

      if (this.input && this.autocompleteTags) {
        this.autocomplete.values = this.autocompleteTags(
          this.input,
          this.values
        )
        this.autocomplete.idx = -1
      } else {
        this.autocomplete.values = []
        this.autocomplete.idx = -1
      }
    },
    addVal (value: string) {
      const newval = value.replace(/,/g, '').trim()
      if (!newval) {
        return
      }
      if (!this.values.includes(newval)) {
        this.values.push(newval)
      }
      this.input = ''
      this.autocomplete.values = []
      this.autocomplete.idx = -1
      this.$emit('update:modelValue', this.values)
      ;(this.$refs.input as HTMLInputElement).focus()
    },
    add () {
      const value = this.autocomplete.idx >= 0
        ? this.autocomplete.values[this.autocomplete.idx]
        : this.input
      this.addVal(value)
    },
    rm (val: string) {
      this.values = this.values.filter(v => v !== val)
      this.$emit('update:modelValue', this.values)
    },
  }
})
</script>
