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


export const timestamp = () => {
  const d = new Date();
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  )
}

export default {
  components: {
    Upload,
  },
  props: {
    games: Array,
    images: Array,
  },
  template: `
<div id="app">
  <h1>Running games</h1>
  <div class="game-teaser-wrap" v-for="g in games">
    <div class="game-teaser" :style="'background-image: url('+g.imageUrl+')'">
      <a class="game-info" :href="'/g/' + g.id">
        <span class="game-info-text">
          🧩 {{g.tilesFinished}}/{{g.tilesTotal}}<br />
          👥 {{g.players}}<br />
          {{time(g.started, g.finished)}}<br />
        </span>
      </a>
    </div>
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
  <span class="btn" :class="" @click="newGame">Start new game</span>

  <h1>Image lib</h1>
  <div>
    <img
      v-for="i in images"
      :src="i.url"
      @click="image = i"
      style="width: 150px; display: inline-block; margin: 5px;"
      />
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
      const to = end || timestamp()

      const MS = 1
      const SEC = MS * 1000
      const MIN = SEC * 60
      const HOUR = MIN * 60
      const DAY = HOUR * 24

      let diff = to - from
      const d = Math.floor(diff / DAY)
      diff = diff % DAY

      const h = Math.floor(diff / HOUR)
      diff = diff % HOUR

      const m = Math.floor(diff / MIN)
      diff = diff % MIN

      const s = Math.floor(diff / SEC)

      return `${icon} ${d}d ${h}h ${m}m ${s}s`
    },
    mediaImgUploaded(j) {
      this.image = j.image
    },
    async newGame() {
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
