<template>
  <v-card>
    <v-container :fluid="true">
      <div class="headline d-flex">
        <h4 class="justify-start">
          Settings
        </h4>
        <div class="justify-end">
          <div
            v-if="me && loggedIn"
            class="user-welcome-message"
          >
            Hello, {{ me.name }}
            <v-btn
              @click="logout"
            >
              Logout
            </v-btn>
          </div>
          <v-btn
            v-else
            size="small"
            class="ml-1"
            @click="login"
          >
            Login
          </v-btn>
        </div>
      </div>

      <fieldset>
        <legend>Player</legend>

        <v-text-field
          v-model="playerSettings.name"
          hide-details
          max-length="16"
          density="compact"
          label="Display Name"
        />

        <v-checkbox
          v-model="playerSettings.showPlayerNames"
          density="comfortable"
          hide-details
          label="Show other player names on their hands"
        />

        <div class="d-flex">
          <v-label>Color</v-label>
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
      </fieldset>

      <fieldset>
        <legend>Table</legend>
        <div class="d-flex">
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

        <v-label>Background Color</v-label>
        <IngameColorPicker
          v-model="playerSettings.background"
          @open="onColorPickerOpen"
          @close="onColorPickerClose"
        />
      </fieldset>

      <fieldset>
        <legend>Sounds</legend>

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
          @update:model-value="updateVolume"
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
      </fieldset>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GamePlay } from '../GamePlay'
import { GameReplay } from '../GameReplay'

import IngameColorPicker from './IngameColorPicker.vue'
import { PlayerSettingsData } from '../../../common/src/Types'
import user, { User } from '../user'

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
  const newSettings: PlayerSettingsData = JSON.parse(JSON.stringify(playerSettings.value))
  if (isUkraineColor.value) {
    newSettings.color = 'ukraine'
  }
  props.game.getPlayerSettings().apply(newSettings)
  props.game.loadTableTexture(newSettings)
}

const me = ref<User|null>(null)

const loggedIn = computed(() => {
  return !!(me.value && me.value.type === 'user')
})

async function logout() {
  await user.logout()
}

const onInit = () => {
  me.value = user.getMe()
}

const login = () => {
  user.eventBus.emit('triggerLoginDialog')
}

onMounted(() => {
  onInit()
  user.eventBus.on('login', onInit)
  user.eventBus.on('logout', onInit)
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
  user.eventBus.off('logout', onInit)
})

watch(isUkraineColor, emitChanges)
watch(playerSettings, () => {
  emitChanges()
}, { deep: true })
</script>
