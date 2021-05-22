<template>
  <div>
    <input class="input" type="text" v-model="input" placeholder="Plants, People" @keydown.enter="add" @keyup="onKeyUp" />
    <span v-for="(tag,idx) in values" :key="idx" class="bit" @click="rm(tag)">{{tag}} ✖</span>
  </div>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'

export default defineComponent({
  name: 'tags-input',
  props: {
    modelValue: {
      type: Array as PropType<Array<string>>,
      required: true,
    },
  },
  emits: {
    'update:modelValue': null,
  },
  data () {
    return {
      input: '',
      values: [] as Array<string>,
    }
  },
  created () {
    this.values = this.modelValue
  },
  methods: {
    onKeyUp (ev: KeyboardEvent) {
      if (ev.key === ',') {
        this.add()
        ev.stopPropagation()
        return false
      }
    },
    add () {
      const newval = this.input.replace(/,/g, '').trim()
      if (!newval) {
        return
      }
      if (!this.values.includes(newval)) {
        this.values.push(newval)
      }
      this.input = ''
      this.$emit('update:modelValue', this.values)
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
</style>
