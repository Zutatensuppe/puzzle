<template>
  <v-table class="image-info-table">
    <tbody>
      <tr><td><v-icon icon="mdi-subtitles-outline" /> Title: </td><td>{{ image.title || '<No Title>' }}</td></tr>
      <tr v-if="image.copyrightURL || image.copyrightName">
        <td><v-icon icon="mdi-copyright" /> Copyright: </td>
        <td>
          <a :href="image.copyrightURL" v-if="image.copyrightURL" target="_blank">{{ image.copyrightName || 'Source' }} <v-icon icon="mdi-open-in-new" /></a>
          <span v-else>{{ image.copyrightName }}</span>
        </td>
      </tr>
      <tr><td><v-icon icon="mdi-account-arrow-up" /> Uploader: </td><td>{{ image.uploaderName || '<Unknown>' }}</td></tr>
      <tr><td><v-icon icon="mdi-account-arrow-up" /> Upload date: </td><td>{{ date }}</td></tr>
      <tr><td><v-icon icon="mdi-ruler-square" /> Dimensions: </td><td>{{ image.width }}x{{ image.height }}</td></tr>
      <tr v-if="image.tags.length"><td><v-icon icon="mdi-tag" /> Tags: </td><td>
        <a
          v-for="(t, idx) in image.tags"
          @click="emit('tagClick', t)"
          class="is-clickable mr-1"
        >{{ t.title }}<span v-if="idx < image.tags.length - 1">,</span></a>
      </td></tr>
      <tr><td><v-icon icon="mdi-puzzle" /> Game count: </td><td>{{ image.gameCount }}</td></tr>
    </tbody>
  </v-table>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ImageInfo, Tag } from '../../common/Types'

const props = defineProps<{
  image: ImageInfo,
}>()

const emit = defineEmits<{
  (e: 'tagClick', val: Tag): void
}>()

const date = computed((): string => {
  // TODO: use date format that is same everywhere
  return new Date(props.image.created).toLocaleDateString()
})
</script>
