<template>
  <v-card
    v-if="imageInfoImage"
    class="image-info-dialog"
  >
    <v-card-title>Image Info</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col :lg="8">
          <div
            class="has-image"
            style="min-height: 50vh;"
          >
            <ResponsiveImage
              :src="imageInfoImage.url"
              :title="imageInfoImage.title"
            />
          </div>
        </v-col>
        <v-col
          :lg="4"
          class="area-settings"
        >
          <ImageInfoTable
            :image="imageInfoImage"
            @tag-click="onTagClick"
          />
          <v-card-actions>
            <v-btn
              variant="elevated"
              @click="closeDialog"
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
import { ImageSearchSort } from './../../../../common/src/Types'
import type { Tag } from './../../../../common/src/Types'
import ImageInfoTable from '../ImageInfoTable.vue'
import ResponsiveImage from '../ResponsiveImage.vue'
import { useDialog } from '../../useDialog'
import { useRouter } from 'vue-router'

const { closeDialog, imageInfoImage } = useDialog()
const router = useRouter()

const onTagClick = (tag: Tag) => {
  closeDialog()
  void router.push({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
}
</script>
