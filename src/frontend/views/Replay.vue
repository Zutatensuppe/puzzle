<template>
  <div id="replay">
    <v-dialog v-model="dialog" :class="`overlay-${overlay}`">
      <SettingsOverlay v-if="overlay === 'settings' && g.playerSettings" :settings="g.playerSettings" />
      <PreviewOverlay v-if="overlay === 'preview'" :img="g.previewImageUrl" />
      <InfoOverlay v-if="g.game && overlay === 'info'" :game="g.game" />
      <HelpOverlay v-if="overlay === 'help'" />
    </v-dialog>

    <v-dialog class="overlay-cutting" v-model="cuttingPuzzle">
      <v-card>
        <v-container :fluid="true">
          <div class="d-flex justify-center">
            <v-icon icon="mdi-content-cut" />
            <v-icon icon="mdi-puzzle mr-1" />
            Cutting puzzle, please wait...
            <v-icon icon="mdi-content-cut ml-1" />
            <v-icon icon="mdi-puzzle" />
          </div>
        </v-container>
      </v-card>
    </v-dialog>

    <div class="menu-left" v-if="showInterface">
      <PuzzleStatus :status="status" />
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

    <div class="menu" v-if="showInterface">
      <router-link class="opener" :to="{name: 'index'}" target="_blank"><icon icon="puzzle-piece" /> Puzzles</router-link>
      <div class="opener" @click="toggle('preview')"><icon icon="preview" /> Preview</div>
      <div class="opener" @click="toggle('settings')"><icon icon="settings" /> Settings</div>
      <div class="opener" @click="toggle('info')"><icon icon="info" /> Info</div>
      <div class="opener" @click="toggle('help')"><icon icon="hotkey" /> Hotkeys</div>
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
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue'
import { Game, Player, PuzzleStatus as PuzzleStatusType } from '../../common/Types'
import { main, MODE_REPLAY } from './../game'
import { useRoute } from 'vue-router'
import api from '../_api'
import config from '../config'
import mitt from 'mitt'
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
  playerSettings: PlayerSettings|null,
  game: Game|null,
  previewImageUrl: string,
  connect: () => void,
  disconnect: () => void,
  unload: () => void,
}>({
  playerSettings: null,
  game: null,
  previewImageUrl: '',
  connect: () => {},
  disconnect: () => {},
  unload: () => {},
})

const replay = ref<{ speed: number, paused: boolean }>({ speed: 1, paused: false })

const route = useRoute()

const replayText = computed((): string => {
  return 'Replay-Speed: ' +
    (replay.value.speed + 'x') +
    (replay.value.paused ? ' Paused' : '')
})

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
    eventBus.emit('setHotkeys', true)
  } else {
    if (overlay.value !== 'preview') {
      eventBus.emit('setHotkeys', false)
    }
  }
  if (overlay.value === 'preview') {
    eventBus.emit('onPreviewChange', newValue)
  }
})

const toggle = (newOverlay: string): void => {
  if (dialog.value === false) {
    openDialog(newOverlay)
  } else {
    // could check if overlay was the provided one
    overlay.value = ''
    closeDialog()
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
    if (v) {
      openDialog('preview')
    } else {
      closeDialog()
    }
  })
  eventBus.on('toggleInterface', (v: any) => {
    showInterface.value = !!v
  })
  eventBus.on('replaySpeed', (v: any) => {
    replay.value.speed = v
  })
  eventBus.on('replayPaused', (v: any) => {
    replay.value.paused = v
  })

  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  window.addEventListener('resize', onResize)

  g.value = await main(
    `${route.params.id}`,
    api.clientId(),
    config.get().WS_ADDRESS,
    MODE_REPLAY,
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
