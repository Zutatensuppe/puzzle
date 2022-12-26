<template>
  <v-app id="app" :theme="'dark'">
    <v-layout>
      <Nav />
      <v-main>
        <router-view />
      </v-main>
    </v-layout>
  </v-app>
</template>
<script setup lang="ts">
import Nav from './components/Nav.vue'
</script>
