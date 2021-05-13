"use strict"

import GameCommon from './../../common/GameCommon.js'
import Upload from './../components/Upload.vue.js'
import ImageTeaser from './../components/ImageTeaser.vue.js'

export default {
  name: 'new-game-dialog',
  components: {
    Upload,
    ImageTeaser,
  },
  template: `
  <div>
    <h1>New game</h1>
    <table>
      <tr>
        <td><label>Pieces: </label></td>
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
      <tr>
        <td><label>Image: </label></td>
        <td>
          <span v-if="image">
            <img :src="image.url" style="width: 150px;" />
            or
            <upload @uploaded="mediaImgUploaded($event)" accept="image/*" label="Upload an image" />
          </span>
          <span v-else>
            <upload @uploaded="mediaImgUploaded($event)" accept="image/*" label="Upload an image" />
            (or select from below)
          </span>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <button class="btn" :disabled="!canStartNewGame" @click="onNewGameClick">Start new game</button>
        </td>
      </tr>
    </table>

    <h1>Image lib</h1>
    <div>
      <image-teaser v-for="i in images" :image="i" @click="image = i" />
    </div>
  </div>`,
  props: {
    images: Array,
  },
  emits: {
    newGame: null,
  },
  data() {
    return {
      tiles: 1000,
      image: '',
      scoreMode: GameCommon.SCORE_MODE_ANY,
    }
  },
  methods: {
    mediaImgUploaded(j) {
      this.image = j.image
    },
    canStartNewGame () {
      if (!this.tilesInt || !this.image || ![0, 1].includes(this.scoreModeInt)) {
        return false
      }
      return true
    },
    onNewGameClick() {
      this.$emit('newGame', {
        tiles: this.tilesInt,
        image: this.image,
        scoreMode: this.scoreModeInt,
      })
    },
  },
  computed: {
    scoreModeInt () {
      return parseInt(this.scoreMode, 10)
    },
    tilesInt () {
      return parseInt(this.tiles, 10)
    },
  },
}
