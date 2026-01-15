<template>
  <div
    v-if="canEdit"
    class="avatar"
    :class="{ 'no-avatar': !userAvatar, 'is-clickable': canEdit }"
    :style="avatarStyle"
    @click="onAvatarClick"
  >
    <v-icon
      v-if="canEdit && userAvatar"
      v-tooltip="'Delete this avatar'"
      icon="mdi-trash-can"
      @click.stop="onDeleteAvatarClick"
    />
    <span v-else>
      Click to upload your avatar.
    </span>
  </div>
  <div
    v-else
    class="avatar"
    :class="{ 'no-avatar': !userAvatar }"
    :style="avatarStyle"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { UserAvatar } from '@common/Types'
import { resizeUrl } from '@common/ImageService'

const props = defineProps<{
  canEdit: boolean
  userAvatar: UserAvatar | null
}>()

const emit = defineEmits<{
  (e: 'avatarClick'): void
  (e: 'deleteClick'): void
}>()

const onDeleteAvatarClick = () => {
  if (!props.canEdit) {
    return
  }
  emit('deleteClick')
}

const onAvatarClick = () => {
  if (!props.canEdit) {
    return
  }
  emit('avatarClick')
}

const avatarStyle = computed(() => {
  const imgUrl = props.userAvatar?.url
  if (!imgUrl) {
    return null
  }

  return {
    backgroundImage: `url(${resizeUrl(imgUrl, 400, 400, 'cover')})`,
  }
})
</script>
