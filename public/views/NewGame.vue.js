"use strict"

import NewGameDialog from './../components/NewGameDialog.vue.js'

export default {
  components: {
    NewGameDialog,
  },
  // TODO: maybe move dialog back, now that this is a view on its own
  template: `
<div>
  <new-game-dialog :images="images" @newGame="onNewGame" />
</div>`,
  data() {
    return {
      images: [],
    }
  },
  async created() {
    const res = await fetch('/api/newgame-data')
    const json = await res.json()
    this.images = json.images
  },
  methods: {
    async onNewGame(gameSettings) {
      const res = await fetch('/newgame', {
        method: 'post',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameSettings),
      })
      if (res.status === 200) {
        const game = await res.json()
        this.$router.push({ name: 'game', params: { id: game.id } })
      }
    }
  }
}
