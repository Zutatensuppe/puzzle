<template>
  <v-card class="imageteaser is-clickable" @click="onClick" elevation="10" :style="styles">
    <div class="imageteaser-inner">
      <h4 class="imageteaser-title">
        {{ image.title || '<No Title>' }}
      </h4>
      <div class="imageteaser-info">
        <v-icon icon="mdi-motion-play"></v-icon> {{ image.gameCount }}x plays
      </div>
      <div class="imageteaser-info">
        <v-icon icon="mdi-calendar-month"></v-icon> {{ date }}
      </div>
      <div class="imageteaser-info">
        <v-icon icon="mdi-ruler-square"></v-icon> {{ image.width }}x{{ image.height }}
      </div>
      <div class="imageteaser-info" v-if="image.tags.length">
        <v-icon icon="mdi-tag"></v-icon> {{ image.tags.map(t => t.title).join(', ') }}
      </div>
      <div class="imageteaser-click-info">
        <h5>Click to setup a game</h5>
      </div>
      <div class="imageteaser-actions">
        <v-btn
          variant="text"
          v-if="canEdit"
          @click.stop="onEditClick"
          icon="mdi-pencil"
          size="x-small"
          class="imageteaser-edit"
        ></v-btn>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ImageInfo } from '../../common/Types';
import user, { User } from '../user'

const props = defineProps<{
  image: ImageInfo
}>()

const emit = defineEmits<{
  (event: 'click'): void
  (event: 'editClick'): void
}>()

const me = ref<User|null>(null)

const url = computed((): string => {
  return props.image.url.replace('uploads/', 'uploads/r/') + '-375x0.webp'
})

const styles = computed(() => {
  return {
    paddingTop: (props.image.height / props.image.width * 100) + '%',
    backgroundImage: `url('${url.value}')`,
    backgroundSize: 'cover',
  }
})

const date = computed((): string => {
  // TODO: use date format that is same everywhere
  return new Date(parseInt(`${props.image.created}`, 10)).toLocaleDateString()
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
