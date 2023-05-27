<template>
  <v-app-bar>
    <v-btn
      :to="{name: 'admin_games'}"
      prepend-icon="mdi-puzzle"
    >
      Games
    </v-btn>
    <v-btn
      :to="{name: 'admin_images'}"
      prepend-icon="mdi-image"
    >
      Images
    </v-btn>
    <v-btn
      :to="{name: 'admin_users'}"
      prepend-icon="mdi-account"
    >
      Users
    </v-btn>
    <v-btn
      :to="{name: 'admin_groups'}"
      prepend-icon="mdi-account-group"
    >
      Groups
    </v-btn>
    <v-btn
      :to="{name: 'admin_announcements'}"
      prepend-icon="mdi-bullhorn"
    >
      Announcements
    </v-btn>
  </v-app-bar>
</template>
<script setup lang="ts">
// pass
</script>
