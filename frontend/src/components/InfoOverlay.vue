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
import { ImageSearchSort, Tag } from '../../../common/src/Types'
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
import { GameInterface } from '../Game'
const router = useRouter()

const props = defineProps<{
  game: GameInterface
}>()

const image = props.game.getImage()

const onTagClick = (tag: Tag): void => {
  const location = router.resolve({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
  window.open(location.href, '_blank')
}

const scoreMode = computed(() => {
  const m = props.game.getScoreMode()
  return [scoreModeToString(m), scoreModeDescriptionToString(m)]
})

const shapeMode = computed(() => {
  const m = props.game.getShapeMode()
  return [shapeModeToString(m), shapeModeDescriptionToString(m)]
})

const snapMode = computed(() => {
  const m = props.game.getSnapMode()
  return [snapModeToString(m), snapModeDescriptionToString(m)]
})

const rotationMode = computed(() => {
  const m = props.game.getRotationMode()
  return [rotationModeToString(m), rotationModeDescriptionToString(m)]
})
</script>
<style scoped>
.v-table { background: transparent; }
</style>
