"use strict"

// ingame component
// shows the preview image

export default {
  name: 'preview-overlay',
  template: `
    <div class="overlay" @click="$emit('bgclick')">
      <div class="preview">
        <div class="img" :style="previewStyle"></div>
      </div>
    </div>`,
  props: {
    img: String,
  },
  emits: {
    bgclick: null,
  },
  computed: {
    previewStyle () {
      return {
        backgroundImage: `url('${this.img}')`,
      }
    },
  },
}
