<template>
  <div>
    <Nav />
    USERS
    <table class="data-table">
      <tr>
        <th>Id</th>
        <th>Created</th>
        <th>Login</th>
      </tr>
      <tr v-for="(item, idx) in users" :key="idx">
        <td>{{item.id}}</td>
        <td>{{item.created}}</td>
        <td><template v-if="item.login">{{item.login}}</template><template v-else>-</template></td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import api from '../../_api';
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
