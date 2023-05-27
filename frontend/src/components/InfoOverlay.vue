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
import { ImageSearchSort, ScoreMode, ShapeMode, SnapMode, Tag } from '../../../common/src/Types'
import { GamePlay } from '../GamePlay'
import { GameReplay } from '../GameReplay'
import ImageInfoTable from './ImageInfoTable.vue'
const router = useRouter()

const props = defineProps<{
  game: GamePlay | GameReplay
}>()

const image = props.game.getImage()

const onTagClick = (tag: Tag): void => {
  const location = router.resolve({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
  window.open(location.href, '_blank')
}

const scoreMode = computed(() => {
  switch (props.game.getScoreMode()) {
    case ScoreMode.ANY: return ['Any', 'Score when pieces are connected to each other or on final location']
    case ScoreMode.FINAL:
    default: return ['Final', 'Score when pieces are put to their final location']
  }
})

const shapeMode = computed(() => {
  switch (props.game.getShapeMode()) {
    case ShapeMode.FLAT: return ['Flat', 'All pieces flat on all sides']
    case ShapeMode.ANY: return ['Any', 'Flat pieces can occur anywhere']
    case ShapeMode.NORMAL:
    default:
      return ['Normal', '']
  }
})

const snapMode = computed(() => {
  switch (props.game.getSnapMode()) {
    case SnapMode.REAL: return ['Real', 'Pieces snap only to corners, already snapped pieces and to each other']
    case SnapMode.NORMAL:
    default:
      return ['Normal', 'Pieces snap to final destination and to each other']
  }
})
</script>
<style scoped>
.v-table { background: transparent; }
</style>
