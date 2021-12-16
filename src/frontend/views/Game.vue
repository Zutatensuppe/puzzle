<template>
  <div id="game">
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

    <overlay v-show="cuttingPuzzle">
      <template v-slot:default>
        <div>⏳ Cutting puzzle, please wait... ⏳</div>
      </template>
    </overlay>

    <connection-overlay
      :connectionState="connectionState"
      @reconnect="reconnect"
      />

    <div class="menu-left">
      <puzzle-status :status="status" />
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
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import Scores from './../components/Scores.vue'
import PuzzleStatusComponent from './../components/PuzzleStatus.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'
import PreviewOverlay from './../components/PreviewOverlay.vue'
import InfoOverlay from './../components/InfoOverlay.vue'
import ConnectionOverlay from './../components/ConnectionOverlay.vue'
import HelpOverlay from './../components/HelpOverlay.vue'

import { main, MODE_PLAY } from './../game'
import { Game, Player, PuzzleStatus } from '../../common/Types'

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
        setPlayers: (active: Player[], idle: Player[]) => { this.players = { active, idle } },
        setStatus: (status: PuzzleStatus) => {
          this.setStatus(status)
        },
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
    setStatus(status: PuzzleStatus): void {
      try {
        this.$nextTick(() => {
          this.status = status
        })
      } catch (e) {
        console.log('[2021-12-17] effort to avoid "too much recursion" error')
        console.error(e)
      }
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
