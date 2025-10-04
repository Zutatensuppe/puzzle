<template>
  <v-dialog
    v-model="dialogOpen"
    :width="width"
    :min-width="minWidth"
    :class="dialogClass"
  >
    <LoginDialog v-if="currentDialog === 'login-dialog'" />
    <EditImageDialog v-if="currentDialog === 'edit-image-dialog'" />
    <ReportGameDialog v-if="currentDialog === 'report-game-dialog'" />
    <ReportImageDialog v-if="currentDialog === 'report-image-dialog'" />
    <ReportPlayerDialog v-if="currentDialog === 'report-player-dialog'" />
    <ImageInfoDialog v-if="currentDialog === 'image-info-dialog'" />
    <NewImageDialog v-if="currentDialog === 'new-image-dialog'" />
    <NewGameDialog v-if="currentDialog === 'new-game-dialog'" />
  </v-dialog>
</template>
<script setup lang="ts">
import { useDialog } from '../useDialog'

import EditImageDialog from './dialogs/EditImageDialog.vue'
import ImageInfoDialog from './dialogs/ImageInfoDialog.vue'
import LoginDialog from './dialogs/LoginDialog.vue'
import NewGameDialog from './dialogs/NewGameDialog.vue'
import NewImageDialog from './dialogs/NewImageDialog.vue'
import ReportGameDialog from './dialogs/ReportGameDialog.vue'
import ReportImageDialog from './dialogs/ReportImageDialog.vue'
import ReportPlayerDialog from './dialogs/ReportPlayerDialog.vue'

const { dialogClass, width, minWidth, dialogOpen, currentDialog } = useDialog()
</script>
