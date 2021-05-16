<template>
  <div class="overlay transparent" @click="$emit('bgclick')">
    <table class="overlay-content settings" @click.stop="">
      <tr>
        <td><label>Background: </label></td>
        <td><input type="color" v-model="modelValue.background" /></td>
      </tr>
      <tr>
        <td><label>Color: </label></td>
        <td><input type="color" v-model="modelValue.color" /></td>
      </tr>
      <tr>
        <td><label>Name: </label></td>
        <td><input type="text" maxLength="16" v-model="modelValue.name" /></td>
      </tr>
    </table>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'settings-overlay',
  emits: {
    bgclick: null,
    'update:modelValue': null,
  },
  props: {
    modelValue: Object,
  },
  created () {
    // TODO: ts type PlayerSettings
    this.$watch('modelValue', (val: any) => {
      this.$emit('update:modelValue', val)
    }, { deep: true })
  },
})
</script>
