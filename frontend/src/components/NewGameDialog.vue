<template>
  <v-card
    class="new-game-dialog"
    height="90vh"
  >
    <v-card-title>New Game</v-card-title>

    <v-container :fluid="true">
      <div class="new-game-dialog-layout">
        <div
          class="area-image has-image"
          style="min-height: 50vh;"
        >
          <PuzzleCropper
            :image="image"
            :puzzle-creation-info="puzzleCreationInfo"
            :shape-mode="shapeMode"
            :pieces-preview="tab === 'settings'"
            @crop-update="onCropUpdate"
          />
        </div>

        <div class="area-settings">
          <v-tabs v-model="tab">
            <v-tab value="settings">
              Settings
            </v-tab>
            <v-tab value="image-info">
              Image Info
            </v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <v-window-item
              value="settings"
              class="window-settings"
            >
              <v-form
                ref="form"
                v-model="valid"
              >
                <fieldset>
                  <legend>Pieces Amount</legend>
                  <v-text-field
                    v-model="pieces"
                    type="number"
                    step="100"
                    min="0"
                    max="5000"
                    density="compact"
                    :rules="[numberRule]"
                    class="pieces-input"
                  />
                  <span>
                    Resulting pieces: {{ valid ? puzzleCreationInfo.pieceCount : '-' }}
                  </span>
                </fieldset>
                <div>
                  <v-label><v-icon icon="mdi-cog-outline mr-1" /> Misc</v-label>
                  <v-checkbox
                    v-model="showImagePreviewInBackground"
                    density="comfortable"
                    label="Show image preview in background"
                    hide-details
                  />
                </div>
                <div>
                  <v-label><v-icon icon="mdi-counter mr-1" /> Scoring</v-label>
                  <v-radio-group
                    v-model="scoreMode"
                    density="comfortable"
                  >
                    <v-radio
                      :label="`${scoreModeToString(ScoreMode.ANY)} (${scoreModeDescriptionToString(ScoreMode.ANY)})`"
                      :value="ScoreMode.ANY"
                    />
                    <v-radio
                      :label="`${scoreModeToString(ScoreMode.FINAL)} (${scoreModeDescriptionToString(ScoreMode.FINAL)})`"
                      :value="ScoreMode.FINAL"
                    />
                  </v-radio-group>
                </div>
                <div>
                  <v-label><v-icon icon="mdi-shape mr-1" /> Shapes</v-label>
                  <v-radio-group
                    v-model="shapeMode"
                    density="comfortable"
                  >
                    <v-radio
                      :label="`${shapeModeToString(ShapeMode.NORMAL)} (${shapeModeDescriptionToString(ShapeMode.NORMAL)})`"
                      :value="ShapeMode.NORMAL"
                    />
                    <v-radio
                      :label="`${shapeModeToString(ShapeMode.ANY)} (${shapeModeDescriptionToString(ShapeMode.ANY)})`"
                      :value="ShapeMode.ANY"
                    />
                    <v-radio
                      :label="`${shapeModeToString(ShapeMode.FLAT)} (${shapeModeDescriptionToString(ShapeMode.FLAT)})`"
                      :value="ShapeMode.FLAT"
                    />
                  </v-radio-group>
                </div>
                <div>
                  <v-label><v-icon icon="mdi-connection mr-1" /> Snapping</v-label>
                  <v-radio-group
                    v-model="snapMode"
                    density="comfortable"
                  >
                    <v-radio
                      :label="`${snapModeToString(SnapMode.NORMAL)} (${snapModeDescriptionToString(SnapMode.NORMAL)})`"
                      :value="SnapMode.NORMAL"
                    />
                    <v-radio
                      :label="`${snapModeToString(SnapMode.REAL)} (${snapModeDescriptionToString(SnapMode.REAL)})`"
                      :value="SnapMode.REAL"
                    />
                  </v-radio-group>
                </div>
                <div>
                  <v-label><v-icon icon="mdi-format-rotate-90 mr-1" /> Rotation</v-label>
                  <v-radio-group
                    v-model="rotationMode"
                    density="comfortable"
                  >
                    <v-radio
                      :label="`${rotationModeToString(RotationMode.NONE)} (${rotationModeDescriptionToString(RotationMode.NONE)})`"
                      :value="RotationMode.NONE"
                    />
                    <v-radio
                      :label="`${rotationModeToString(RotationMode.ORTHOGONAL)} (${rotationModeDescriptionToString(RotationMode.ORTHOGONAL)})`"
                      :value="RotationMode.ORTHOGONAL"
                    />
                  </v-radio-group>
                </div>
                <div>
                  <v-label><v-icon icon="mdi-incognito mr-1" /> Privacy</v-label>
                  <v-checkbox
                    v-model="isPrivate"
                    density="comfortable"
                    label="Private Game (Private games won't show up in the public game overview)"
                    :disabled="forcePrivate"
                    hide-details
                  />
                  <v-checkbox
                    v-model="requireAccount"
                    density="comfortable"
                    label="Require account (Anonymous users won't be able to join)"
                    :disabled="!isPrivate"
                    hide-details
                  />
                  <v-checkbox
                    v-model="requirePassword"
                    density="comfortable"
                    label="Require password to join"
                    :disabled="!isPrivate"
                    hide-details
                  />
                  <v-text-field
                    v-model="joinPassword"
                    label="Join Password"
                    type="password"
                    density="compact"
                    :disabled="!isPrivate || !requirePassword"
                  />
                </div>
              </v-form>
            </v-window-item>
            <v-window-item value="image-info">
              <ImageInfoTable
                :image="image"
                @tag-click="emit('tagClick', $event)"
              />
            </v-window-item>
          </v-window>

          <v-card-actions>
            <v-btn
              variant="elevated"
              :disabled="!canStartNewGame"
              prepend-icon="mdi-puzzle"
              color="success"
              @click="onNewGameClick"
            >
              Generate Puzzle
            </v-btn>
            <v-btn
              variant="elevated"
              color="error"
              @click="emit('close')"
            >
              Cancel
            </v-btn>
          </v-card-actions>
        </div>
      </div>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { RotationMode, ScoreMode, ShapeMode, SnapMode } from '../../../common/src/Types'
import type { GameSettings, ImageInfo, Tag } from '../../../common/src/Types'
import { NEWGAME_MIN_PIECES, NEWGAME_MAX_PIECES } from '../../../common/src/GameCommon'
import PuzzleCropper from './PuzzleCropper.vue'
import { determinePuzzleInfo } from '../../../common/src/Puzzle'
import type { PuzzleCreationInfo } from '../../../common/src/Puzzle'
import type { Rect } from '../../../common/src/Geometry'
import ImageInfoTable from './ImageInfoTable.vue'
import {
  rotationModeDescriptionToString,
  rotationModeToString,
  scoreModeDescriptionToString,
  scoreModeToString,
  shapeModeDescriptionToString,
  shapeModeToString,
  snapModeDescriptionToString,
  snapModeToString,
} from '../../../common/src/Util'

const props = defineProps<{
  image: ImageInfo
}>()

const emit = defineEmits<{
  (e: 'newGame', val: GameSettings): void
  (e: 'tagClick', val: Tag): void
  (e: 'close'): void
}>()

const tab = ref<string>('settings')

const forcePrivate = ref<boolean>(props.image.private)
const pieces = ref<string | number>(1000)
const isPrivate = ref<boolean>(forcePrivate.value)
const showImagePreviewInBackground = ref<boolean>(false)
const requireAccount = ref<boolean>(false)
const requirePassword = ref<boolean>(false)
const joinPassword = ref<string>('')
const scoreMode = ref<ScoreMode>(ScoreMode.ANY)
const shapeMode = ref<ShapeMode>(ShapeMode.NORMAL)
const snapMode = ref<SnapMode>(SnapMode.NORMAL)
const rotationMode = ref<RotationMode>(RotationMode.NONE)

const crop = ref<Rect>({ x: 0, y: 0, w: props.image.width, h: props.image.height })

const valid = ref<boolean>(true)

// prevent clicking the button multiple times
const creating = ref<boolean>(false)

const canStartNewGame = computed((): boolean => {
  if (creating.value) {
    return false
  }
  if (!valid.value) {
    return false
  }
  if (
    !piecesInt.value
    || !props.image
    || !props.image.url
    || ![0, 1].includes(scoreModeInt.value)
  ) {
    return false
  }
  return true
})
const scoreModeInt = computed((): number => {
  return parseInt(`${scoreMode.value}`, 10)
})
const shapeModeInt = computed((): number => {
  return parseInt(`${shapeMode.value}`, 10)
})
const snapModeInt = computed((): number => {
  return parseInt(`${snapMode.value}`, 10)
})
const rotationModeInt = computed((): number => {
  return parseInt(`${rotationMode.value}`, 10)
})
const piecesInt = computed((): number => {
  return parseInt(`${pieces.value}`, 10)
})
const puzzleCreationInfo = computed((): PuzzleCreationInfo => {
  const dim = { w: props.image.width, h: props.image.height }
  return determinePuzzleInfo(dim, piecesInt.value)
})

const numberRule = (v: string) => {
  const num = parseInt(v, 10)
  if (!isNaN(num) && num >= NEWGAME_MIN_PIECES && num <= NEWGAME_MAX_PIECES) {
    return true
  }
  return 'Pieces have to be between 10 and 5000'
}

const onCropUpdate = (newCrop: Rect) => {
  crop.value = newCrop
}

const onNewGameClick = () => {
  creating.value = true

  const isPriv = isPrivate.value
  const reqAccount = isPriv ? requireAccount.value : false
  const joinPass = isPriv && requirePassword.value ? joinPassword.value || null : null
  const gameSettings: GameSettings = {
    tiles: piecesInt.value,
    private: isPriv,
    requireAccount: reqAccount,
    joinPassword: joinPass,
    image: props.image,
    scoreMode: scoreModeInt.value,
    shapeMode: shapeModeInt.value,
    snapMode: snapModeInt.value,
    rotationMode: rotationModeInt.value,
    crop: crop.value,
    showImagePreviewInBackground: showImagePreviewInBackground.value,
  }
  emit('newGame', gameSettings)
}

const form = ref<any>()

onMounted(() => {
  // @ts-ignore
  form.value.validate()
})
</script>
