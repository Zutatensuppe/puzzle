<template>
  <masonry-wall :items="images" :column-width="320" :gap="10">
    <template #default="{ item, index }">
      <image-teaser :image="item" @click="imageClicked(item)" @editClick="imageEditClicked(item)" :key="index" />
    </template>
  </masonry-wall>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { Image } from '../../common/Types'

export default defineComponent({
  props: {
    images: {
      type: Array,
      required: true,
    },
  },
  emits: {
    imageClicked: null,
    imageEditClicked: null,
  },
  methods: {
    imageClicked (image: Image) {
      this.$emit('imageClicked', image)
    },
    imageEditClicked (image: Image) {
      this.$emit('imageEditClicked', image)
    },
  },
})
</script>
