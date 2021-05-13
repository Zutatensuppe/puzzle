"use strict"

import main from './../game.js'

export default {
  name: 'game',
  template: `<div>{{gameData}}</div>`,
  data() {
    return {
      gameData: null,
    }
  },
  created() {
    this.$watch(
      () => this.$route.params,
      () => { this.fetchData() },
      { immediate: true }
    )
  },
  methods: {
    async fetchData() {
      this.gameData = null
      const res = await fetch(`/api/game-data/${this.$route.params.id}`)
      const json = await res.json()
      this.gameData = json

      window.GAME_ID = this.gameData.GAME_ID
      window.WS_ADDRESS = this.gameData.WS_ADDRESS
      window.MODE = 'play'
      main(this.$el)
    },
  },
}
