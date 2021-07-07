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
      <tr>
        <td><label>Sounds: </label></td>
        <td><input type="checkbox" v-model="modelValue.soundsEnabled" /></td>
      </tr>
      <tr>
        <td><label>Sounds Volume: </label></td>
        <td class="sound-volume">
          <span @click="decreaseVolume">🔉</span>
          <input
            type="range"
            min="0"
            max="100"
            :value="modelValue.soundsVolume"
            @change="updateVolume"
            />
          <span @click="increaseVolume">🔊</span>
        </td>
      </tr>
      <tr>
        <td><label>Show player names: </label></td>
        <td><input type="checkbox" v-model="modelValue.showPlayerNames" /></td>
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
    modelValue: {
      type: Object,
      required: true,
    },
  },
  methods: {
    updateVolume (ev: Event): void {
      (this.modelValue as any).soundsVolume = (ev.target as HTMLInputElement).value
    },
    decreaseVolume (): void {
      const vol = parseInt(this.modelValue.soundsVolume, 10) - 5
      this.modelValue.soundsVolume = Math.max(0, vol)
    },
    increaseVolume (): void {
      const vol = parseInt(this.modelValue.soundsVolume, 10) + 5
      this.modelValue.soundsVolume = Math.min(100, vol)
    },
  },
  created () {
    // TODO: ts type PlayerSettings
    this.$watch('modelValue', (val: any) => {
      this.$emit('update:modelValue', val)
    }, { deep: true })
  },
})
</script>
<style scoped>
.sound-volume span { cursor: pointer; user-select: none; }
.sound-volume input { vertical-align: middle; }
</style>
