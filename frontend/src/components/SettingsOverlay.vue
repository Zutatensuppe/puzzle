<template>
  <v-card>
    <v-container :fluid="true">
      <h4>Settings</h4>
      <div>
        <v-label>Background Color</v-label>
        <IngameColorPicker
          v-model="playerSettings.background"
          @open="onColorPickerOpen"
          @close="onColorPickerClose"
        />
      </div>

      <div>
        <div class="d-flex">
          <v-label>Table</v-label>
          <v-checkbox-btn
            v-model="playerSettings.showTable"
            label="Show Table"
            density="comfortable"
          />
          <v-checkbox-btn
            v-if="playerSettings.showTable"
            v-model="playerSettings.useCustomTableTexture"
            label="Custom Texture"
            density="comfortable"
          />
        </div>
        <v-radio-group
          v-if="playerSettings.showTable && !playerSettings.useCustomTableTexture"
          v-model="playerSettings.tableTexture"
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
          <v-radio
            label="AI WOOD"
            value="aiwood"
          />
        </v-radio-group>
        <v-text-field
          v-if="playerSettings.showTable && playerSettings.useCustomTableTexture"
          v-model="playerSettings.customTableTexture"
          density="compact"
          label="Custom texture URL"
        />
        <v-text-field
          v-if="playerSettings.showTable && playerSettings.useCustomTableTexture"
          v-model="playerSettings.customTableTextureScale"
          type="number"
          density="compact"
          label="Custom texture scale"
        />
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
          v-model="playerSettings.color"
          @open="onColorPickerOpen"
          @close="onColorPickerClose"
        />
      </div>

      <div>
        <v-label>Player Name</v-label>
        <v-text-field
          v-model="playerSettings.name"
          hide-details
          max-length="16"
          density="compact"
        />

        <v-checkbox
          v-model="playerSettings.showPlayerNames"
          density="comfortable"
          hide-details
          label="Show other player names on their hands"
        />
      </div>

      <div>
        <v-label>Sounds</v-label>

        <v-checkbox
          v-model="playerSettings.soundsEnabled"
          density="comfortable"
          hide-details
          label="Sounds enabled"
        />
        <v-checkbox
          v-model="playerSettings.otherPlayerClickSoundEnabled"
          density="comfortable"
          hide-details
          :disabled="!playerSettings.soundsEnabled"
          label="Piece connect sounds of others"
        />

        <v-slider
          v-model="playerSettings.soundsVolume"
          hide-details
          :disabled="!playerSettings.soundsEnabled"
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
import { PlayerSettingsData } from '../../../common/src/Types'

const props = defineProps<{
  game: GamePlay | GameReplay
}>()

const emit = defineEmits<{
  (e: 'dialogChange', val: any[]): void
}>()

const playerSettings = ref<PlayerSettingsData>(JSON.parse(JSON.stringify(props.game.getPlayerSettings().getSettings())))
const isUkraineColor = ref<boolean>(playerSettings.value.color === 'ukraine')

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
  playerSettings.value.soundsVolume = newVolume
}
const decreaseVolume = (): void => {
  playerSettings.value.soundsVolume = Math.max(0, playerSettings.value.soundsVolume - 5)
}
const increaseVolume = (): void => {
  playerSettings.value.soundsVolume = Math.min(100, playerSettings.value.soundsVolume + 5)
}

// TODO: emit changes only when relevant value changed
const emitChanges = (): void => {
  const newSettings = JSON.parse(JSON.stringify(playerSettings.value))
  if (typeof newSettings.background !== 'string') {
    newSettings.background = newSettings.background.hex
  }
  if (typeof newSettings.color !== 'string') {
    newSettings.color = newSettings.color.hex
  }
  if (isUkraineColor.value) {
    newSettings.color = 'ukraine'
  }
  props.game.getPlayerSettings().apply(newSettings)
  props.game.loadTableTexture(newSettings)
}

watch(isUkraineColor, emitChanges)
watch(playerSettings, () => {
  emitChanges()
}, { deep: true })
</script>
