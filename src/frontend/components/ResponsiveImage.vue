<template>
  <div :style="style" :title="title"></div>
</template>
<script>
export default {
  name: 'responsive-image',
  props: {
    src: String,
    title: {
      type: String,
      default: '',
    },
    height: {
      type: String,
      default: '100%',
    },
    width: {
      type: String,
      default: '100%',
    },
  },
  computed: {
    style() {
      return {
        display: 'inline-block',
        verticalAlign: 'text-bottom',
        backgroundImage: `url('${this.src}')`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        width: this.width,
        height: this.height,
      }
    },
  },
}
</script>
