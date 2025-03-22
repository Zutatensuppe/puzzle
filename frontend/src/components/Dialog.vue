<template>
  <v-dialog
    :width="width"
    :min-width="minWidth"
    v-model="dialogOpen"
  >
    <LoginDialog v-if="currentDialog === 'login-dialog'" />
  </v-dialog>
</template>
<script setup lang="ts">
import { useDialog } from '../useDialog'

import LoginDialog from './dialogs/LoginDialog.vue'

const { width, minWidth, dialogOpen, currentDialog } = useDialog()
</script>
