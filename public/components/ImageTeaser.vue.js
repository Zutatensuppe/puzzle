"use strict"

export default {
  name: 'image-teaser',
  props: {
    image: Object
  },
  template: `<div class="imageteaser" :style="style" @click="onClick"></div>`,
  computed: {
    style() {
      const url = this.image.url.replace('uploads/', 'uploads/r/') + '-150x100.webp'
      return {
        'background-image': `url("${url}")`,
      }
    },
  },
  methods: {
    onClick() {
      this.$emit('click')
    },
  },
}
