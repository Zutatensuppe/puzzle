<template>
  <v-card>
    <v-container :fluid="true">
      <h4>Settings</h4>
      <div>
        <v-label>Background Color</v-label>
        <IngameColorPicker v-model="background" @open="onColorPickerOpen" @close="onColorPickerClose" />
      </div>

      <div>
        <div class="d-flex">
          <v-label>Table</v-label>
          <v-checkbox-btn v-model="showTable" label="Show Table" density="comfortable"></v-checkbox-btn>
        </div>
        <v-radio-group v-model="tableTexture" v-if="showTable" inline density="comfortable" hide-details>
          <v-radio label="Dark" value="dark"></v-radio>
          <v-radio label="Brown" value="brown"></v-radio>
          <v-radio label="Light" value="light"></v-radio>
        </v-radio-group>
      </div>

      <div>
        <div class="d-flex">
          <v-label>Player Color</v-label>
          <v-checkbox v-model="isUkraineColor" density="comfortable" hide-details>
            <template v-slot:label>
              <icon icon="ukraine-heart" />
            </template>
          </v-checkbox>
        </div>
        <IngameColorPicker v-model="color" v-if="!isUkraineColor" @open="onColorPickerOpen" @close="onColorPickerClose" />
      </div>

      <div>
        <v-label>Player Name</v-label>
        <v-text-field hide-details maxLength="16" v-model="name" density="compact"></v-text-field>

        <v-checkbox density="comfortable" hide-details v-model="showPlayerNames" label="Show other player names on their hands"></v-checkbox>
      </div>

      <div>
        <v-label>Sounds</v-label>

        <v-checkbox density="comfortable" hide-details v-model="soundsEnabled" label="Sounds enabled"></v-checkbox>
        <v-checkbox density="comfortable" hide-details :disabled="!soundsEnabled" v-model="otherPlayerClickSoundEnabled" label="Piece connect sounds of others"></v-checkbox>

        <v-slider
          hide-details
          :disabled="!soundsEnabled"
          v-model="soundsVolume"
          @update:modelValue="updateVolume"
          step="1"
          label="Volume"
        >
          <template v-slot:prepend>
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-volume-minus"
              @click="decreaseVolume"
            ></v-btn>
          </template>

          <template v-slot:append>
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-volume-plus"
              @click="increaseVolume"
            ></v-btn>
          </template>
        </v-slider>
      </div>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { PlayerSettings } from '../PlayerSettings';

import IngameColorPicker from './IngameColorPicker.vue';

const props = defineProps<{
  settings: PlayerSettings
}>()

const emit = defineEmits<{
  (e: 'dialogChange', val: any[]): void
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

const onColorPickerOpen = () => {
  emit('dialogChange', [
    { type: 'persistent', value: true },
  ])
}
const onColorPickerClose = () => {
  emit('dialogChange', [
    { type: 'persistent', value: undefined },
  ])
}

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
watch(background, (newVal: any) => {
  if (typeof newVal !== 'string') {
    background.value = newVal.hex
  } else {
    emitChanges()
  }
})
watch(showTable, emitChanges)
watch(tableTexture, emitChanges)
watch(color, (newVal: any) => {
  if (typeof newVal !== 'string') {
    color.value = newVal.hex
  } else {
    emitChanges()
  }
})
watch(name, emitChanges)
watch(soundsEnabled, emitChanges)
watch(otherPlayerClickSoundEnabled, emitChanges)
watch(soundsVolume, emitChanges)
watch(showPlayerNames, emitChanges)
</script>
