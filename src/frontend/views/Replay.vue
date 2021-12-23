<template>
  <div id="replay">
    <settings-overlay
      v-show="overlay === 'settings'"
      @close="toggle('settings', true)"
      @bgclick="toggle('settings', true)"
      v-model="g.player" />
    <preview-overlay
      v-show="overlay === 'preview'"
      @close="toggle('preview', false)"
      @click="toggle('preview', false)"
      :img="g.previewImageUrl" />
    <info-overlay
      v-if="g.game"
      v-show="overlay === 'info'"
      @close="toggle('info', true)"
      @bgclick="toggle('info', true)"
      :game="g.game" />
    <help-overlay
      v-show="overlay === 'help'"
      @close="toggle('help', true)"
      @bgclick="toggle('help', true)" />

    <div class="overlay" v-if="cuttingPuzzle">
      <div class="overlay-content">
        <div>⏳ Cutting puzzle, please wait... ⏳</div>
      </div>
    </div>

    <div class="menu-left">
      <puzzle-status :status="status" />
      <div class="playback-control">
        <div>{{replayText}}</div>
        <button class="btn" @click="eventBus.emit('replayOnSpeedUp')">⏫</button>
        <button class="btn" @click="eventBus.emit('replayOnSpeedDown')">⏬</button>
        <button class="btn" @click="eventBus.emit('replayOnPauseToggle')">⏸️</button>
      </div>
      <div class="switch-game-replay" v-if="g.game">
        <router-link :to="{ name: 'game', params: { id: g.game.id } }">🧩 To the game</router-link>
      </div>
    </div>

    <div class="menu">
      <div class="tabs">
        <router-link class="opener" :to="{name: 'index'}" target="_blank">🧩 Puzzles</router-link>
        <div class="opener" @click="toggle('preview', false)">🖼️ Preview</div>
        <div class="opener" @click="toggle('settings', true)">🛠️ Settings</div>
        <div class="opener" @click="toggle('info', true)">ℹ️ Info</div>
        <div class="opener" @click="toggle('help', true)">⌨️ Hotkeys</div>
      </div>
    </div>

    <div class="menu-right">
      <scores :players="players" />
    </div>

    <canvas ref="canvas"></canvas>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import mitt from 'mitt'

import Scores from './../components/Scores.vue'
import PuzzleStatusComponent from './../components/PuzzleStatus.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'
import PreviewOverlay from './../components/PreviewOverlay.vue'
import InfoOverlay from './../components/InfoOverlay.vue'
import HelpOverlay from './../components/HelpOverlay.vue'

import { main, MODE_REPLAY } from './../game'
import { Game, Player, PuzzleStatus } from '../../common/Types'
import xhr from '../xhr'

export default defineComponent({
  name: 'replay',
  components: {
    PuzzleStatusComponent,
    Scores,
    SettingsOverlay,
    PreviewOverlay,
    InfoOverlay,
    HelpOverlay,
  },
  data() {
    return {
      players: {
        active: [] as Player[],
        idle: [] as Player[],
      },

      status: {
        finished: false,
        duration: 0,
        piecesDone: 0,
        piecesTotal: 0,
      } as PuzzleStatus,

      overlay: '',

      connectionState: 0,
      cuttingPuzzle: true,

      eventBus: mitt(),
      g: {
        player: {
          background: '',
          color: '',
          name: '',
          soundsEnabled: true,
          soundsVolume: 100,
          showPlayerNames: true,
        },
        game: null as Game|null,
        previewImageUrl: '',
        connect: () => {},
        disconnect: () => {},
        unload: () => {},
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
      this.eventBus.emit('onBgChange', value)
    })
    this.$watch(() => this.g.player.color, (value: string) => {
      this.eventBus.emit('onColorChange', value)
    })
    this.$watch(() => this.g.player.name, (value: string) => {
      this.eventBus.emit('onNameChange', value)
    })
    this.$watch(() => this.g.player.soundsEnabled, (value: boolean) => {
      this.eventBus.emit('onSoundsEnabledChange', value)
    })
    this.$watch(() => this.g.player.soundsVolume, (value: number) => {
      this.eventBus.emit('onSoundsVolumeChange', value)
    })
    this.$watch(() => this.g.player.showPlayerNames, (value: boolean) => {
      this.eventBus.emit('onShowPlayerNamesChange', value)
    })

    this.eventBus.on('puzzleCut', () => {
      this.cuttingPuzzle = false
    })
    this.eventBus.on('players', (players: any) => {
      this.players = players
    })
    this.eventBus.on('status', (status: any) => {
      this.status = status
    })
    this.eventBus.on('togglePreview', () => {
      this.toggle('preview', false)
    })
    this.eventBus.on('connectionState', (v: any) => {
      this.connectionState = v
    })
    this.eventBus.on('toggleSoundsEnabled', () => {
      this.g.player.soundsEnabled = !this.g.player.soundsEnabled
    })
    this.eventBus.on('togglePlayerNames', () => {
      this.g.player.showPlayerNames = !this.g.player.showPlayerNames
    })
    this.eventBus.on('replaySpeed', (v: any) => {
      this.replay.speed = v
    })
    this.eventBus.on('replayPaused', (v: any) => {
      this.replay.paused = v
    })

    const canvasEl = this.$refs.canvas as HTMLCanvasElement
    canvasEl.width = window.innerWidth
    canvasEl.height = window.innerHeight
    window.addEventListener('resize', this.onResize)

    this.g = await main(
      `${this.$route.params.id}`,
      // @ts-ignore
      xhr.clientId(),
      // @ts-ignore
      this.$config.WS_ADDRESS,
      MODE_REPLAY,
      canvasEl,
      this.eventBus,
    )
  },
  unmounted () {
    this.g.unload()
    this.g.disconnect()
    window.removeEventListener('resize', this.onResize)
  },
  methods: {
    onResize(): void {
      const canvasEl = this.$refs.canvas as HTMLCanvasElement
      canvasEl.width = window.innerWidth
      canvasEl.height = window.innerHeight
      this.eventBus.emit('requireRerender')
    },
    toggle(overlay: string, affectsHotkeys: boolean): void {
      if (this.overlay === '') {
        this.overlay = overlay
        if (affectsHotkeys) {
          this.eventBus.emit('setHotkeys', false)
        }
      } else {
        // could check if overlay was the provided one
        this.overlay = ''
        if (affectsHotkeys) {
          this.eventBus.emit('setHotkeys', true)
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
