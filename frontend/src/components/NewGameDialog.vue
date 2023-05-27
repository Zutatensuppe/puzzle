<template>
  <v-card class="new-game-dialog">
    <v-card-title>New Game</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col :lg="8">
          <div
            class="has-image"
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
        </v-col>
        <v-col
          :lg="4"
          class="area-settings"
        >
          <v-tabs v-model="tab">
            <v-tab value="settings">
              Settings
            </v-tab>
            <v-tab value="image-info">
              Image Info
            </v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <v-window-item value="settings">
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
                  <v-label><v-icon icon="mdi-counter mr-1" /> Scoring</v-label>
                  <v-radio-group
                    v-model="scoreMode"
                    density="comfortable"
                  >
                    <v-radio
                      label="Any (Score when pieces are connected to each other or on final location)"
                      :value="1"
                    />
                    <v-radio
                      label="Final (Score when pieces are put to their final location)"
                      :value="0"
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
                      label="Normal"
                      :value="0"
                    />
                    <v-radio
                      label="Any (Flat pieces can occur anywhere)"
                      :value="1"
                    />
                    <v-radio
                      label="Flat (All pieces flat on all sides)"
                      :value="2"
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
                      label="Normal (Pieces snap to final destination and to each other)"
                      :value="0"
                    />
                    <v-radio
                      label="Real (Pieces snap only to corners, already snapped pieces and to each other)"
                      :value="1"
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
                  />
                </div>

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
              </v-form>
            </v-window-item>
            <v-window-item value="image-info">
              <ImageInfoTable
                :image="image"
                @tag-click="emit('tagClick', $event)"
              />
            </v-window-item>
          </v-window>
        </v-col>
      </v-row>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { GameSettings, ImageInfo, ScoreMode, ShapeMode, SnapMode, Tag } from '../../../common/src/Types'
import { NEWGAME_MIN_PIECES, NEWGAME_MAX_PIECES } from '../../../common/src/GameCommon'
import PuzzleCropper from './PuzzleCropper.vue'
import { determinePuzzleInfo, PuzzleCreationInfo } from '../../../common/src/Puzzle'
import { Rect } from '../../../common/src/Geometry'
import ImageInfoTable from './ImageInfoTable.vue'

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
const scoreMode = ref<ScoreMode>(ScoreMode.ANY)
const shapeMode = ref<ShapeMode>(ShapeMode.NORMAL)
const snapMode = ref<SnapMode>(SnapMode.NORMAL)

const crop = ref<Rect>({ x: 0, y: 0, w: props.image.width, h: props.image.height })

const valid = ref<boolean>(true)

const canStartNewGame = computed((): boolean => {
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
const piecesInt = computed((): number => {
  return parseInt(`${pieces.value}`, 10)
})
const puzzleCreationInfo = computed((): PuzzleCreationInfo => {
  return determinePuzzleInfo({
    w: props.image.width,
    h: props.image.height,
  }, piecesInt.value)
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
  emit('newGame', {
    tiles: piecesInt.value,
    private: isPrivate.value,
    image: props.image,
    scoreMode: scoreModeInt.value,
    shapeMode: shapeModeInt.value,
    snapMode: snapModeInt.value,
    crop: crop.value,
  })
}

const form = ref<any>()

onMounted(() => {
  // @ts-ignore
  form.value.validate()
})
</script>
