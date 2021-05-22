<template>
  <div>
    <image-teaser v-for="(i,idx) in images" :image="i" @click="imageClicked(i)" @editClick="imageEditClicked(i)" :key="idx" />
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { Image } from '../../common/GameCommon'

import ImageTeaser from './ImageTeaser.vue'

export default defineComponent({
  name: 'image-library',
  components: {
    ImageTeaser,
  },
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
