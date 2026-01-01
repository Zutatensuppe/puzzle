<template>
  <v-card>
    <v-container :fluid="true">
      <h4>Info about this puzzle</h4>
      <v-table density="compact">
        <tbody>
          <tr>
            <td><v-icon icon="mdi-counter" /> Scoring: </td>
            <td><span :title="snapMode[1]">{{ scoreMode[0] }}</span></td>
          </tr>
          <tr>
            <td><v-icon icon="mdi-shape" /> Shapes: </td>
            <td><span :title="snapMode[1]">{{ shapeMode[0] }}</span></td>
          </tr>
          <tr>
            <td><v-icon icon="mdi-connection" /> Snapping: </td>
            <td><span :title="snapMode[1]">{{ snapMode[0] }}</span></td>
          </tr>
          <tr>
            <td><v-icon icon="mdi-format-rotate-90" /> Rotation: </td>
            <td><span :title="rotationMode[1]">{{ rotationMode[0] }}</span></td>
          </tr>
        </tbody>
      </v-table>
      <h4 class="mt-5">
        Image
      </h4>
      <ImageInfoTable
        :image="image"
        density="compact"
        @tag-click="onTagClick"
      />
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ImageSearchSort } from '@common/Types'
import type { Tag } from '@common/Types'
import ImageInfoTable from '../ImageInfoTable.vue'
import {
  rotationModeDescriptionToString,
  rotationModeToString,
  scoreModeDescriptionToString,
  scoreModeToString,
  shapeModeDescriptionToString,
  shapeModeToString,
  snapModeDescriptionToString,
  snapModeToString,
} from '@common/Util'
const router = useRouter()

import { useDialog } from '../../useDialog'

const { infoGame } = useDialog()

const image = infoGame.value!.getImage()

const onTagClick = (tag: Tag): void => {
  const location = router.resolve({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
  window.open(location.href, '_blank')
}

const scoreMode = computed(() => {
  const m = infoGame.value!.getScoreMode()
  return [scoreModeToString(m), scoreModeDescriptionToString(m)]
})

const shapeMode = computed(() => {
  const m = infoGame.value!.getShapeMode()
  return [shapeModeToString(m), shapeModeDescriptionToString(m)]
})

const snapMode = computed(() => {
  const m = infoGame.value!.getSnapMode()
  return [snapModeToString(m), snapModeDescriptionToString(m)]
})

const rotationMode = computed(() => {
  const m = infoGame.value!.getRotationMode()
  return [rotationModeToString(m), rotationModeDescriptionToString(m)]
})
</script>
<style scoped>
.v-table { background: transparent; }
</style>
