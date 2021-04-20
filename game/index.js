import Time from '../common/Time.js'

const Upload = {
  name: 'upload',
  props: {
    accept: String,
    label: String,
  },
  template: `
<label>
    <input type="file" style="display: none" @change="upload" :accept="accept" />
    <span class="btn">{{label || 'Upload File'}}</span>
</label>
`,
  methods: {
    async upload(evt) {
      const file = evt.target.files[0]
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file, file.name);
      const res = await fetch('/upload', {
        method: 'post',
        body: formData,
      })
      const j = await res.json()
      this.$emit('uploaded', j)
    },
  }
}

const GameTeaser = {
  name: 'gameteaser',
  props: {
    game: Object,
  },
  template: `
  <div class="game-teaser" :style="'background-image: url('+game.imageUrl+')'">
    <a class="game-info" :href="'/g/' + game.id">
      <span class="game-info-text">
        🧩 {{game.tilesFinished}}/{{game.tilesTotal}}<br />
        👥 {{game.players}}<br />
        {{time(game.started, game.finished)}}<br />
      </span>
    </a>
    <a v-if="game.hasReplay" class="game-replay" :href="'/replay/' + game.id">
      ↪️ Watch replay
    </a>
  </div>`,
  methods: {
    time(start, end) {
      const icon = end ? '🏁' : '⏳'
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${icon} ${timeDiffStr}`
    },
  },
}

export default {
  components: {
    Upload,
    GameTeaser,
  },
  props: {
    gamesRunning: Array,
    gamesFinished: Array,
    images: Array,
  },
  template: `
<div id="app">
  <h1>Running games</h1>
  <div class="game-teaser-wrap" v-for="g in gamesRunning">
    <game-teaser :game="g" />
  </div>

  <h1>New game</h1>
  <div>
    <label>Pieces: </label>
    <input type="text" v-model="tiles" />
  </div>
  <div>
    <label>Image: </label>
    <span v-if="image">
      <img :src="image.url" style="width: 150px;" />
      or
      <upload @uploaded="mediaImgUploaded($event)" accept="image/*" label="Upload an image" />
    </span>
    <span v-else>
      <upload @uploaded="mediaImgUploaded($event)" accept="image/*" label="Upload an image" />
      (or select from below)
    </span>
  </div>
  <span class="btn" :class="" @click="onNewGameClick">Start new game</span>

  <h1>Image lib</h1>
  <div>
    <div
      v-for="i in images"
      @click="image = i"
      class="imageteaser"
      :style="{'background-image': 'url(' + i.url + ')'}"></div>
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
    }
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
        body: JSON.stringify({tiles: this.tiles, image: this.image}),
      })
      if (res.status === 200) {
        const game = await res.json()
        location.assign(game.url)
      }
    }
  }
}
