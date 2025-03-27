<template>
  <v-dialog
    :width="width"
    :min-width="minWidth"
    :class="dialogClass"
    v-model="dialogOpen"
  >
    <LoginDialog v-if="currentDialog === 'login-dialog'" />
    <EditImageDialog v-if="currentDialog === 'edit-image-dialog'" />
    <ReportGameDialog v-if="currentDialog === 'report-game-dialog'" />
    <ReportImageDialog v-if="currentDialog === 'report-image-dialog'" />
  </v-dialog>
</template>
<script setup lang="ts">
import { useDialog } from '../useDialog'

import LoginDialog from './dialogs/LoginDialog.vue'
import EditImageDialog from './dialogs/EditImageDialog.vue'
import ReportGameDialog from './dialogs/ReportGameDialog.vue'
import ReportImageDialog from './dialogs/ReportImageDialog.vue'

const { dialogClass, width, minWidth, dialogOpen, currentDialog } = useDialog()
</script>
