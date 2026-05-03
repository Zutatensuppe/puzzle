<template>
  <div class="d-flex ga-1">
    <v-btn
      size="x-small"
      @click="onTogglePrivate"
    >
      {{ image.private ? 'SET PUBLIC' : 'SET PRIVATE' }}
    </v-btn>
    <v-btn
      size="x-small"
      @click="onToggleNsfw"
    >
      {{ image.nsfw ? 'UNSET NSFW' : 'SET NSFW' }}
    </v-btn>
    <v-btn
      size="x-small"
      @click="onToggleAi"
    >
      {{ image.ai_generated ? 'UNSET AI' : 'SET AI' }}
    </v-btn>
    <v-btn
      v-if="!IMAGE_STATES_TRUSTED.includes(image.state)"
      size="x-small"
      color="success"
      @click="onApprove"
    >
      APPROVE
    </v-btn>
    <v-btn
      v-if="!IMAGE_STATES_REJECTED.includes(image.state)"
      size="x-small"
      color="error"
      @click="onReject"
    >
      REJECT
    </v-btn>
    <v-btn
      size="x-small"
      @click="onDelete"
    >
      DELETE
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { IMAGE_STATES_TRUSTED, IMAGE_STATES_REJECTED, ImageState } from '@common/Types'
import type { ImageRowWithCount } from '@common/Types'
import api from '../../_api'

const props = defineProps<{
  image: ImageRowWithCount
}>()

const emit = defineEmits<{
  (e: 'updated', patch: Partial<ImageRowWithCount>): void
  (e: 'deleted'): void
}>()

const onTogglePrivate = async () => {
  const newValue = !props.image.private
  const resp = await api.admin.setImagePrivate(props.image.id, newValue)
  if ('error' in resp || !resp.ok) {
    alert('Toggling private failed!')
  } else {
    emit('updated', { private: newValue ? 1 : 0 })
  }
}

const onToggleNsfw = async () => {
  const newValue = !props.image.nsfw
  const resp = await api.admin.setImageNsfw(props.image.id, newValue)
  if ('error' in resp || !resp.ok) {
    alert('Toggling NSFW failed!')
  } else {
    emit('updated', { nsfw: newValue ? 1 : 0 })
  }
}

const onToggleAi = async () => {
  const newValue = props.image.ai_generated ? 0 : 1
  const resp = await api.admin.setImageAiGenerated(props.image.id, newValue)
  if ('error' in resp || !resp.ok) {
    alert('Toggling AI-generated failed!')
  } else {
    emit('updated', { ai_generated: newValue })
  }
}

const onApprove = async () => {
  const resp = await api.admin.approveImage(props.image.id)
  if ('error' in resp || !resp.ok) {
    alert('Approving image failed!')
  } else {
    emit('updated', { state: ImageState.Approved })
  }
}

const onReject = async () => {
  const reason = prompt('Rejection reason (optional):')
  if (reason === null) {
    return
  }
  const resp = await api.admin.rejectImage(props.image.id, reason)
  if ('error' in resp || !resp.ok) {
    alert('Rejecting image failed!')
  } else {
    emit('updated', { state: ImageState.Rejected })
  }
}

const onDelete = async () => {
  if (!confirm(`Really delete image ${props.image.id}?`)) {
    return
  }
  const resp = await api.admin.deleteImage(props.image.id)
  if ('error' in resp || !resp.ok) {
    alert('Deleting image failed!')
  } else {
    emit('deleted')
  }
}
</script>
