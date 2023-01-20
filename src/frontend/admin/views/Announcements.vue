<template>
  <div>
    <Nav />
    <div>
      <v-text-field v-model="title" label="Title"></v-text-field>
      <v-textarea v-model="message" label="Message"></v-textarea>
      <v-btn @click="publish">Publish</v-btn>
    </div>

    Announcements
    <table class="data-table">
      <tr>
        <th>Id</th>
        <th>Created</th>
        <th>Message</th>
      </tr>
      <tr v-for="(item, idx) in announcements" :key="idx">
        <td>{{ item.id }}</td>
        <td>{{ item.created }}</td>
        <td>{{ item.message }}</td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import api from '../../_api';
import Nav from '../components/Nav.vue'

const announcements = ref<any[]>([])

const title = ref<string>('')
const message = ref<string>('')
const publish = async () => {
  await api.admin.postAnnouncement(title.value, message.value)
  announcements.value = await api.admin.getAnnouncements()
}

onMounted(async () => {
  if (user.getMe()) {
    announcements.value = await api.admin.getAnnouncements()
  }
  user.eventBus.on('login', async () => {
    announcements.value = await api.admin.getAnnouncements()
  })
  user.eventBus.on('logout', () => {
    announcements.value = []
  })
})
</script>
