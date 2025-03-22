<template>
  <div
    class="imageteaser-holder is-clickable"
    :class="{ 'image-is-private': image.private, hoverable }"
  >
    <div
      v-if="showNsfwInfo"
      class="teaser-nsfw-information"
      @click.stop="toggleNsfwItem(`${image.id}`)"
    >
      😳 NSFW (click to show)
    </div>
    <v-card
      class="imageteaser"
      elevation="10"
      :style="styles"
      @click="onClick"
    >
      <div class="imageteaser-inner">
        <div
          v-if="image.private"
          class="imageteaser-info image-is-private-info"
        >
          <v-icon icon="mdi-incognito" /> Private Image
        </div>
        <h4 class="imageteaser-title">
          {{ image.title || '<No Title>' }}
        </h4>

        <div
          v-tooltip="'Report this image'"
          class="imageteaser-report"
          @click.stop="onReportClick"
        >
          <v-icon icon="mdi-exclamation-thick" />
        </div>

        <div
          v-if="image.copyrightName || image.copyrightURL"
          class="imageteaser-info"
        >
          <v-icon icon="mdi-copyright" />
          <a
            v-if="image.copyrightURL"
            :href="image.copyrightURL"
            target="_blank"
            class="ml-1"
          >{{ image.copyrightName || 'Source' }} <v-icon icon="mdi-open-in-new" /></a>
          <span
            v-else
            class="ml-1"
          >{{ image.copyrightName }}</span>
        </div>
        <div class="imageteaser-info">
          <v-icon icon="mdi-motion-play" /> {{ image.gameCount }}x plays
        </div>
        <div class="imageteaser-info">
          <v-icon icon="mdi-calendar-month" /> {{ date }}
        </div>
        <div class="imageteaser-info">
          <v-icon icon="mdi-ruler-square" /> {{ image.width }}x{{ image.height }}
        </div>
        <div
          v-if="image.tags.length"
          class="imageteaser-info"
        >
          <v-icon icon="mdi-tag" /> {{ image.tags.map((t: Tag) => t.title).join(', ') }}
        </div>
        <div class="imageteaser-click-info">
          <h5>Click to setup a game</h5>
        </div>
        <div class="imageteaser-actions">
          <v-btn
            v-if="canEdit"
            variant="text"
            icon="mdi-pencil"
            size="x-small"
            class="imageteaser-edit"
            @click.stop="onEditClick"
          />
        </div>
      </div>
    </v-card>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { resizeUrl } from '../../../common/src/ImageService'
import { ImageInfo, Tag } from '../../../common/src/Types'
import user, { useNsfw, User } from '../user'

const { showNsfw, toggleNsfwItem, nsfwItemsVisible } = useNsfw()
const hoverable = computed(() => (!props.image.nsfw || showNsfw.value || nsfwItemsVisible.value.includes(`${props.image.id}`)))
const showNsfwInfo = computed(() => props.image.nsfw && !showNsfw.value && !nsfwItemsVisible.value.includes(`${props.image.id}`))

const props = withDefaults(defineProps<{
  image: ImageInfo
  edit?: boolean
}>(), {
  edit: true,
})

const emit = defineEmits<{
  (event: 'click'): void
  (event: 'editClick'): void
  (event: 'reportClick'): void
}>()

const me = ref<User|null>(null)

const url = computed(() => resizeUrl(props.image.url, 375, 0, 'cover'))

const MIN_HEIGHT = 300

const styles = computed(() => ({
  paddingTop: (Math.max(MIN_HEIGHT, props.image.height) / props.image.width * 100) + '%',
  backgroundImage: `url('${url.value}')`,
  backgroundSize: 'cover',
  backgroundPosition: '50% 50%',
}))

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
  const target = ev.target as HTMLElement
  if (
    target.tagName === 'A'
    || (target.parentElement && target.parentElement.tagName === 'A')
  ) {
    return
  }
  emit('click')
}

const onEditClick = () => {
  emit('editClick')
}

const onReportClick = () => {
  emit('reportClick')
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
