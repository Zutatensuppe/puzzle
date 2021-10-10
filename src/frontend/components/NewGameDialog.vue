<template>
  <div class="overlay new-game-dialog" @click="$emit('bgclick')">
    <div class="overlay-content" @click.stop="">

      <div class="area-image">
        <div class="has-image">
          <responsive-image :src="image.url" :title="image.title" />
        </div>
        <div class="image-title" v-if="image.title || image.width || image.height">
          <span class="image-title-title" v-if="image.title">"{{image.title}}"</span>
          <span class="image-title-dim" v-if="image.width || image.height">({{image.width}} ✕ {{image.height}})</span>
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
              <label><input type="radio" v-model="scoreMode" value="1" />
              Any (Score when pieces are connected to each other or on final location)</label>
              <br />
              <label><input type="radio" v-model="scoreMode" value="0" />
              Final (Score when pieces are put to their final location)</label>
            </td>
          </tr>
          <tr>
            <td><label>Shapes: </label></td>
            <td>
              <label><input type="radio" v-model="shapeMode" value="0" />
              Normal</label>
              <br />
              <label><input type="radio" v-model="shapeMode" value="1" />
              Any (Flat pieces can occur anywhere)</label>
              <br />
              <label><input type="radio" v-model="shapeMode" value="2" />
              Flat (All pieces flat on all sides)</label>
            </td>
          </tr>
          <tr>
            <td><label>Snapping: </label></td>
            <td>
              <label><input type="radio" v-model="snapMode" value="0" />
              Normal (Pieces snap to final destination and to each other)</label>
              <br />
              <label><input type="radio" v-model="snapMode" value="1" />
              Real (Pieces snap only to corners, already snapped pieces and to each other)</label>
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

import { GameSettings, ScoreMode, ShapeMode, SnapMode } from './../../common/Types'

export default defineComponent({
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
      shapeMode: ShapeMode.NORMAL,
      snapMode: SnapMode.NORMAL,
    }
  },
  methods: {
    onNewGameClick () {
      this.$emit('newGame', {
        tiles: this.tilesInt,
        image: this.image,
        scoreMode: this.scoreModeInt,
        shapeMode: this.shapeModeInt,
        snapMode: this.snapModeInt,
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
    shapeModeInt (): number {
      return parseInt(`${this.shapeMode}`, 10)
    },
    snapModeInt (): number {
      return parseInt(`${this.snapMode}`, 10)
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
  display: grid;
  grid-template-rows: 1fr min-content;
  grid-template-areas:
    "image"
    "image-title";
  margin-right: 1em;
}
@media (max-width: 1400px) and (min-height: 720px),
       (max-width: 1000px) {
  .new-game-dialog .overlay-content {
    grid-template-columns: auto;
    grid-template-rows: 1fr min-content min-content;
    grid-template-areas:
      "image"
      "settings"
      "buttons";
  }
  .new-game-dialog .area-image {
    margin-right: 0;
  }
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
  box-sizing: border-box;
  grid-area: image;
  position: relative;
  width: 100%;
  height: 100%;
  border: solid 1px;
}

.new-game-dialog .image-title {
  grid-area: image-title;
  text-align: center;
  padding: .5em 0;
  background: var(--main-color);
  color: #262523;
}

.new-game-dialog .has-image .remove {
  position: absolute;
  top: .5em;
  left: .5em;
}

.new-game-dialog .image-title > span { margin-right: .5em; }
.new-game-dialog .image-title > span:last-child { margin-right: 0; }
.image-title-dim { display: inline-block; white-space: no-wrap; }
</style>
