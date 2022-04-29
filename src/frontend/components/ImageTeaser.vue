<template>
  <div class="imageteaser" @click="onClick">
    <img :src="url" />
    <div class="btn edit" v-if="canEdit" @click.stop="onEditClick">
      <icon icon="edit" />
    </div>
    <div class="imageteaser-info">
      {{ image.gameCount }}x plays
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import user from '../user'

export default defineComponent({
  props: {
    image: {
      type: Object,
      required: true,
    },
  },
  data: () => {
    return {
      me: user.getMe(),
    }
  },
  computed: {
    url(): string {
      return this.image.url.replace('uploads/', 'uploads/r/') + '-375x0.webp'
    },
    canEdit(): boolean {
      if (!this.me.id) {
        return false
      }
      return this.me.id === this.image.uploaderUserId
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
