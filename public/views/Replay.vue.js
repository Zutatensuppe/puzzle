"use strict"

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
    },
  },
}
