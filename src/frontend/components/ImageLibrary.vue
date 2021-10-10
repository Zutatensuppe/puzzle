<template>
  <div>
    <image-teaser v-for="(i,idx) in images" :image="i" @click="imageClicked(i)" @editClick="imageEditClicked(i)" :key="idx" />
  </div>
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
