<template>
  <v-container>
    <Nav />
    <h1>Groups</h1>
    <v-table density="compact">
      <thead>
        <tr>
          <th>Id</th>
          <th>Name</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in groups"
          :key="idx"
        >
          <td>{{ item.id }}</td>
          <td>{{ item.name }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import { UserGroupRow } from '../../Types'

const groups = ref<UserGroupRow[]>([])

onMounted(async () => {
  if (user.getMe()) {
    groups.value = await api.admin.getGroups()
  }
  user.eventBus.on('login', async () => {
    groups.value = await api.admin.getGroups()
  })
  user.eventBus.on('logout', () => {
    groups.value = []
  })
})
</script>
