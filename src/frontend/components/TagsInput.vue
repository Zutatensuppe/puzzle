<template>
  <div>
    <input
      ref="input"
      class="input"
      type="text"
      v-model="input"
      placeholder="Plants, People"
      @change="onChange"
      @keydown.enter="add"
      @keyup="onKeyUp"
      />
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
    <span v-for="(tag,idx) in values" :key="idx" class="bit" @click="rm(tag)">{{tag}} ✖</span>
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
<style scoped>
.input {
  margin-bottom: .5em;
}
.autocomplete {
  position: relative;
}
.autocomplete ul { list-style: none;
  padding: 0;
  margin: 0;
  position: absolute;
  left: 0;
  right: 0;
  background: #333230;
  top: -.5em;
}
.autocomplete ul li {
  position: relative;
  padding: .5em .5em .5em 1.5em;
  cursor: pointer;
}
.autocomplete ul li.active {
  color: var(--link-hover-color);
  background: var(--input-bg-color);
}
.autocomplete ul li.active:before {
  content: '▶';
  display: block;
  position: absolute;
  left: .5em;
}
</style>
