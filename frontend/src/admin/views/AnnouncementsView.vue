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
import { onMounted, onUnmounted, ref } from 'vue'
import { me, onLoginStateChange } from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import type { Announcement } from '@common/Types'

const announcements = ref<Announcement[]>([])

const title = ref<string>('')
const message = ref<string>('')
const publish = async () => {
  await api.admin.postAnnouncement(title.value, message.value)
  announcements.value = await api.admin.getAnnouncements()
}

const onInit = async () => {
  announcements.value = me.value ? await api.admin.getAnnouncements() : []
}

let offLoginStateChange: () => void = () => {}
onMounted(async () => {
  await onInit()
  offLoginStateChange = onLoginStateChange(onInit)
})

onUnmounted(() => {
  offLoginStateChange()
})
</script>
