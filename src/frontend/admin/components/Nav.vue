<template>
  <ul class="nav">
    <li v-for="(item, idx) in nav" :key="idx">
      <router-link :to="{name: item}">{{item}}</router-link>
    </li>
  </ul>
</template>
<script setup lang="ts">
import { ref } from 'vue'

const nav = ref<string[]>([
  'admin_games',
  'admin_images',
  'admin_users',
  'admin_groups',
])
</script>
