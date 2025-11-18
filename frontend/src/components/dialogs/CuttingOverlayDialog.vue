<template>
  <v-card class="cutting-overlay-dialog-card">
    <v-container :fluid="true">
      <div class="d-flex justify-center">
        <v-icon icon="mdi-content-cut" />
        <v-icon icon="mdi-puzzle-outline" />
        <div class="ml-2 mr-2">
          Cutting puzzle, please wait...
        </div>
        <v-icon icon="mdi-flip-h mdi-puzzle-outline" />
        <v-icon icon="mdi-flip-h mdi-content-cut" />
      </div>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
// pass
</script>
