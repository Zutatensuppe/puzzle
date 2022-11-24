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
import { ref, watch } from 'vue'
import { PlayerSettings } from '../PlayerSettings';

const emit = defineEmits<{
  (e: 'close'): void
}>()

const props = defineProps<{
  settings: PlayerSettings
}>()

const showTable = ref<boolean>(props.settings.showTable())
const tableTexture = ref<string>(props.settings.tableTexture())
const background = ref<string>(props.settings.background())
const color = ref<string>(props.settings.color())
const isUkraineColor = ref<boolean>(color.value === 'ukraine')
const name = ref<string>(props.settings.name())
const soundsEnabled = ref<boolean>(props.settings.soundsEnabled())
const otherPlayerClickSoundEnabled = ref<boolean>(props.settings.otherPlayerClickSoundEnabled())
const soundsVolume = ref<number>(props.settings.soundsVolume())
const showPlayerNames = ref<boolean>(props.settings.showPlayerNames())

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

// TODO: emit changes only when relevant value changed
const emitChanges = (): void => {
  props.settings.setShowTable(showTable.value)
  props.settings.setTableTexture(tableTexture.value)
  props.settings.setBackground(background.value)
  props.settings.setColor(isUkraineColor.value ? 'ukraine' : color.value)
  props.settings.setName(name.value)
  props.settings.setSoundsEnabled(soundsEnabled.value)
  props.settings.setOtherPlayerClickSoundEnabled(otherPlayerClickSoundEnabled.value)
  props.settings.setSoundsVolume(soundsVolume.value)
  props.settings.setShowPlayerNames(showPlayerNames.value)
}

watch(isUkraineColor, emitChanges)
watch(background, emitChanges)
watch(showTable, emitChanges)
watch(tableTexture, emitChanges)
watch(color, emitChanges)
watch(name, emitChanges)
watch(soundsEnabled, emitChanges)
watch(otherPlayerClickSoundEnabled, emitChanges)
watch(soundsVolume, emitChanges)
watch(showPlayerNames, emitChanges)
</script>
