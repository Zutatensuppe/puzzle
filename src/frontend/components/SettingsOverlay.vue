<template>
  <overlay class="transparent">
    <template v-slot:default>
      <table class="settings">
        <tr>
          <td><label>Background: </label></td>
          <td><input type="color" v-model="background" /></td>
        </tr>
        <tr>
          <td><label>Color: </label></td>
          <td><input type="color" v-model="color" /></td>
        </tr>
        <tr>
          <td><label>Name: </label></td>
          <td><input type="text" maxLength="16" v-model="name" /></td>
        </tr>
        <tr>
          <td><label>Sounds: </label></td>
          <td><input type="checkbox" v-model="soundsEnabled" /></td>
        </tr>
        <tr>
          <td><label>Sounds Volume: </label></td>
          <td class="sound-volume">
            <span @click="decreaseVolume">🔉</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="soundsVolume"
              @change="updateVolume"
              />
            <span @click="increaseVolume">🔊</span>
          </td>
        </tr>
        <tr>
          <td><label>Show player names: </label></td>
          <td><input type="checkbox" v-model="showPlayerNames" /></td>
        </tr>
      </table>
    </template>
  </overlay>
</template>
<script lang="ts">
import { defineComponent, WatchStopHandle } from 'vue'

export default defineComponent({
  emits: {
    'update:modelValue': null,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
  },
  data: () => {
    return {
      background: '',
      color: '',
      name: '',
      soundsEnabled: true,
      soundsVolume: 100,
      showPlayerNames: true,

      watches: [] as WatchStopHandle[],
    }
  },
  methods: {
    updateVolume (ev: Event): void {
      const vol = parseInt((ev.target as HTMLInputElement).value)
      this.soundsVolume = vol
    },
    decreaseVolume (): void {
      this.soundsVolume = Math.max(0, this.soundsVolume - 5)
    },
    increaseVolume (): void {
      this.soundsVolume = Math.min(100, this.soundsVolume + 5)
    },
    apply (modelValue: any): void {
      this.disableWatches()
      this.background = `${modelValue.background}`
      this.color = `${modelValue.color}`
      this.name = `${modelValue.name}`
      this.soundsEnabled = !!modelValue.soundsEnabled
      this.soundsVolume = parseInt(`${modelValue.soundsVolume}`, 10)
      this.showPlayerNames = !!modelValue.showPlayerNames
      this.enableWatches()
    },
    emitChanges (): void {
      this.$emit('update:modelValue', {
        background: this.background,
        color: this.color,
        name: this.name,
        soundsEnabled: this.soundsEnabled,
        soundsVolume: this.soundsVolume,
        showPlayerNames: this.showPlayerNames,
      })
    },
    enableWatches (): void {
      this.watches.push(this.$watch('background', this.emitChanges))
      this.watches.push(this.$watch('color', this.emitChanges))
      this.watches.push(this.$watch('name', this.emitChanges))
      this.watches.push(this.$watch('soundsEnabled', this.emitChanges))
      this.watches.push(this.$watch('soundsVolume', this.emitChanges))
      this.watches.push(this.$watch('showPlayerNames', this.emitChanges))
    },
    disableWatches (): void {
      const w = this.watches
      this.watches = []
      w.forEach(stop => stop())
    },
  },
  created () {
    this.apply(this.modelValue)
    // TODO: ts type PlayerSettings
    this.$watch('modelValue', (val: any) => {
      this.apply(val)
    })
  },
})
</script>
<style scoped>
.sound-volume span { cursor: pointer; user-select: none; }
.sound-volume input { vertical-align: middle; }
</style>
