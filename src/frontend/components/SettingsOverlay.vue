<template>
  <overlay class="transparent" @close="emit('close')">
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
            <label><input type="checkbox" v-model="isUkraineColor"><icon icon="ukraine-heart" /></label>
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
            <span @click="decreaseVolume"><icon icon="volume-down" /></span>
            <input
              :disabled="!soundsEnabled"
              type="range"
              min="0"
              max="100"
              :value="soundsVolume"
              @change="updateVolume"
              />
            <span @click="increaseVolume"><icon icon="volume-up" /></span>
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
<script setup lang="ts">
import { ref, watch, WatchStopHandle } from 'vue'
import { PlayerSettings } from '../settings'

const emit = defineEmits<{
  (e: 'update:modelValue', val: PlayerSettings): void
  (e: 'close'): void
}>()

const props = defineProps<{
  modelValue: PlayerSettings
}>()

const showTable = ref<boolean>(false)
const tableTexture = ref<string>('dark')
const background = ref<string>('')
const color = ref<string>('')
const isUkraineColor = ref<boolean>(false)
const name = ref<string>('')
const soundsEnabled = ref<boolean>(true)
const otherPlayerClickSoundEnabled = ref<boolean>(true)
const soundsVolume = ref<number>(100)
const showPlayerNames = ref<boolean>(true)
const watches = ref<WatchStopHandle[]>([])

const updateVolume = (ev: Event): void => {
  const vol = parseInt((ev.target as HTMLInputElement).value)
  soundsVolume.value = vol
}
const decreaseVolume = (): void => {
  soundsVolume.value = Math.max(0, soundsVolume.value - 5)
}
const increaseVolume = (): void => {
  soundsVolume.value = Math.min(100, soundsVolume.value + 5)
}
const emitChanges = (): void => {
  emit('update:modelValue', {
    showTable: showTable.value,
    tableTexture: tableTexture.value,
    background: background.value,
    color: isUkraineColor.value ? 'ukraine' : color.value,
    name: name.value,
    soundsEnabled: soundsEnabled.value,
    otherPlayerClickSoundEnabled: otherPlayerClickSoundEnabled.value,
    soundsVolume: soundsVolume.value,
    showPlayerNames: showPlayerNames.value,
  })
}
const enableWatches = (): void => {
  watches.value.push(watch(isUkraineColor, emitChanges))
  watches.value.push(watch(background, emitChanges))
  watches.value.push(watch(showTable, emitChanges))
  watches.value.push(watch(tableTexture, emitChanges))
  watches.value.push(watch(color, emitChanges))
  watches.value.push(watch(name, emitChanges))
  watches.value.push(watch(soundsEnabled, emitChanges))
  watches.value.push(watch(otherPlayerClickSoundEnabled, emitChanges))
  watches.value.push(watch(soundsVolume, emitChanges))
  watches.value.push(watch(showPlayerNames, emitChanges))
}
const disableWatches = (): void => {
  const w = watches.value
  watches.value = []
  w.forEach(stop => stop())
}

const apply = (modelValue: PlayerSettings): void => {
  disableWatches()
  showTable.value = !!modelValue.showTable
  tableTexture.value = modelValue.tableTexture
  background.value = `${modelValue.background}`
  color.value = `${modelValue.color}`
  isUkraineColor.value = color.value === 'ukraine'
  name.value = `${modelValue.name}`
  soundsEnabled.value = !!modelValue.soundsEnabled
  otherPlayerClickSoundEnabled.value = !!modelValue.otherPlayerClickSoundEnabled
  soundsVolume.value = parseInt(`${modelValue.soundsVolume}`, 10)
  showPlayerNames.value = !!modelValue.showPlayerNames
  enableWatches()
}

apply(props.modelValue)
</script>
