<template>
  <div>
    <Nav />
    <h1>Users</h1>
    <v-table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Created</th>
          <th>Client Id</th>
          <th>Name</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in users"
          :key="idx"
        >
          <td>{{ item.id }}</td>
          <td>{{ item.created }}</td>
          <td>{{ item.client_id }}</td>
          <td>
            <template v-if="item.name">
              {{ item.name }}
            </template><template v-else>
              -
            </template>
          </td>
          <td>
            <template v-if="item.email">
              {{ item.email }}
            </template><template v-else>
              -
            </template>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'

const users = ref<any[]>([])

onMounted(async () => {
  if (user.getMe()) {
    users.value = await api.admin.getUsers()
  }
  user.eventBus.on('login', async () => {
    users.value = await api.admin.getUsers()
  })
  user.eventBus.on('logout', () => {
    users.value = []
  })
})
</script>
