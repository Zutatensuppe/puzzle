<template>
  <div id="replay">
    <settings-overlay v-show="overlay === 'settings'" @bgclick="toggle('settings', true)" v-model="g.player" />
    <preview-overlay v-show="overlay === 'preview'" @bgclick="toggle('preview', false)" :img="g.previewImageUrl" />
    <help-overlay v-show="overlay === 'help'" @bgclick="toggle('help', true)" />

    <puzzle-status
      :finished="finished"
      :duration="duration"
      :piecesDone="piecesDone"
      :piecesTotal="piecesTotal"
    >
      <div>
        <div>{{replayText}}</div>
        <button class="btn" @click="g.replayOnSpeedUp()">⏫</button>
        <button class="btn" @click="g.replayOnSpeedDown()">⏬</button>
        <button class="btn" @click="g.replayOnPauseToggle()">⏸️</button>
      </div>
    </puzzle-status>

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
import HelpOverlay from './../components/HelpOverlay.vue'

import { main, MODE_REPLAY } from './../game'

export default defineComponent({
  name: 'replay',
  components: {
    PuzzleStatus,
    Scores,
    SettingsOverlay,
    PreviewOverlay,
    HelpOverlay,
  },
  data() {
    return {
      activePlayers: [] as Array<any>,
      idlePlayers: [] as Array<any>,

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
        replayOnSpeedUp: () => {},
        replayOnSpeedDown: () => {},
        replayOnPauseToggle: () => {},
        disconnect: () => {},
      },

      replay: {
        speed: 1,
        paused: false,
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
      MODE_REPLAY,
      this.$el,
      {
        setActivePlayers: (v: Array<any>) => { this.activePlayers = v },
        setIdlePlayers: (v: Array<any>) => { this.idlePlayers = v },
        setFinished: (v: boolean) => { this.finished = v },
        setDuration: (v: number) => { this.duration = v },
        setPiecesDone: (v: number) => { this.piecesDone = v },
        setPiecesTotal: (v: number) => { this.piecesTotal = v },
        togglePreview: () => { this.toggle('preview', false) },
        setConnectionState: (v: number) => { this.connectionState = v },
        setReplaySpeed: (v: number) => { this.replay.speed = v },
        setReplayPaused: (v: boolean) => { this.replay.paused = v },
        toggleSoundsEnabled: () => { this.g.player.soundsEnabled = !this.g.player.soundsEnabled },
      }
    )
  },
  unmounted () {
    this.g.disconnect()
  },
  methods: {
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
  computed: {
    replayText (): string {
      return 'Replay-Speed: ' +
        (this.replay.speed + 'x') +
        (this.replay.paused ? ' Paused' : '')
    },
  },
})
</script>
