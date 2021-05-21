<template>
  <div class="overlay new-game-dialog" @click="$emit('bgclick')">
    <div class="overlay-content" @click.stop="">

      <div class="area-image">
        <div class="has-image">
          <responsive-image :src="image.url" :title="image.title" />
        </div>
      </div>

      <div class="area-settings">
        <table>
          <tr>
            <td><label>Pieces</label></td>
            <td><input type="text" v-model="tiles" /></td>
          </tr>
          <tr>
            <td><label>Scoring: </label></td>
            <td>
              <label><input type="radio" v-model="scoreMode" value="1" /> Any (Score when pieces are connected to each other or on final location)</label>
              <br />
              <label><input type="radio" v-model="scoreMode" value="0" /> Final (Score when pieces are put to their final location)</label>
            </td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <button class="btn" :disabled="!canStartNewGame" @click="onNewGameClick">
          🧩 Generate Puzzle
        </button>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import { GameSettings, ScoreMode } from './../../common/GameCommon'
import ResponsiveImage from './ResponsiveImage.vue'

export default defineComponent({
  name: 'new-game-dialog',
  components: {
    ResponsiveImage,
  },
  props: {
    image: {
      type: Object,
      required: true,
    },
  },
  emits: {
    newGame: null,
    bgclick: null,
  },
  data() {
    return {
      tiles: 1000,
      scoreMode: ScoreMode.ANY,
    }
  },
  methods: {
    onNewGameClick () {
      this.$emit('newGame', {
        tiles: this.tilesInt,
        image: this.image,
        scoreMode: this.scoreModeInt,
      } as GameSettings)
    },
  },
  computed: {
    canStartNewGame () {
      if (
        !this.tilesInt
        || !this.image
        || !this.image.url
        || ![0, 1].includes(this.scoreModeInt)
      ) {
        return false
      }
      return true
    },
    scoreModeInt (): number {
      return parseInt(`${this.scoreMode}`, 10)
    },
    tilesInt (): number {
      return parseInt(`${this.tiles}`, 10)
    },
  },
})
</script>


// TODO: scoped vs .new-game-dialog
<style>
.new-game-dialog .overlay-content {
  display: grid;
  grid-template-columns: auto 450px;
  grid-template-rows: auto;
  grid-template-areas:
    "image settings"
    "image buttons";
  height: 90%;
  width: 80%;
}
.new-game-dialog .area-image {
  grid-area: image;
  margin: 20px;
}
.new-game-dialog .area-settings {
  grid-area: settings;
}
.new-game-dialog .area-settings table input[type="text"] {
  width: 100%;
  box-sizing: border-box;
}

.new-game-dialog .area-buttons {
  align-self: end;
  grid-area: buttons;
}
.new-game-dialog .area-buttons button {
  width: 100%;
}
.new-game-dialog .has-image {
  position: relative;
  width: 100%;
  height: 100%;
}
.new-game-dialog .has-image .remove {
  position: absolute;
  top: .5em;
  left: .5em;
}
</style>
