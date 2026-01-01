<template>
  <div class="user-profile-games-table-div">
    <table class="user-profile-games-table">
      <thead>
        <tr>
          <th>Image</th>
          <th>Pieces</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="game in games"
          :key="game.id"
        >
          <td>
            <a
              :href="`/uploads/${game.image.filename}`"
              target="_blank"
              class="image-holder"
            ><img
              :src="resizeUrl(`/image-service/image/${game.image.filename}`, 150, 100, 'contain')"
              :class="game.image.private ? ['image-private', 'image'] : ['image']"
            ></a>
          </td>
          <td colspan="4">
            {{ game.piecesFinished }}/{{ game.piecesTotal }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import { resizeUrl } from '@common/ImageService'
import type { GameInfo } from '@common/Types'

defineProps<{
  games: GameInfo[],
}>()
</script>
