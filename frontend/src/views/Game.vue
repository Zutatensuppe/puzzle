<template>
  <div id="game">
    <v-dialog
      v-model="dialog"
      :class="`overlay-${overlay}`"
      :persistent="dialogPersistent || false"
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
    </v-dialog>

    <ConnectionOverlay
      v-if="currentDialog !== Dialogs.CUTTING_OVERLAY_DIALOG || connectionState.errorDetails"
      :connection-state="connectionState"
      @reconnect="reconnect"
      @connect_with_password="connectWithPassword"
    />

    <div
      v-if="showInterface"
      class="menu-left"
    >
      <PuzzleStatus :status="status" />
      <div
        v-if="g?.hasReplay()"
        class="switch-game-replay"
      >
        <router-link :to="{ name: 'replay', params: { id: g.getGameId() } }">
          <icon icon="replay" /> Watch replay
        </router-link>
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
        @ban="banPlayer"
        @unban="unbanPlayer"
      />
    </div>

    <StatusMessages ref="statusMessages" />

    <canvas ref="canvasEl" />
  </div>
</template>
<script setup lang="ts">
import { CONN_STATE } from '../../../common/src/Types'
import type { Hud, GameStatus, GamePlayers, RegisteredMap, GameId, DialogChangeData, ClientId, ConnectionState } from '../../../common/src/Types'
import { GamePlay } from '../GamePlay'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../_api'
import config from '../config'
import ConnectionOverlay from './../components/ConnectionOverlay.vue'
import PreviewOverlay from './../components/PreviewOverlay.vue'
import PuzzleStatus from '../components/PuzzleStatus.vue'
import Scores from './../components/Scores.vue'
import SettingsOverlay from './../components/SettingsOverlay.vue'
import StatusMessages from '../components/StatusMessages.vue'
import IngameMenu from '../components/IngameMenu.vue'
import user from '../user'
import isEqual from 'lodash/isEqual'

import { Dialogs, useDialog } from '../useDialog'

const { openInfoOverlayDialog, openHelpOverlayDialog, openCuttingOverlayDialog, currentDialog, closeDialog: closeDialogX } = useDialog()

const statusMessages = ref<InstanceType<typeof StatusMessages>>() as Ref<InstanceType<typeof StatusMessages>>
const players = ref<GamePlayers>({ active: [], idle: [], banned: [] })
const status = ref<GameStatus>({ finished: false, duration: 0, piecesDone: 0, piecesTotal: 0 })
const dialog = ref<boolean>(false)
const dialogPersistent = ref<boolean | undefined>(undefined)
const overlay = ref<string>('')
const connectionState = ref<ConnectionState>({ state: CONN_STATE.NOT_CONNECTED })

openCuttingOverlayDialog()

const showInterface = ref<boolean>(true)
const canvasEl = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
const registeredMap = ref<RegisteredMap>({})

const g = ref<GamePlay | null>(null)
const route = useRoute()

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

const reconnect = (): void => {
  if (g.value) {
    openCuttingOverlayDialog()
    void g.value.init()
  }
}

const connectWithPassword = (password: string): void => {
  if (g.value) {
    openCuttingOverlayDialog()
    void g.value.setJoinPassword(password)
    void g.value.init()
  }
}

const banPlayer = (id: ClientId) => {
  g.value?.banPlayer(id)
}

const unbanPlayer = (id: ClientId) => {
  g.value?.unbanPlayer(id)
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

  if (content === 'help') {
    openHelpOverlayDialog()
  } else if (content === 'info') {
    if (g.value) {
      openInfoOverlayDialog({
        game: g.value,
      })
    }
  } else {
    dialog.value = newValue
  }
  overlay.value = newOverlay

  sendEvents(newValue, newOverlay, oldOverlay)
}

watch(dialog, (newValue) => {
  if (newValue === false) {
    sendEvents(newValue, '', overlay.value)
  } else {
    sendEvents(newValue, overlay.value, '')
  }
})

const hud: Hud = {
  setPuzzleCut: () => {
    closeDialogX(Dialogs.CUTTING_OVERLAY_DIALOG)
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
  setConnectionState: (newConnectionState: ConnectionState) => {
    if (
      newConnectionState.state === CONN_STATE.SERVER_ERROR ||
      newConnectionState.state === CONN_STATE.DISCONNECTED
    ) {
      closeDialogX(Dialogs.CUTTING_OVERLAY_DIALOG)
    }
    connectionState.value = newConnectionState
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
  addStatusMessage: (what: string, value: number | string | boolean | undefined) => statusMessages.value.addMessage(what, value),
}

const onLoginStateChange = async () => {
  if (g.value) {
    await g.value.reinit(api.clientId())
  }
}

onMounted(async () => {
  if (!route.params.id) {
    return
  }
  user.eventBus.on('login', onLoginStateChange)
  user.eventBus.on('logout', onLoginStateChange)

  canvasEl.value.width = window.innerWidth
  canvasEl.value.height = window.innerHeight
  window.addEventListener('resize', onResize)

  const game = new GamePlay(
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

  user.eventBus.off('login', onLoginStateChange)
  user.eventBus.off('logout', onLoginStateChange)
})
</script>
