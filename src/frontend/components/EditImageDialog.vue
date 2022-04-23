<template>
  <overlay class="edit-image-dialog">
    <template v-slot:default>
      <div class="area-image">
        <div class="has-image">
          <responsive-image :src="image.url" :title="image.title" />
        </div>
      </div>

      <div class="area-settings">
        <table>
          <tr>
            <td><label>Title</label></td>
            <td><input type="text" v-model="title" placeholder="Flower by @artist" /></td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="hint">Feel free to leave a credit to the artist/photographer in the title :)</div>
            </td>
          </tr>
          <tr>
            <td><label>Tags</label></td>
            <td>
              <tags-input v-model="tags" :autocompleteTags="autocompleteTags" />
            </td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <button class="btn" @click="saveImage"><i class="icon icon-preview" /> Save image</button>
        <button class="btn" @click="$emit('close')">Cancel</button>
      </div>
    </template>
  </overlay>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Image, Tag } from '../../common/Types'

export default defineComponent({
  props: {
    image: {
      type: Object as PropType<Image>,
      required: true,
    },
    autocompleteTags: {
      type: Function,
    },
  },
  emits: ['saveClick', 'close'],
  data () {
    return {
      title: '',
      tags: [] as string[],
    }
  },
  watch: {
    image(newValue, oldValue) {
      this.init(newValue)
    },
  },
  created () {
    this.init(this.image)
  },
  methods: {
    init(image: Image) {
      this.title = image.title
      this.tags = image.tags.map((t: Tag) => t.title)
    },
    saveImage () {
      this.$emit('saveClick', {
        id: this.image.id,
        title: this.title,
        tags: this.tags,
      })
    },
  },
})
</script>

// TODO: scoped vs .edit-image-dialog
<style lang="scss">
.edit-image-dialog {
  .overlay-content {
    display: grid;
    grid-template-columns: auto 450px;
    grid-template-rows: auto;
    grid-template-areas:
      "image settings"
      "image buttons";
    height: 90%;
    width: 80%;
  }
  @media (max-width: 1400px) and (min-height: 720px),
        (max-width: 1000px) {
    .overlay-content {
      grid-template-columns: auto;
      grid-template-rows: 1fr min-content min-content;
      grid-template-areas:
        "image"
        "settings"
        "buttons";
    }
  }
  .area-image {
    grid-area: image;
    margin: 20px;

    .has-image {
      position: relative;
      width: 100%;
      height: 100%;
    }
  }

  .area-settings {
    grid-area: settings;

    table input[type="text"] {
      width: 100%;
      box-sizing: border-box;
    }
  }

  .area-buttons {
    align-self: end;
    grid-area: buttons;

    button {
      width: 100%;
      margin-top: .5em;
    }
  }
}
</style>
