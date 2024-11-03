<template>
  <div id="replay">
    <v-dialog
      v-model="dialog"
      :class="`overlay-${overlay}`"
      :persistent="dialogPersistent"
    >
      <SettingsOverlay
        v-if="g && overlay === 'settings'"
        :game="g"
        @dialog-change="onDialogChange"
      />
      <PreviewOverlay
        v-if="g && overlay === 'preview'"
        :game="g"
        @close="closeDialog"
      />
      <InfoOverlay
        v-if="g && overlay === 'info'"
        :game="g"
      />
      <HelpOverlay v-if="overlay === 'help'" />
    </v-dialog>

    <CuttingOverlay v-model="cuttingPuzzle" />

    <div
      v-if="showInterface"
      class="menu-left"
    >
      <PuzzleStatus :status="status" />
      <div
        v-if="g"
        class="playback-control"
      >
        <div>{{ replayText }}</div>
        <button
          class="btn"
          @click="onSpeedUp"
        >
          <icon icon="speed-up" />
        </button>
        <button
          class="btn"
          @click="onSpeedDown"
        >
          <icon icon="speed-down" />
        </button>
        <button
          class="btn"
          @click="onTogglePause"
        >
          <icon :icon="replay.paused ? 'replay' : 'pause'" />
        </button>
      </div>
      <div
        v-if="g"
        class="switch-game-replay"
      >
        <router-link :to="{ name: 'game', params: { id: g.getGameId() } }">
          <icon icon="puzzle-piece" /> To the game
        </router-link>
      </div>
    </div>


    <div
      v-if="showInterface"
      class="menu-right-bottom"
      :class="showTimelapseInterface ? 'menu-is-expanded' : ''"
    >
      <span
        class="is-clickable"
        @click="showTimelapseInterface = !showTimelapseInterface"
      >Timelapse Video</span>
      <div v-if="showTimelapseInterface">
        <fieldset class="pb-0 pt-0">
          <legend>Autostart Replay</legend>
          <v-checkbox
            v-model="autostartReplay"
            hide-details
            label="Active"
            density="compact"
          />
          <v-text-field
            v-if="autostartReplay"
            v-model="autostartReplayDelay"
            type="number"
            label="Delay (ms)"
            density="compact"
          />
        </fieldset>
        <fieldset class="pb-0 pt-0">
          <legend>Autostop Replay</legend>
          <v-checkbox
            v-model="autostopReplay"
            hide-details
            label="Active"
            density="compact"
          />
        </fieldset>
        <fieldset class="pb-0 pt-0">
          <legend>Autostop Recording</legend>
          <v-checkbox
            v-model="autostopRecording"
            hide-details
            label="Active"
            density="compact"
          />
          <v-text-field
            v-if="autostopRecording"
            v-model="autostopRecordingDelay"
            type="number"
            label="Delay (ms)"
            density="compact"
          />
        </fieldset>
        <div class="mb-2">
          <v-btn
            v-if="!isRecording"
            prepend-icon="mdi-record-circle"
            size="small"
            @click="startRecording"
          >
            RECORD
          </v-btn>
          <v-btn
            v-else
            size="small"
            prepend-icon="mdi-stop"
            @click="stopRecording"
          >
            STOP RECORDING
          </v-btn>
        </div>
        <div
          v-if="videoUrl"
          class="mb-2"
        >
          <video
            :src="videoUrl"
            controls
            style="max-width: 100%"
          />
          <a
            :href="videoUrl"
            style="display: block"
            download="replay"
          >Download Video</a>
        </div>
      </div>
    </div>

    <IngameMenu
      v-if="showInterface"
      @open-dialog="openDialog"
    />

    <div
      v-if="showInterface && g"
      class="menu-right"
    >
      <Scores
        :players="players"
        :registered-map="registeredMap"
        :game="g"
      />
    </div>

    <StatusMessages ref="statusMessages" />

    <canvas ref="canvasEl" />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue'
import { ReplayHud, GameStatus, GamePlayers, CONN_STATE, RegisteredMap, GameId, DialogChangeData, InsufficentAuthDetails } from '../../../common/src/Types'
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
import StatusMessages from '../components/StatusMessages.vue'
import IngameMenu from '../components/IngameMenu.vue'
import isEqual from 'lodash/isEqual'

const statusMessages = ref<InstanceType<typeof StatusMessages>>() as Ref<InstanceType<typeof StatusMessages>>
const players = ref<GamePlayers>({ active: [], idle: [], banned: [] })
const status = ref<GameStatus>({ finished: false, duration: 0, piecesDone: 0, piecesTotal: 0 })
const dialog = ref<boolean>(false)
const dialogPersistent = ref<boolean | undefined>(undefined)
const overlay = ref<string>('')
const insufficientAuthDetails = ref<InsufficentAuthDetails | null>(null)
const connectionState = ref<number>(0)
const cuttingPuzzle = ref<boolean>(true)
const showInterface = ref<boolean>(true)
const canvasEl = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
const registeredMap = ref<RegisteredMap>({})

const g = ref<GameReplay | null>(null)

const replay = ref<{ speed: number, paused: boolean }>({ speed: 1, paused: false })

const route = useRoute()

const replayText = computed((): string => {
  return 'Replay-Speed: ' +
    (replay.value.speed + 'x') +
    (replay.value.paused ? ' Paused' : '')
})

const onDialogChange = (change: DialogChangeData): void => {
  if (change.type === 'persistent') {
    dialogPersistent.value = change.value
  }
}

const onResize = (): void => {
  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  if (g.value) {
    g.value.requireRerender()
  }
}

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: any[] = []
const mediaRecorderToStop = ref<boolean>(false)
const isRecording = ref<boolean>(false)
const videoUrl = ref<string>('')
const autostopRecording = ref<boolean>(true)
const autostopRecordingDelay = ref<number>(1000)
const autostartReplay = ref<boolean>(true)
const autostartReplayDelay = ref<number>(250)
const autostopReplay = ref<boolean>(true)
const showTimelapseInterface = ref<boolean>(false)
const startRecording = () => {
  if (!g.value) {
    return
  }
  isRecording.value = true
  videoUrl.value = ''
  if (autostartReplay.value) {
    g.value.unpause()
  }

  const stream = canvasEl.value.captureStream(25 /*fps*/)
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm; codecs=vp9',
  })

  recordedChunks = []

  //ondataavailable will fire in interval of `time || 4000 ms`
  mediaRecorder.start(1000)
  mediaRecorder.ondataavailable = function (event) {
    recordedChunks.push(event.data)
    if (mediaRecorderToStop.value) {
      mediaRecorder?.stop()
    }
  }

  mediaRecorder.onstop = function () {
    isRecording.value = false
    mediaRecorderToStop.value = false
    if (!g.value) {
      return
    }
    if (autostopReplay.value) {
      g.value.pause()
    }

    const blob = new Blob(recordedChunks, { type: 'video/webm' })
    videoUrl.value = URL.createObjectURL(blob)
  }
}
const stopRecording = () => {
  mediaRecorderToStop.value = true
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
  setPlayers: (v: GamePlayers, r: RegisteredMap) => {
    if (!isEqual(v, players.value)) {
      players.value = v
    }
    if (!isEqual(r, registeredMap.value)) {
      registeredMap.value = r
    }
  },
  setStatus: (v: GameStatus) => {
    status.value = v
  },
  setConnectionState: (v: CONN_STATE) => {
    connectionState.value = v
  },
  setConnectError: (e: InsufficentAuthDetails) => {
    connectionState.value = CONN_STATE.INSUFFICIENT_AUTH
    insufficientAuthDetails.value = e
  },
  togglePreview: (v: boolean) => {
    if (v) {
      openDialog('preview')
    } else {
      closeDialog()
    }
  },
  toggleInterface: (v: boolean) => {
    showInterface.value = !!v
  },
  addStatusMessage: (what: string, value: any) => statusMessages.value.addMessage(what, value),
  setReplaySpeed: (v: number) => {
    replay.value.speed = v
  },
  setReplayPaused: (v: boolean) => {
    replay.value.paused = v
  },
  setReplayFinished: () => {
    if (isRecording.value && autostopRecording.value) {
      if (autostopRecordingDelay.value > 0) {
        setTimeout(() => {
          stopRecording()
        }, autostopRecordingDelay.value)
      } else {
        stopRecording()
      }
    }
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
    `${route.params.id}` as GameId,
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
