<template>
  <div>
    <Nav />
    USERS
    <table class="data-table">
      <tr>
        <th>Id</th>
        <th>Created</th>
        <!-- <th>Client Id</th>
        <th>Client Secret</th> -->
        <th>Login</th>
        <!-- <th>Pass</th>
        <th>Salt</th> -->
      </tr>
      <tr v-for="(item, idx) in users" :key="idx">
        <td>{{item.id}}</td>
        <td>{{item.created}}</td>
        <!-- <td>{{item.client_id}}</td>
        <td>{{item.client_secret}}</td> -->
        <td><template v-if="item.login">{{item.login}}</template><template v-else>-</template></td>
        <!-- <td>{{item.pass}}</td>
        <td>{{item.salt}}</td> -->
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
