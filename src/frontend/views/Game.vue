<template>
  <div id="game">
    <SettingsOverlay
      v-if="overlay === 'settings'"
      @close="toggle('settings', true)"
      @bgclick="toggle('settings', true)"
      v-model="g.player" />
    <PreviewOverlay
      v-if="overlay === 'preview'"
      @close="toggle('preview', false)"
      @click="toggle('preview', false)"
      :img="g.previewImageUrl" />
    <InfoOverlay
      v-if="g.game && overlay === 'info'"
      @close="toggle('info', true)"
      @bgclick="toggle('info', true)"
      :game="g.game" />
    <HelpOverlay
      v-if="overlay === 'help'"
      @close="toggle('help', true)"
      @bgclick="toggle('help', true)" />

    <Overlay v-show="cuttingPuzzle">
      <template v-slot:default>
        <div><icon icon="hourglass" /> Cutting puzzle, please wait... <icon icon="hourglass" /></div>
      </template>
    </Overlay>

    <ConnectionOverlay
      :connectionState="connectionState"
      @reconnect="reconnect"
      />

    <div class="menu-left" v-if="showInterface">
      <PuzzleStatus :status="status" />
      <div class="switch-game-replay" v-if="g.game && g.game.hasReplay">
        <router-link :to="{ name: 'replay', params: { id: g.game.id } }"><icon icon="replay" /> Watch replay</router-link>
      </div>
    </div>

    <div class="menu" v-if="showInterface">
      <router-link class="opener" :to="{name: 'index'}" target="_blank"><icon icon="puzzle-piece" /> Puzzles</router-link>
      <div class="opener" @click="toggle('preview', false)"><icon icon="preview" /> Preview</div>
      <div class="opener" @click="toggle('settings', true)"><icon icon="settings" /> Settings</div>
      <div class="opener" @click="toggle('info', true)"><icon icon="info" /> Info</div>
      <div class="opener" @click="toggle('help', true)"><icon icon="hotkey" /> Hotkeys</div>
      <a class="opener" href="https://stand-with-ukraine.pp.ua/" target="_blank"><icon icon="ukraine-heart" /> Stand with Ukraine </a>
    </div>

    <div class="menu-right" v-if="showInterface">
      <Scores :players="players" />
    </div>

    <div class="status-messages" v-if="statusMessages.length">
      <div v-for="(msg,idx) in statusMessages" :key="idx">
        {{msg}}
      </div>
    </div>

    <canvas ref="canvasEl"></canvas>
  </div>
</template>
<script setup lang="ts">
import { defaultPlayerSettings, PlayerSettings } from '../settings'
import { Game, Player, PuzzleStatus as PuzzleStatusType } from '../../common/Types'
import { main, MODE_PLAY } from '../game'
import { onMounted, onUnmounted, Ref, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../_api'
import config from '../config'
import mitt from 'mitt'
import ConnectionOverlay from './../components/ConnectionOverlay.vue'
import HelpOverlay from './../components/HelpOverlay.vue'
import InfoOverlay from './../components/InfoOverlay.vue'
import Overlay from '../components/Overlay.vue'
import PreviewOverlay from './../components/PreviewOverlay.vue'
import PuzzleStatus from '../components/PuzzleStatus.vue'
import Scores from './../components/Scores.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'

const statusMessages = ref<string[]>([])
const players = ref<{ active: Player[], idle: Player[] }>({ active: [], idle: [] })
const status = ref<PuzzleStatusType>({
  finished: false,
  duration: 0,
  piecesDone: 0,
  piecesTotal: 0,
})
const overlay = ref<string>('')
const connectionState = ref<number>(0)
const cuttingPuzzle = ref<boolean>(true)
const showInterface = ref<boolean>(true)
const canvasEl = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>

const eventBus = mitt()

const g = ref<{
  player: PlayerSettings
  game: Game|null
  previewImageUrl: string
  connect: () => void
  disconnect: () => void
  unload: () => void
}>({
  player: defaultPlayerSettings(),
  game: null,
  previewImageUrl: '',
  connect: () => {},
  disconnect: () => {},
  unload: () => {},
})

const route = useRoute()

const addStatusMessage = (what: string, value: any): void => {
  if (typeof value === 'undefined') {
    statusMessages.value.push(`${what}`)
  } else if (value === true || value === false) {
    statusMessages.value.push(`${what} ${value ? 'enabled' : 'disabled'}`)
  } else {
    statusMessages.value.push(`${what} changed to ${value}`)
  }
  setTimeout(() => {
    statusMessages.value.shift()
  }, 3000)
}

const onResize = (): void => {
  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  eventBus.emit('requireRerender')
}

const reconnect = (): void => {
  g.value.connect()
}

const toggleTo = (newOverlay: string, onOff: boolean, affectsHotkeys: boolean): void => {
  if (onOff === false) {
    // off
    overlay.value = ''
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', true)
    }
  } else {
    // on
    overlay.value = newOverlay
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', false)
    }
  }
}

const toggle = (newOverlay: string, affectsHotkeys: boolean): void => {
  if (overlay.value === '') {
    overlay.value = newOverlay
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', false)
    }
  } else {
    // could check if overlay was the provided one
    overlay.value = ''
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', true)
    }
  }
  if (newOverlay === 'preview') {
    eventBus.emit('onPreviewChange', overlay.value === 'preview')
  }
}

onMounted(async () => {
  if (!route.params.id) {
    return
  }

  eventBus.on('puzzleCut', () => {
    cuttingPuzzle.value = false
  })
  eventBus.on('players', (players: any) => {
    players.value = players
  })
  eventBus.on('status', (status: any) => {
    status.value = status
  })
  eventBus.on('connectionState', (v: any) => {
    connectionState.value = v
  })
  eventBus.on('togglePreview', (v: any) => {
    toggleTo('preview', v, false)
  })
  eventBus.on('toggleInterface', (v: any) => {
    showInterface.value = !!v
  })
  eventBus.on('toggleSoundsEnabled', (v: any) => {
    g.value.player.soundsEnabled = !!v
  })
  eventBus.on('togglePlayerNames', (v: any) => {
    g.value.player.showPlayerNames = !!v
  })
  eventBus.on('toggleShowTable', (v: any) => {
    g.value.player.showTable = !!v
  })

  watch(() => g.value.player.background, (value: string) => {
    eventBus.emit('onBgChange', value)
  })
  watch(() => g.value.player.showTable, (value: boolean) => {
    eventBus.emit('onShowTableChange', value)
  })
  watch(() => g.value.player.tableTexture, (value: string) => {
    eventBus.emit('onTableTextureChange', value)
  })
  watch(() => g.value.player.color, (value: string) => {
    eventBus.emit('onColorChange', value)
  })
  watch(() => g.value.player.name, (value: string) => {
    eventBus.emit('onNameChange', value)
  })
  watch(() => g.value.player.soundsEnabled, (value: boolean) => {
    eventBus.emit('onSoundsEnabledChange', value)
  })
  watch(() => g.value.player.otherPlayerClickSoundEnabled, (value: boolean) => {
    eventBus.emit('onOtherPlayerClickSoundEnabledChange', value)
  })
  watch(() => g.value.player.soundsVolume, (value: number) => {
    eventBus.emit('onSoundsVolumeChange', value)
  })
  watch(() => g.value.player.showPlayerNames, (value: boolean) => {
    eventBus.emit('onShowPlayerNamesChange', value)
  })

  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  window.addEventListener('resize', onResize)

  g.value = await main(
    `${route.params.id}`,
    api.clientId(),
    config.get().WS_ADDRESS,
    MODE_PLAY,
    canvasEl.value,
    eventBus,
  )

  eventBus.on('statusMessage', (data: any) => {
    addStatusMessage(data.what, data.value)
  })
})

onUnmounted(() => {
  g.value.unload()
  g.value.disconnect()
  window.removeEventListener('resize', onResize)
})
</script>
