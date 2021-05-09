"use strict"

import GameCommon from './../../common/GameCommon.js'
import Time from './../../common/Time.js'
import Upload from './../components/Upload.vue.js'
import GameTeaser from './../components/GameTeaser.vue.js'
import ImageTeaser from './../components/ImageTeaser.vue.js'

export default {
  components: {
    Upload,
    GameTeaser,
    ImageTeaser,
  },
  template: `
<div id="app">
  <h1>Running games</h1>
  <div class="game-teaser-wrap" v-for="g in gamesRunning">
    <game-teaser :game="g" />
  </div>

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
        <button class="btn" :disabled="!canStartNewGame" :class="" @click="onNewGameClick">Start new game</button>
      </td>
    </tr>
  </table>

  <h1>Image lib</h1>
  <div>
    <image-teaser v-for="i in images" :image="i" @click="image = i" />
  </div>

  <h1>Finished games</h1>
  <div class="game-teaser-wrap" v-for="g in gamesFinished">
    <game-teaser :game="g" />
  </div>
</div>`,
  data() {
    return {
      tiles: 1000,
      image: '',
      scoreMode: GameCommon.SCORE_MODE_ANY,

      gamesRunning: [],
      gamesFinished: [],
      images: [],
    }
  },
  async created() {
    const res = await fetch('/api/index-data')
    const json = await res.json()
    this.gamesRunning = json.gamesRunning
    this.gamesFinished = json.gamesFinished
    this.images = json.images
  },
  computed: {
    scoreModeInt () {
      return parseInt(this.scoreMode, 10)
    },
    tilesInt () {
      return parseInt(this.tiles, 10)
    },
    canStartNewGame () {
      if (!this.tilesInt || !this.image || ![0, 1].includes(this.scoreModeInt)) {
        return false
      }
      return true
    },
  },
  methods: {
    time(start, end) {
      const icon = end ? '🏁' : '⏳'
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${icon} ${timeDiffStr}`
    },
    mediaImgUploaded(j) {
      this.image = j.image
    },
    async onNewGameClick() {
      const res = await fetch('/newgame', {
        method: 'post',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tiles: this.tilesInt,
          image: this.image,
          scoreMode: this.scoreModeInt,
        }),
      })
      if (res.status === 200) {
        const game = await res.json()
        location.assign(game.url)
      }
    }
  }
}
