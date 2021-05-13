"use strict"

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
    },
  },
}
