<template>
  <div class="imageteaser" @click="onClick">
    <img :src="url" />
    <div class="btn edit" v-if="canEdit" @click.stop="onEditClick">
      <icon icon="edit" />
    </div>
    <div class="imageteaser-info">
      {{ image.gameCount }}x plays
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import user, { User } from '../user'

const props = defineProps({
  image: { type: Object, required: true },
})

const emit = defineEmits<{
  (event: 'click'): void
  (event: 'editClick'): void
}>()

const me = ref<User|null>(null)

const url = computed((): string => {
  return props.image.url.replace('uploads/', 'uploads/r/') + '-375x0.webp'
})

const canEdit = computed((): boolean => {
  if (!me.value || !me.value.id) {
    return false
  }
  return me.value.id === props.image.uploaderUserId
})

const onClick = () => {
  emit('click')
}
const onEditClick = () => {
  emit('editClick')
}

onMounted(async () => {
  me.value = user.getMe()
})
</script>
