<template>
  <div>
    <Nav />
    <div>
      <v-text-field
        v-model="title"
        label="Title"
      />
      <v-textarea
        v-model="message"
        label="Message"
      />
      <v-btn @click="publish">
        Publish
      </v-btn>
    </div>
    <h1>Announcements</h1>
    <v-table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Created</th>
          <th>Title</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in announcements"
          :key="idx"
        >
          <td>{{ item.id }}</td>
          <td>{{ item.created }}</td>
          <td>{{ item.title }}</td>
          <td>{{ item.message }}</td>
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
import { AnnouncementsRow } from '../../Types'

const announcements = ref<AnnouncementsRow[]>([])

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
