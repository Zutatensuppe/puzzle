<template>
  <overlay class="transparent">
    <template v-slot:default>
      <table class="settings">
        <tr>
          <td><label>Background: </label></td>
          <td><input type="color" v-model="background" /></td>
        </tr>
        <tr>
          <td><label>Table: </label></td>
          <td>
            <label><input type="checkbox" v-model="showTable">Show</label>
            <label v-if="showTable"><input type="radio" v-model="tableTexture" value="dark" /> Dark</label>
            <label v-if="showTable"><input type="radio" v-model="tableTexture" value="brown" /> Brown</label>
            <label v-if="showTable"><input type="radio" v-model="tableTexture" value="light" /> Light</label>
          </td>
        </tr>
        <tr>
          <td><label>Color: </label></td>
          <td>
            <input type="color" v-model="color" v-if="!isUkraineColor" />
            <label><input type="checkbox" v-model="isUkraineColor"><i class="icon icon-ukraine-heart" /></label>
          </td>
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
          <td><label>Piece connect sounds of others: </label></td>
          <td><input type="checkbox" :disabled="!soundsEnabled" v-model="otherPlayerClickSoundEnabled" /></td>
        </tr>
        <tr>
          <td><label>Sounds Volume: </label></td>
          <td class="sound-volume">
            <span @click="decreaseVolume"><i class="icon icon-volume-down" /></span>
            <input
              :disabled="!soundsEnabled"
              type="range"
              min="0"
              max="100"
              :value="soundsVolume"
              @change="updateVolume"
              />
            <span @click="increaseVolume"><i class="icon icon-volume-up" /></span>
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
      showTable: false,
      tableTexture: 'dark', // dark | light
      background: '',
      color: '',
      isUkraineColor: false,
      name: '',
      soundsEnabled: true,
      otherPlayerClickSoundEnabled: true,
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
      this.showTable = !!modelValue.showTable
      this.tableTexture = modelValue.tableTexture
      this.background = `${modelValue.background}`
      this.color = `${modelValue.color}`
      this.isUkraineColor = this.color === 'ukraine'
      this.name = `${modelValue.name}`
      this.soundsEnabled = !!modelValue.soundsEnabled
      this.otherPlayerClickSoundEnabled = !!modelValue.otherPlayerClickSoundEnabled
      this.soundsVolume = parseInt(`${modelValue.soundsVolume}`, 10)
      this.showPlayerNames = !!modelValue.showPlayerNames
      this.enableWatches()
    },
    emitChanges (): void {
      this.$emit('update:modelValue', {
        showTable: this.showTable,
        tableTexture: this.tableTexture,
        background: this.background,
        color: this.isUkraineColor ? 'ukraine' : this.color,
        name: this.name,
        soundsEnabled: this.soundsEnabled,
        otherPlayerClickSoundEnabled: this.otherPlayerClickSoundEnabled,
        soundsVolume: this.soundsVolume,
        showPlayerNames: this.showPlayerNames,
      })
    },
    enableWatches (): void {
      this.watches.push(this.$watch(() => this.isUkraineColor, this.emitChanges))
      this.watches.push(this.$watch(() => this.background, this.emitChanges))
      this.watches.push(this.$watch(() => this.showTable, this.emitChanges))
      this.watches.push(this.$watch(() => this.tableTexture, this.emitChanges))
      this.watches.push(this.$watch(() => this.color, this.emitChanges))
      this.watches.push(this.$watch(() => this.name, this.emitChanges))
      this.watches.push(this.$watch(() => this.soundsEnabled, this.emitChanges))
      this.watches.push(this.$watch(() => this.otherPlayerClickSoundEnabled, this.emitChanges))
      this.watches.push(this.$watch(() => this.soundsVolume, this.emitChanges))
      this.watches.push(this.$watch(() => this.showPlayerNames, this.emitChanges))
    },
    disableWatches (): void {
      const w = this.watches
      this.watches = []
      w.forEach(stop => stop())
    },
  },
  created () {
    this.apply(this.modelValue)
  },
})
</script>
<style scoped>
.sound-volume span { cursor: pointer; user-select: none; }
.sound-volume input { vertical-align: middle; }
</style>
