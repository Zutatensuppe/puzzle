<template>
  <div id="game">
    <settings-overlay v-show="overlay === 'settings'" @bgclick="toggle('settings', true)" v-model="g.player" />
    <preview-overlay v-show="overlay === 'preview'" @bgclick="toggle('preview', false)" :img="g.previewImageUrl" />
    <info-overlay v-if="g.game" v-show="overlay === 'info'" @bgclick="toggle('info', true)" :game="g.game" />
    <help-overlay v-show="overlay === 'help'" @bgclick="toggle('help', true)" />

    <div class="overlay" v-if="cuttingPuzzle">
      <div class="overlay-content">
        <div>⏳ Cutting puzzle, please wait... ⏳</div>
      </div>
    </div>

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
        <div class="opener" @click="toggle('info', true)">ℹ️ Info</div>
        <div class="opener" @click="toggle('help', true)">⌨️ Hotkeys</div>
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
import InfoOverlay from './../components/InfoOverlay.vue'
import ConnectionOverlay from './../components/ConnectionOverlay.vue'
import HelpOverlay from './../components/HelpOverlay.vue'

import { main, MODE_PLAY } from './../game'
import { Game, Player } from '../../common/Types'

export default defineComponent({
  name: 'game',
  components: {
    PuzzleStatus,
    Scores,
    SettingsOverlay,
    PreviewOverlay,
    InfoOverlay,
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
      cuttingPuzzle: true,

      g: {
        player: {
          background: '',
          color: '',
          name: '',
          soundsEnabled: false,
          soundsVolume: 100,
          showPlayerNames: true,
        },
        game: null as Game|null,
        previewImageUrl: '',
        setHotkeys: (v: boolean) => {},
        onBgChange: (v: string) => {},
        onColorChange: (v: string) => {},
        onNameChange: (v: string) => {},
        onSoundsEnabledChange: (v: boolean) => {},
        onSoundsVolumeChange: (v: number) => {},
        onShowPlayerNamesChange: (v: boolean) => {},
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
    this.$watch(() => this.g.player.soundsVolume, (value: number) => {
      this.g.onSoundsVolumeChange(value)
    })
    this.$watch(() => this.g.player.showPlayerNames, (value: boolean) => {
      this.g.onShowPlayerNamesChange(value)
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
        setPuzzleCut: () => { this.cuttingPuzzle = false },
        setActivePlayers: (v: Array<Player>) => { this.activePlayers = v },
        setIdlePlayers: (v: Array<Player>) => { this.idlePlayers = v },
        setFinished: (v: boolean) => { this.finished = v },
        setDuration: (v: number) => { this.duration = v },
        setPiecesDone: (v: number) => { this.piecesDone = v },
        setPiecesTotal: (v: number) => { this.piecesTotal = v },
        togglePreview: () => { this.toggle('preview', false) },
        setConnectionState: (v: number) => { this.connectionState = v },
        toggleSoundsEnabled: () => { this.g.player.soundsEnabled = !this.g.player.soundsEnabled },
        togglePlayerNames: () => { this.g.player.showPlayerNames = !this.g.player.showPlayerNames },
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
