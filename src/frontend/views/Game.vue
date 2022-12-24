<template>
  <div id="game">
    <v-dialog v-model="dialog">
      <SettingsOverlay v-if="overlay === 'settings' && g.playerSettings" :settings="g.playerSettings" />
      <PreviewOverlay v-if="overlay === 'preview'" :img="g.previewImageUrl" />
      <InfoOverlay v-if="g.game && overlay === 'info'" :game="g.game" />
      <HelpOverlay v-if="overlay === 'help'" />
    </v-dialog>

    <v-dialog v-model="cuttingPuzzle">
      <div><icon icon="hourglass" /> Cutting puzzle, please wait... <icon icon="hourglass" /></div>
    </v-dialog>

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
import PreviewOverlay from './../components/PreviewOverlay.vue'
import PuzzleStatus from '../components/PuzzleStatus.vue'
import Scores from './../components/Scores.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'
import { PlayerSettings } from '../PlayerSettings'

const statusMessages = ref<string[]>([])
const players = ref<{ active: Player[], idle: Player[] }>({ active: [], idle: [] })
const status = ref<PuzzleStatusType>({
  finished: false,
  duration: 0,
  piecesDone: 0,
  piecesTotal: 0,
})
const dialog = ref<boolean>(false)
const overlay = ref<string>('')
const connectionState = ref<number>(0)
const cuttingPuzzle = ref<boolean>(true)
const showInterface = ref<boolean>(true)
const canvasEl = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>

const eventBus = mitt()

const g = ref<{
  playerSettings: PlayerSettings|null
  game: Game|null
  previewImageUrl: string
  connect: () => void
  disconnect: () => void
  unload: () => void
}>({
  playerSettings: null,
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

const closeDialog = (): void => {
  dialog.value = false
  overlay.value = ''
}
const openDialog = (content: string): void => {
  overlay.value = content
  dialog.value = true
}

watch(dialog, (newValue) => {
  if (newValue === false) {
    if (overlay.value !== 'settings') {
      eventBus.emit('setHotkeys', true)
    }
  } else {
    if (overlay.value !== 'preview') {
      eventBus.emit('setHotkeys', false)
    }
  }
})

const toggleTo = (newOverlay: string, onOff: boolean, affectsHotkeys: boolean): void => {
  if (onOff === false) {
    // off
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', true)
    }
    closeDialog()
  } else {
    // on
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', false)
    }
    openDialog(newOverlay)
  }
}

const toggle = (newOverlay: string, affectsHotkeys: boolean): void => {
  if (dialog.value === false) {
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', false)
    }
    openDialog(newOverlay)
  } else {
    // could check if overlay was the provided one
    overlay.value = ''
    if (affectsHotkeys) {
      eventBus.emit('setHotkeys', true)
    }
    closeDialog()
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
  eventBus.on('players', (newPlayers: any) => {
    players.value = newPlayers
  })
  eventBus.on('status', (newStatus: any) => {
    status.value = newStatus
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
