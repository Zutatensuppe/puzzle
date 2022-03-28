<template>
  <div id="game">
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

    <overlay v-show="cuttingPuzzle">
      <template v-slot:default>
        <div><i class="icon icon-hourglass" /> Cutting puzzle, please wait... <i class="icon icon-hourglass" /></div>
      </template>
    </overlay>

    <connection-overlay
      :connectionState="connectionState"
      @reconnect="reconnect"
      />

    <div class="menu-left">
      <puzzle-status :status="status" />
      <div class="switch-game-replay" v-if="g.game && g.game.hasReplay">
        <router-link :to="{ name: 'replay', params: { id: g.game.id } }"><i class="icon icon-replay" /> Watch replay</router-link>
      </div>
    </div>

    <div class="menu">
      <div class="tabs">
        <router-link class="opener" :to="{name: 'index'}" target="_blank"><i class="icon icon-puzzle-piece" /> Puzzles</router-link>
        <div class="opener" @click="toggle('preview', false)"><i class="icon icon-preview" /> Preview</div>
        <div class="opener" @click="toggle('settings', true)"><i class="icon icon-settings" /> Settings</div>
        <div class="opener" @click="toggle('info', true)"><i class="icon icon-info" /> Info</div>
        <div class="opener" @click="toggle('help', true)"><i class="icon icon-hotkey" /> Hotkeys</div>
        <a
          class="opener"
          href="https://ec.europa.eu/info/strategy/priorities-2019-2024/stronger-europe-world/eu-solidarity-ukraine/eu-assistance-ukraine/eu-stands-ukraine_en"
          target="_blank"
          >
          <i class="icon icon-ukraine-heart" /> Stand with Ukraine
        </a>
      </div>
    </div>

    <div class="menu-right">
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
import ConnectionOverlay from './../components/ConnectionOverlay.vue'
import HelpOverlay from './../components/HelpOverlay.vue'

import { main, MODE_PLAY } from '../game'
import { Game, Player, PuzzleStatus } from '../../common/Types'
import xhr from '../xhr'
import { defaultPlayerSettings } from '../settings'

export default defineComponent({
  name: 'game',
  components: {
    PuzzleStatusComponent,
    Scores,
    SettingsOverlay,
    PreviewOverlay,
    InfoOverlay,
    ConnectionOverlay,
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

      eventBus: mitt(),
      g: {
        player: defaultPlayerSettings(),
        game: null as Game|null,
        previewImageUrl: '',
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
    this.eventBus.on('toggleSoundsEnabled', (v: any) => {
      this.g.player.soundsEnabled = !!v
    })
    this.eventBus.on('togglePlayerNames', (v: any) => {
      this.g.player.showPlayerNames = !!v
    })

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
      MODE_PLAY,
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
    reconnect(): void {
      this.g.connect()
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
})
</script>
