<template>
  <v-dialog
    v-model="dialogOpen"
    :width="width"
    :min-width="minWidth"
    :class="currentDialog"
  >
    <LoginDialog v-if="currentDialog === Dialogs.LOGIN_DIALOG" />
    <EditImageDialog v-if="currentDialog === Dialogs.EDIT_IMAGE_DIALOG" />
    <ReportGameDialog v-if="currentDialog === Dialogs.REPORT_GAME_DIALOG" />
    <ReportImageDialog v-if="currentDialog === Dialogs.REPORT_IMAGE_DIALOG" />
    <ReportPlayerDialog v-if="currentDialog === Dialogs.REPORT_PLAYER_DIALOG" />
    <ImageInfoDialog v-if="currentDialog === Dialogs.IMAGE_INFO_DIALOG" />
    <NewImageDialog v-if="currentDialog === Dialogs.NEW_IMAGE_DIALOG" />
    <NewGameDialog v-if="currentDialog === Dialogs.NEW_GAME_DIALOG" />
    <UserAvatarUploadDialog v-if="currentDialog === Dialogs.USER_AVATAR_UPLOAD_DIALOG" />
  </v-dialog>
</template>
<script setup lang="ts">
import { Dialogs, useDialog } from '../useDialog'

import EditImageDialog from './dialogs/EditImageDialog.vue'
import ImageInfoDialog from './dialogs/ImageInfoDialog.vue'
import LoginDialog from './dialogs/LoginDialog.vue'
import NewGameDialog from './dialogs/NewGameDialog.vue'
import NewImageDialog from './dialogs/NewImageDialog.vue'
import ReportGameDialog from './dialogs/ReportGameDialog.vue'
import ReportImageDialog from './dialogs/ReportImageDialog.vue'
import ReportPlayerDialog from './dialogs/ReportPlayerDialog.vue'
import UserAvatarUploadDialog from './dialogs/UserAvatarUploadDialog.vue'

const { width, minWidth, dialogOpen, currentDialog } = useDialog()
</script>
