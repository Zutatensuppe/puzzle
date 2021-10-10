<template>
  <div
    class="imageteaser"
    :style="style"
    @click="onClick">
    <div class="btn edit" v-if="canEdit" @click.stop="onEditClick">✏️</div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  props: {
    image: {
      type: Object,
      required: true,
    },
  },
  computed: {
    style(): object {
      const url = this.image.url.replace('uploads/', 'uploads/r/') + '-150x100.webp'
      return {
        'backgroundImage': `url("${url}")`,
      }
    },
    canEdit(): boolean {
      if (!this.$me.id) {
        return false
      }
      return this.$me.id === this.image.uploaderUserId
    },
  },
  emits: {
    click: null,
    editClick: null,
  },
  methods: {
    onClick() {
      this.$emit('click')
    },
    onEditClick() {
      this.$emit('editClick')
    },
  },
})
</script>
<style type="css">
.imageteaser { position: relative; }
.imageteaser .edit { display: none; position: absolute; }
.imageteaser:hover .edit { display: inline-block; }
</style>
