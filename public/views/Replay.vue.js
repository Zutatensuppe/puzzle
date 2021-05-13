"use strict"

import main from './../game.js'

export default {
  name: 'replay',
  template: `<div>{{replayData}}</div>`,
  data() {
    return {
      replayData: null,
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
      this.replayData = null
      const res = await fetch(`/api/replay-data/${this.$route.params.id}`)
      const json = await res.json()
      this.replayData = json

      window.GAME_ID = this.gameData.GAME_ID
      window.WS_ADDRESS = this.gameData.WS_ADDRESS
      window.MODE = 'replay'
      main(this.$el)
    },
  },
}
