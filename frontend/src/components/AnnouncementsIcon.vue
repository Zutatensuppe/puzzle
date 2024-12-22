<template>
  <v-app-bar-nav-icon
    class="mr-1"
    size="small"
    variant="text"
  >
    <v-badge
      v-if="unseenAnnouncementCount"
      :content="unseenAnnouncementCount"
      color="red-darken-2"
    >
      <v-icon icon="mdi-bullhorn" />
    </v-badge>
    <v-icon
      v-else
      icon="mdi-bullhorn"
    />
  </v-app-bar-nav-icon>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import announcements from '../announcements'

const unseenAnnouncementCount = computed(() => announcements.state.unseenAnnouncementCount)
</script>
