<template>
  <v-card
    v-if="confirmDeleteGame && onConfirmDeleteGame"
    class="confirm-delete-game-dialog-card"
  >
    <v-card-title>Delete Game</v-card-title>

    <v-container :fluid="true">
      <img
        :src="resizeUrl(confirmDeleteGame.image.url, 640, 360, 'cover')"
        class="mb-3"
      >
      <p>
        Really delete this game?

        <span class="text-disabled">
          &ndash; Connected players will get disconnected and the game will be gone. Points from this game won't be counted.
        </span>
      </p>
    </v-container>

    <v-card-actions>
      <v-btn
        variant="elevated"
        color="error"
        prepend-icon="mdi-trash-can"
        @click="onConfirmDeleteGame(confirmDeleteGame)"
      >
        Delete Game
      </v-btn>
      <v-btn
        variant="elevated"
        @click="closeDialog"
      >
        Cancel
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import { resizeUrl } from '../../../../common/src/ImageService'

import { useDialog } from '../../useDialog'

const { closeDialog, confirmDeleteGame, onConfirmDeleteGame } = useDialog()
</script>
