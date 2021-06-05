<template>
  <div id="game">
    <settings-overlay v-show="overlay === 'settings'" @bgclick="toggle('settings', true)" v-model="g.player" />
    <preview-overlay v-show="overlay === 'preview'" @bgclick="toggle('preview', false)" :img="g.previewImageUrl" />
    <help-overlay v-show="overlay === 'help'" @bgclick="toggle('help', true)" />

    <connection-overlay
      :connectionState="connectionState"
      @reconnect="reconnect"
      />

    <puzzle-status
      :finished="finished"
      :duration="duration"
      :piecesDone="piecesDone"
      :piecesTotal="piecesTotal"
    />

    <div class="menu">
      <div class="tabs">
        <router-link class="opener" :to="{name: 'index'}" target="_blank">🧩 Puzzles</router-link>
        <div class="opener" @click="toggle('preview', false)">🖼️ Preview</div>
        <div class="opener" @click="toggle('settings', true)">🛠️ Settings</div>
        <div class="opener" @click="toggle('help', true)">ℹ️ Help</div>
      </div>
    </div>

    <scores :activePlayers="activePlayers" :idlePlayers="idlePlayers" />
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import Scores from './../components/Scores.vue'
import PuzzleStatus from './../components/PuzzleStatus.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'
import PreviewOverlay from './../components/PreviewOverlay.vue'
import ConnectionOverlay from './../components/ConnectionOverlay.vue'
import HelpOverlay from './../components/HelpOverlay.vue'

import { main, MODE_PLAY } from './../game'
import { Player } from '../../common/Types'

export default defineComponent({
  name: 'game',
  components: {
    PuzzleStatus,
    Scores,
    SettingsOverlay,
    PreviewOverlay,
    ConnectionOverlay,
    HelpOverlay,
  },
  data() {
    return {
      activePlayers: [] as Array<Player>,
      idlePlayers: [] as Array<Player>,

      finished: false,
      duration: 0,
      piecesDone: 0,
      piecesTotal: 0,

      overlay: '',

      connectionState: 0,

      g: {
        player: {
          background: '',
          color: '',
          name: '',
          soundsEnabled: false,
        },
        previewImageUrl: '',
        setHotkeys: (v: boolean) => {},
        onBgChange: (v: string) => {},
        onColorChange: (v: string) => {},
        onNameChange: (v: string) => {},
        onSoundsEnabledChange: (v: boolean) => {},
        connect: () => {},
        disconnect: () => {},
        unload: () => {},
      },
    }
  },
  async mounted() {
    if (!this.$route.params.id) {
      return
    }
    this.$watch(() => this.g.player.background, (value: string) => {
      this.g.onBgChange(value)
    })
    this.$watch(() => this.g.player.color, (value: string) => {
      this.g.onColorChange(value)
    })
    this.$watch(() => this.g.player.name, (value: string) => {
      this.g.onNameChange(value)
    })
    this.$watch(() => this.g.player.soundsEnabled, (value: boolean) => {
      this.g.onSoundsEnabledChange(value)
    })
    this.g = await main(
      `${this.$route.params.id}`,
      // @ts-ignore
      this.$clientId,
      // @ts-ignore
      this.$config.WS_ADDRESS,
      MODE_PLAY,
      this.$el,
      {
        setActivePlayers: (v: Array<Player>) => { this.activePlayers = v },
        setIdlePlayers: (v: Array<Player>) => { this.idlePlayers = v },
        setFinished: (v: boolean) => { this.finished = v },
        setDuration: (v: number) => { this.duration = v },
        setPiecesDone: (v: number) => { this.piecesDone = v },
        setPiecesTotal: (v: number) => { this.piecesTotal = v },
        setConnectionState: (v: number) => { this.connectionState = v },
        togglePreview: () => { this.toggle('preview', false) },
        toggleSoundsEnabled: () => { this.g.player.soundsEnabled = !this.g.player.soundsEnabled },
      }
    )
  },
  unmounted () {
    this.g.unload()
    this.g.disconnect()
  },
  methods: {
    reconnect(): void {
      this.g.connect()
    },
    toggle(overlay: string, affectsHotkeys: boolean): void {
      if (this.overlay === '') {
        this.overlay = overlay
        if (affectsHotkeys) {
          this.g.setHotkeys(false)
        }
      } else {
        // could check if overlay was the provided one
        this.overlay = ''
        if (affectsHotkeys) {
          this.g.setHotkeys(true)
        }
      }
    },
  },
})
</script>
