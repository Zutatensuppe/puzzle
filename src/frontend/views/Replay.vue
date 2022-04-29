<template>
  <div id="replay">
    <settings-overlay
      v-if="overlay === 'settings'"
      @close="toggle('settings', true)"
      @bgclick="toggle('settings', true)"
      v-model="g.player" />
    <preview-overlay
      v-if="overlay === 'preview'"
      @close="toggle('preview', false)"
      @click="toggle('preview', false)"
      :img="g.previewImageUrl" />
    <info-overlay
      v-if="g.game && overlay === 'info'"
      @close="toggle('info', true)"
      @bgclick="toggle('info', true)"
      :game="g.game" />
    <help-overlay
      v-if="overlay === 'help'"
      @close="toggle('help', true)"
      @bgclick="toggle('help', true)" />

    <div class="overlay" v-if="cuttingPuzzle">
      <div class="overlay-content">
        <div><icon icon="hourglass" /> Cutting puzzle, please wait... <icon icon="hourglass" /></div>
      </div>
    </div>

    <div class="menu-left" v-if="interface">
      <puzzle-status :status="status" />
      <div class="playback-control">
        <div>{{replayText}}</div>
        <button class="btn" @click="eventBus.emit('replayOnSpeedUp')"><icon icon="speed-up" /></button>
        <button class="btn" @click="eventBus.emit('replayOnSpeedDown')"><icon icon="speed-down" /></button>
        <button class="btn" @click="eventBus.emit('replayOnPauseToggle')"><icon icon="pause" /></button>
      </div>
      <div class="switch-game-replay" v-if="g.game">
        <router-link :to="{ name: 'game', params: { id: g.game.id } }"><icon icon="puzzle-piece" /> To the game</router-link>
      </div>
    </div>

    <div class="menu" v-if="interface">
      <router-link class="opener" :to="{name: 'index'}" target="_blank"><icon icon="puzzle-piece" /> Puzzles</router-link>
      <div class="opener" @click="toggle('preview', false)"><icon icon="preview" /> Preview</div>
      <div class="opener" @click="toggle('settings', true)"><icon icon="settings" /> Settings</div>
      <div class="opener" @click="toggle('info', true)"><icon icon="info" /> Info</div>
      <div class="opener" @click="toggle('help', true)"><icon icon="hotkey" /> Hotkeys</div>
      <a class="opener" href="https://stand-with-ukraine.pp.ua/" target="_blank"><icon icon="ukraine-heart" /> Stand with Ukraine </a>
    </div>

    <div class="menu-right" v-if="interface">
      <scores :players="players" />
    </div>

    <div class="status-messages" v-if="statusMessages.length">
      <div v-for="(msg,idx) in statusMessages" :key="idx">
        {{msg}}
      </div>
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
import { defaultPlayerSettings } from '../settings'

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
      statusMessages: [] as string[],
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

      interface: true,

      eventBus: mitt(),
      g: {
        player: defaultPlayerSettings(),
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

    this.eventBus.on('puzzleCut', () => {
      this.cuttingPuzzle = false
    })
    this.eventBus.on('players', (players: any) => {
      this.players = players
    })
    this.eventBus.on('status', (status: any) => {
      this.status = status
    })
    this.eventBus.on('connectionState', (v: any) => {
      this.connectionState = v
    })
    this.eventBus.on('togglePreview', (v: any) => {
      this.toggleTo('preview', v, false)
    })
    this.eventBus.on('toggleInterface', (v: any) => {
      this.interface = !!v
    })
    this.eventBus.on('toggleSoundsEnabled', (v: any) => {
      this.g.player.soundsEnabled = !!v
    })
    this.eventBus.on('togglePlayerNames', (v: any) => {
      this.g.player.showPlayerNames = !!v
    })
    this.eventBus.on('toggleShowTable', (v: any) => {
      this.g.player.showTable = !!v
    })
    this.eventBus.on('replaySpeed', (v: any) => {
      this.replay.speed = v
    })
    this.eventBus.on('replayPaused', (v: any) => {
      this.replay.paused = v
    })

    this.$watch(() => this.g.player.background, (value: string) => {
      this.eventBus.emit('onBgChange', value)
    })
    this.$watch(() => this.g.player.showTable, (value: boolean) => {
      this.eventBus.emit('onShowTableChange', value)
    })
    this.$watch(() => this.g.player.tableTexture, (value: string) => {
      this.eventBus.emit('onTableTextureChange', value)
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
    this.$watch(() => this.g.player.otherPlayerClickSoundEnabled, (value: boolean) => {
      this.eventBus.emit('onOtherPlayerClickSoundEnabledChange', value)
    })
    this.$watch(() => this.g.player.soundsVolume, (value: number) => {
      this.eventBus.emit('onSoundsVolumeChange', value)
    })
    this.$watch(() => this.g.player.showPlayerNames, (value: boolean) => {
      this.eventBus.emit('onShowPlayerNamesChange', value)
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

    this.eventBus.on('statusMessage', (data: any) => {
      this.addStatusMessage(data.what, data.value)
    })
  },
  unmounted () {
    this.g.unload()
    this.g.disconnect()
    window.removeEventListener('resize', this.onResize)
  },
  methods: {
    addStatusMessage(what: string, value: any): void {
      if (typeof value === 'undefined') {
        this.statusMessages.push(`${what}`)
      } else if (value === true || value === false) {
        this.statusMessages.push(`${what} ${value ? 'enabled' : 'disabled'}`)
      } else {
        this.statusMessages.push(`${what} changed to ${value}`)
      }
      setTimeout(() => {
        this.statusMessages.shift()
      }, 3000)
    },
    onResize(): void {
      const canvasEl = this.$refs.canvas as HTMLCanvasElement
      canvasEl.width = window.innerWidth
      canvasEl.height = window.innerHeight
      this.eventBus.emit('requireRerender')
    },
    toggleTo(overlay: string, onOff: boolean, affectsHotkeys: boolean): void {
      if (onOff === false) {
        // off
        this.overlay = ''
        if (affectsHotkeys) {
          this.eventBus.emit('setHotkeys', true)
        }
      } else {
        // on
        this.overlay = overlay
        if (affectsHotkeys) {
          this.eventBus.emit('setHotkeys', false)
        }
      }
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
      if (overlay === 'preview') {
        this.eventBus.emit('onPreviewChange', this.overlay === 'preview')
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
