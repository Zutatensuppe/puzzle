<template>
  <v-card class="report-image-dialog">
    <v-card-title>Report Image</v-card-title>

    <v-container :fluid="true">
      <v-text-field
        v-model="reason"
        placeholder="Optionally provide a reason for reporting this image"
        label="Reason"
      />

      <v-card-actions>
        <v-btn
          variant="elevated"
          color="success"
          prepend-icon="mdi-exclamation-thick"
          @click="submitReport"
        >
          Submit Report
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          @click="emit('close')"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ImageId, ImageInfo } from '../../../common/src/Types'

const props = defineProps<{
  image: ImageInfo
}>()

const emit = defineEmits<{
  (e: 'submit', val: { id: ImageId, reason: string }): void
  (e: 'close'): void
}>()

const reason = ref<string>('')

const init = (_image: ImageInfo) => {
  // nothing to do for now
}

const submitReport = () => {
  emit('submit', {
    id: props.image.id,
    reason: reason.value,
  })
}

init(props.image)
watch(() => props.image, (newValue) => {
  init(newValue)
})
</script>
