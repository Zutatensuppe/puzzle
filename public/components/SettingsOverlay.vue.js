"use strict"

// ingame component
// allows to change (player) settings

export default {
  name: 'settings-overlay',
  template: `
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
  `,
  emits: {
    bgclick: null,
    'update:modelValue': null,
  },
  props: {
    modelValue: Object,
  },
  created () {
    this.$watch('modelValue', val => {
      this.$emit('update:modelValue', val)
    }, { deep: true })
  },
}
