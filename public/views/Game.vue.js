"use strict"

import Scores from './../components/Scores.vue.js'
import PuzzleStatus from './../components/PuzzleStatus.vue.js'
import SettingsOverlay from './../components/SettingsOverlay.vue.js'
import PreviewOverlay from './../components/PreviewOverlay.vue.js'
import HelpOverlay from './../components/HelpOverlay.vue.js'

import { main, MODE_PLAY } from './../game.js'

export default {
  name: 'game',
  components: {
    PuzzleStatus,
    Scores,
    SettingsOverlay,
    PreviewOverlay,
    HelpOverlay,
  },
  template: `<div id="game">
    <settings-overlay v-show="overlay === 'settings'" @bgclick="toggle('settings', true)" v-model="g.player" />
    <preview-overlay v-show="overlay === 'preview'" @bgclick="toggle('preview', false)" :img="g.previewImageUrl" />
    <help-overlay v-show="overlay === 'help'" @bgclick="toggle('help', true)" />

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
  </div>`,
  data() {
    return {
      activePlayers: [],
      idlePlayers: [],

      finished: false,
      duration: 0,
      piecesDone: 0,
      piecesTotal: 0,

      overlay: null,

      g: {
        player: {
          background: '',
          color: '',
          name: '',
        },
        previewImageUrl: '',
        setHotkeys: () => {},
        onBgChange: () => {},
        onColorChange: () => {},
        onNameChange: () => {},
        disconnect: () => {},
      },
    }
  },
  async mounted() {
    if (!this.$route.params.id) {
      return
    }
    this.$watch(() => this.g.player.background, (value) => {
      this.g.onBgChange(value)
    })
    this.$watch(() => this.g.player.color, (value) => {
      this.g.onColorChange(value)
    })
    this.$watch(() => this.g.player.name, (value) => {
      this.g.onNameChange(value)
    })
    this.g = await main(
      this.$route.params.id,
      this.$clientId,
      this.$config.WS_ADDRESS,
      MODE_PLAY,
      this.$el,
      {
        setActivePlayers: (v) => { this.activePlayers = v },
        setIdlePlayers: (v) => { this.idlePlayers = v },
        setFinished: (v) => { this.finished = v },
        setDuration: (v) => { this.duration = v },
        setPiecesDone: (v) => { this.piecesDone = v },
        setPiecesTotal: (v) => { this.piecesTotal = v },
        togglePreview: () => { this.toggle('preview', false) },
      }
    )
  },
  unmounted () {
    this.g.disconnect()
  },
  methods: {
    toggle(overlay, affectsHotkeys) {
      if (this.overlay === null) {
        this.overlay = overlay
        if (affectsHotkeys) {
          this.g.setHotkeys(false)
        }
      } else {
        // could check if overlay was the provided one
        this.overlay = null
        if (affectsHotkeys) {
          this.g.setHotkeys(true)
        }
      }
    },
  },
}
