<template>
  <v-card class="image-info-dialog">
    <v-card-title>Image Info</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col :lg="8">
          <div
            class="has-image"
            style="min-height: 50vh;"
          >
            <ResponsiveImage
              :src="image.url"
              :title="image.title"
            />
          </div>
        </v-col>
        <v-col
          :lg="4"
          class="area-settings"
        >
          <ImageInfoTable
            :image="image"
            @tag-click="emit('tagClick', $event)"
          />
          <v-card-actions>
            <v-btn
              variant="elevated"
              @click="emit('close')"
            >
              Close
            </v-btn>
          </v-card-actions>
        </v-col>
      </v-row>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ImageInfo, Tag } from './../../../common/src/Types'
import ImageInfoTable from './ImageInfoTable.vue'
import ResponsiveImage from './ResponsiveImage.vue'

defineProps<{
  image: ImageInfo
}>()

const emit = defineEmits<{
  (e: 'tagClick', val: Tag): void
  (e: 'close'): void
}>()
</script>
