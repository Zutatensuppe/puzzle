<template>
  <label>
    <input type="file" style="display: none" @change="upload" :accept="accept" />
    <span class="btn">{{label || 'Upload File'}}</span>
  </label>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import xhr from '../xhr'

export default defineComponent({
  name: 'upload',
  props: {
    accept: String,
    label: String,
  },
  methods: {
    async upload(evt: Event) {
      const target = (evt.target as HTMLInputElement)
      if (!target.files) return;
      const file = target.files[0]
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file, file.name);
      const res = await xhr.post('/upload', {
        body: formData,
      })
      const j = await res.json()
      this.$emit('uploaded', j)
    },
  }
})
</script>
