<template>
  <v-card class="imageteaser is-clickable" @click="onClick" elevation="10" :style="styles">
    <div class="imageteaser-inner">
      <h4 class="imageteaser-title">
        {{ image.title || '<No Title>' }}
      </h4>
      <div class="imageteaser-info" v-if="image.copyrightName || image.copyrightURL">
        <v-icon icon="mdi-copyright"></v-icon>
        <a :href="image.copyrightURL" v-if="image.copyrightURL" target="_blank" class="ml-1">{{ image.copyrightName || 'Source' }} <v-icon icon="mdi-open-in-new" /></a>
        <span class="ml-1" v-else>{{ image.copyrightName }}</span>
      </div>
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
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { resizeUrl } from '../../common/ImageService';
import { ImageInfo } from '../../common/Types';
import user, { User } from '../user'

const props = withDefaults(defineProps<{
  image: ImageInfo
  edit?: boolean
}>(), {
  edit: true,
})

const emit = defineEmits<{
  (event: 'click'): void
  (event: 'editClick'): void
}>()

const me = ref<User|null>(null)

const url = computed(() => resizeUrl(props.image.url, 375, 0, 'cover'))

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
  if (!props.edit) {
    return false
  }
  if (!me.value || !me.value.id) {
    return false
  }
  return me.value.id === props.image.uploaderUserId
})

const onClick = (ev: Event) => {
  if ((ev.target as HTMLElement).tagName === 'A') {
    return
  }
  emit('click')
}
const onEditClick = () => {
  emit('editClick')
}

const onInit = () => {
  me.value = user.getMe()
}

onMounted(() => {
  onInit()
  user.eventBus.on('login', onInit)
  user.eventBus.on('logout', onInit)
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
  user.eventBus.off('logout', onInit)
})
</script>
