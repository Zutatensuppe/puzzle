<template>
  <div>
    <Nav />
    GROUPS
    <table class="data-table">
      <tr>
        <th>Id</th>
        <th>Name</th>
      </tr>
      <tr v-for="(item, idx) in groups" :key="idx">
        <td>{{item.id}}</td>
        <td>{{item.name}}</td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import { getGroups } from '../api';
import Nav from '../components/Nav.vue'

const groups = ref<any[]>([])

onMounted(async () => {
  if (user.getMe()?.loggedIn) {
    groups.value = await getGroups()
  }
  user.eventBus.on('login', async () => {
    groups.value = await getGroups()
  })
  user.eventBus.on('logout', () => {
    groups.value = []
  })
})
</script>
