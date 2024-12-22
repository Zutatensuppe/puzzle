<template>
  <v-navigation-drawer
    v-model="isVisible"
    class="announcements-drawer text-body-2"
    location="right"
    temporary
    width="400"
  >
    <v-list class="pa-0">
      <v-list-item
        v-for="(announcement, idx) in announcements.state.announcements"
        :key="idx"
        class="pt-3 pb-3 pl-5 pr-5"
      >
        <div class="d-flex justify-space-between mb-2">
          <span class="font-weight-bold">
            <span
              v-if="announcements.isNew(announcement)"
              class="text-red-darken-2"
            >
              NEW
            </span>
            {{ announcement.title }}
          </span>
          <span><v-icon icon="mdi-calendar" /> {{ dateformat('YYYY-MM-DD hh:mm', new Date(announcement.created)) }}</span>
        </div>
        <div
          v-for="(line, idx2) of announcement.message.split('\n')"
          :key="idx2"
        >
          {{ line }}
        </div>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { dateformat } from '../../../common/src/Util'
import announcements from '../announcements'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isVisible = ref<boolean>(props.visible)
watch(isVisible, () => {
  if (!isVisible.value) {
    announcements.markAsSeen()
    emit('close')
  }
})

watch(() => props.visible, () => {
  isVisible.value = props.visible
})
</script>
