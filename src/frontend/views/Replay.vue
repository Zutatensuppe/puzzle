<template>
  <div id="replay">
    <v-dialog v-model="dialog" :class="`overlay-${overlay}`" :persistent="dialogPersistent">
      <SettingsOverlay v-if="g && overlay === 'settings'" :game="g" @dialogChange="onDialogChange" />
      <PreviewOverlay v-if="g && overlay === 'preview'" :game="g" @close="closeDialog" />
      <InfoOverlay v-if="g && overlay === 'info'" :game="g" />
      <HelpOverlay v-if="overlay === 'help'" />
    </v-dialog>

    <CuttingOverlay v-model="cuttingPuzzle" />

    <div class="menu-left" v-if="showInterface">
      <PuzzleStatus :status="status" />
      <div class="playback-control" v-if="g">
        <div>{{replayText}}</div>
        <button class="btn" @click="onSpeedUp"><icon icon="speed-up" /></button>
        <button class="btn" @click="onSpeedDown"><icon icon="speed-down" /></button>
        <button class="btn" @click="onTogglePause"><icon icon="pause" /></button>
      </div>
      <div class="switch-game-replay" v-if="g">
        <router-link :to="{ name: 'game', params: { id: g.getGameId() } }"><icon icon="puzzle-piece" /> To the game</router-link>
      </div>
    </div>

    <div class="menu" v-if="showInterface">
      <router-link class="opener" :to="{name: 'index'}" target="_blank"><icon icon="puzzle-piece" /> Puzzles</router-link>
      <div class="opener" @click="openDialog('preview')"><icon icon="preview" /> Preview</div>
      <div class="opener" @click="openDialog('settings')"><icon icon="settings" /> Settings</div>
      <div class="opener" @click="openDialog('info')"><icon icon="info" /> Info</div>
      <div class="opener" @click="openDialog('help')"><icon icon="hotkey" /> Hotkeys</div>
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
import { ReplayHud, Player, PuzzleStatus as PuzzleStatusType } from '../../common/Types'
import { GameReplay } from './../GameReplay'
import { useRoute } from 'vue-router'
import api from '../_api'
import config from '../config'
import HelpOverlay from './../components/HelpOverlay.vue'
import InfoOverlay from './../components/InfoOverlay.vue'
import PreviewOverlay from './../components/PreviewOverlay.vue'
import PuzzleStatus from '../components/PuzzleStatus.vue'
import Scores from './../components/Scores.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'
import CuttingOverlay from './../components/CuttingOverlay.vue'

const statusMessages = ref<string[]>([])
const players = ref<{ active: Player[], idle: Player[] }>({ active: [], idle: [] })
const status = ref<PuzzleStatusType>({
  finished: false,
  duration: 0,
  piecesDone: 0,
  piecesTotal: 0,
})
const dialog = ref<boolean>(false)
const dialogPersistent = ref<boolean|undefined>(undefined)
const overlay = ref<string>('')
const connectionState = ref<number>(0)
const cuttingPuzzle = ref<boolean>(true)
const showInterface = ref<boolean>(true)
const canvasEl = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>

const g = ref<GameReplay | null>(null)

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

const onDialogChange = (changes: any[]): void => {
  changes.forEach((change: { type: string, value: any }) => {
    if (change.type === 'persistent') {
      dialogPersistent.value = change.value
    }
  })
}

const onResize = (): void => {
  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  if (g.value) {
    g.value.requireRerender()
  }
}

const sendEvents = (newValue: boolean, newOverlay: string, oldOverlay: string) => {
  if (!g.value) {
    return
  }

  if (newValue) {
    // overlay is now visible
    if (newOverlay !== 'preview') {
      g.value.toggleHotkeys(false)
    }
    if (newOverlay === 'preview') {
      g.value.togglePreview(true)
    }
  } else {
    // overlay is now closed
    if (oldOverlay === 'preview') {
      g.value.togglePreview(false)
    }
    g.value.toggleHotkeys(true)
  }
}

const closeDialog = (): void => {
  const newValue = false
  const oldOverlay = overlay.value
  const newOverlay = ''

  dialog.value = newValue
  overlay.value = newOverlay

  sendEvents(newValue, newOverlay, oldOverlay)
}

const openDialog = (content: string): void => {
  const newValue = true
  const oldOverlay = overlay.value
  const newOverlay = content

  dialog.value = newValue
  overlay.value = newOverlay

  sendEvents(newValue, newOverlay, oldOverlay)
}

const onSpeedUp = () => {
  if (g.value) {
    g.value.speedUp()
  }
}

const onSpeedDown = () => {
  if (g.value) {
    g.value.speedDown()
  }
}

const onTogglePause = () => {
  if (g.value) {
    g.value.togglePause()
  }
}

watch(dialog, (newValue) => {
  if (newValue === false) {
    sendEvents(newValue, '', overlay.value)
  } else {
    sendEvents(newValue, overlay.value, '')
  }
})


const hud: ReplayHud = {
  setPuzzleCut: () => {
    cuttingPuzzle.value = false
  },
  setPlayers: (v: any) => {
    players.value = v
  },
  setStatus: (v: any) => {
    status.value = v
  },
  setConnectionState: (v: any) => {
    connectionState.value = v
  },
  togglePreview: (v: boolean) => {
    if (v) {
      openDialog('preview')
    } else {
      closeDialog()
    }
  },
  toggleInterface: (v: any) => {
    showInterface.value = !!v
  },
  addStatusMessage,
  setReplaySpeed: (v: number) => {
    replay.value.speed = v
  },
  setReplayPaused: (v: boolean) => {
    replay.value.paused = v
  },
}

onMounted(async () => {
  if (!route.params.id) {
    return
  }

  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  window.addEventListener('resize', onResize)

  const game = new GameReplay(
    `${route.params.id}`,
    api.clientId(),
    config.get().WS_ADDRESS,
    canvasEl.value,
    hud,
  )

  await game.init()
  g.value = game
})

onUnmounted(() => {
  if (g.value) {
    g.value.unload()
    g.value = null
  }
  window.removeEventListener('resize', onResize)
})
</script>
