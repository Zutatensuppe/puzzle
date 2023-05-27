<template>
  <v-card>
    <v-container :fluid="true">
      <h4>Settings</h4>
      <div>
        <v-label>Background Color</v-label>
        <IngameColorPicker
          v-model="background"
          @open="onColorPickerOpen"
          @close="onColorPickerClose"
        />
      </div>

      <div>
        <div class="d-flex">
          <v-label>Table</v-label>
          <v-checkbox-btn
            v-model="showTable"
            label="Show Table"
            density="comfortable"
          />
        </div>
        <v-radio-group
          v-if="showTable"
          v-model="tableTexture"
          inline
          density="comfortable"
          hide-details
        >
          <v-radio
            label="Dark"
            value="dark"
          />
          <v-radio
            label="Brown"
            value="brown"
          />
          <v-radio
            label="Light"
            value="light"
          />
        </v-radio-group>
      </div>

      <div>
        <div class="d-flex">
          <v-label>Player Color</v-label>
          <v-checkbox
            v-model="isUkraineColor"
            density="comfortable"
            hide-details
          >
            <template #label>
              <icon icon="ukraine-heart" />
            </template>
          </v-checkbox>
        </div>
        <IngameColorPicker
          v-if="!isUkraineColor"
          v-model="color"
          @open="onColorPickerOpen"
          @close="onColorPickerClose"
        />
      </div>

      <div>
        <v-label>Player Name</v-label>
        <v-text-field
          v-model="name"
          hide-details
          max-length="16"
          density="compact"
        />

        <v-checkbox
          v-model="showPlayerNames"
          density="comfortable"
          hide-details
          label="Show other player names on their hands"
        />
      </div>

      <div>
        <v-label>Sounds</v-label>

        <v-checkbox
          v-model="soundsEnabled"
          density="comfortable"
          hide-details
          label="Sounds enabled"
        />
        <v-checkbox
          v-model="otherPlayerClickSoundEnabled"
          density="comfortable"
          hide-details
          :disabled="!soundsEnabled"
          label="Piece connect sounds of others"
        />

        <v-slider
          v-model="soundsVolume"
          hide-details
          :disabled="!soundsEnabled"
          step="1"
          label="Volume"
          @update:modelValue="updateVolume"
        >
          <template #prepend>
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-volume-minus"
              @click="decreaseVolume"
            />
          </template>

          <template #append>
            <v-btn
              size="x-small"
              variant="text"
              icon="mdi-volume-plus"
              @click="increaseVolume"
            />
          </template>
        </v-slider>
      </div>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { GamePlay } from '../GamePlay'
import { GameReplay } from '../GameReplay'

import IngameColorPicker from './IngameColorPicker.vue'

const props = defineProps<{
  game: GamePlay | GameReplay
}>()

const emit = defineEmits<{
  (e: 'dialogChange', val: any[]): void
}>()

const showTable = ref<boolean>(props.game.getPlayerSettings().showTable())
const tableTexture = ref<string>(props.game.getPlayerSettings().tableTexture())
const background = ref<string>(props.game.getPlayerSettings().background())
const color = ref<string>(props.game.getPlayerSettings().color())
const isUkraineColor = ref<boolean>(color.value === 'ukraine')
const name = ref<string>(props.game.getPlayerSettings().name())
const soundsEnabled = ref<boolean>(props.game.getPlayerSettings().soundsEnabled())
const otherPlayerClickSoundEnabled = ref<boolean>(props.game.getPlayerSettings().otherPlayerClickSoundEnabled())
const soundsVolume = ref<number>(props.game.getPlayerSettings().soundsVolume())
const showPlayerNames = ref<boolean>(props.game.getPlayerSettings().showPlayerNames())

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

const updateVolume = (newVolume: number): void => {
  soundsVolume.value = newVolume
}
const decreaseVolume = (): void => {
  soundsVolume.value = Math.max(0, soundsVolume.value - 5)
}
const increaseVolume = (): void => {
  soundsVolume.value = Math.min(100, soundsVolume.value + 5)
}

// TODO: emit changes only when relevant value changed
const emitChanges = (): void => {
  props.game.getPlayerSettings().setShowTable(showTable.value)
  props.game.getPlayerSettings().setTableTexture(tableTexture.value)
  props.game.getPlayerSettings().setBackground(background.value)
  props.game.getPlayerSettings().setColor(isUkraineColor.value ? 'ukraine' : color.value)
  props.game.getPlayerSettings().setName(name.value)
  props.game.getPlayerSettings().setSoundsEnabled(soundsEnabled.value)
  props.game.getPlayerSettings().setOtherPlayerClickSoundEnabled(otherPlayerClickSoundEnabled.value)
  props.game.getPlayerSettings().setSoundsVolume(soundsVolume.value)
  props.game.getPlayerSettings().setShowPlayerNames(showPlayerNames.value)
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
