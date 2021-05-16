<template>
  <div>
    <new-game-dialog :images="images" @newGame="onNewGame" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

// TODO: maybe move dialog back, now that this is a view on its own
import NewGameDialog from './../components/NewGameDialog.vue'

export default defineComponent({
  components: {
    NewGameDialog,
  },
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
    // TODO: ts GameSettings type
    async onNewGame(gameSettings: any) {
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
})
</script>
