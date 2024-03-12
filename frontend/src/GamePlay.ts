'use strict'

import GameCommon from '../../common/src/GameCommon'
import { Game as GameType, EncodedGame, Hud, GameEvent, EncodedGameLegacy, ServerUpdateEvent, ServerSyncEvent } from '../../common/src/Types'
import { Game } from './Game'
import Communication from './Communication'
import Util from '../../common/src/Util'
import { createImageSnapshot } from './ImageSnapshotCreator'

export class GamePlay extends Game<Hud> {

  private updateStatusInterval: number | null = null
  private lastSentImageSnapshotTs: number = 0
  private snapshotsIntervalMs: number = 60000

  async connect(): Promise<void> {
    Communication.onConnectionStateChange((state) => {
      this.hud.setConnectionState(state)
    })

    const game: EncodedGame | EncodedGameLegacy = await Communication.connect(this)
    const gameObject: GameType = Util.decodeGame(game)
    GameCommon.setGame(gameObject.id, gameObject)

    this.requireRerender()
  }

  unload(): void {
    if (this.updateStatusInterval) {
      clearInterval(this.updateStatusInterval)
    }
    this.stopGameLoop()
    this.unregisterEvents()
    Communication.disconnect()
  }

  handleEvent(evt: GameEvent): void {
    // LOCAL ONLY CHANGES
    // -------------------------------------------------------------
    this.handleLocalEvent(evt)

    // LOCAL + SERVER CHANGES
    // -------------------------------------------------------------
    const ts = this.time()
    const ret = GameCommon.handleGameEvent(this.gameId, this.clientId, evt, ts)
    if (ret.changes.length > 0) {
      this.requireRerender()
    }
    if (ret.anySnapped && this.playerSettings.soundsEnabled()) {
      this.sounds.playPieceConnected()
    }
    if (ret.anyDropped) {
      if (ts - this.lastSentImageSnapshotTs > this.snapshotsIntervalMs) {
        this.lastSentImageSnapshotTs = ts
        createImageSnapshot(this.gameId, this.renderer).then((canvas) => {
          Communication.sendImageSnapshot(canvas.toDataURL('image/jpeg', 75), ts)
        })
      }
    }

    Communication.sendClientEvent(evt)
  }

  private initStatusInterval(): void {
    this.updateStatusInterval = setInterval(() => {
      this.puzzleStatus.update(this.time())
    }, 1000)
  }

  private initServerEventCallbacks(): void {
    Communication.onServerUpdate((msg: ServerUpdateEvent) => {
      this.onServerUpdateEvent(msg)
    })
    Communication.onServerSync((msg: ServerSyncEvent) => {
      // TODO: sync complete game instead of just the registeredMap?
      const game: EncodedGame | EncodedGameLegacy = msg[1]
      const gameObject: GameType = Util.decodeGame(game)
      GameCommon.setRegisteredMap(gameObject.id, gameObject.registeredMap)
    })
  }

  async init(): Promise<void> {
    await this.connect()
    await this.initBaseProps()
    this.initStatusInterval()
    this.initServerEventCallbacks()
    this.initGameLoop()
  }
}
