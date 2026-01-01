'use strict'

import GameCommon from '@common/GameCommon'
import { Game } from './Game'
import Communication from './Communication'
import Util from '@common/Util'
import Time from '@common/Time'
import { createImageSnapshot } from './ImageSnapshotCreator'
import type { Game as GameType, EncodedGame, EncodedGameLegacy, Hud, GameEvent, ServerUpdateEvent, ServerSyncEvent, ServerErrorDetails } from '@common/Types'
import { ConnectionStatesEnum, SoundsEnum } from '@common/Constants'

export class GamePlay extends Game<Hud> {

  private updateStatusInterval: ReturnType<typeof setTimeout> | null = null
  private lastSentImageSnapshotTs: number = 0
  private snapshotsIntervalMs: number = 5 * Time.MIN
  public joinPassword: string = ''

  private async connect(): Promise<void> {
    Communication.onConnectionStateChange(connectionState => {
      this.hud.setConnectionState(connectionState)
    })

    const game: EncodedGame | EncodedGameLegacy = await Communication.connect(this)
    const gameObject: GameType = Util.decodeGame(game)
    GameCommon.setGame(gameObject.id, gameObject)

    this.requireRerender()
  }

  public unload(): void {
    if (this.updateStatusInterval) {
      clearInterval(this.updateStatusInterval)
    }
    this.stopGameLoop()
    this.unregisterEvents()
    Communication.disconnect()
  }

  public handleEvent(evt: GameEvent): void {
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
    if (this.playerSettings.soundsEnabled()) {
      if (ret.anySnapped) {
        this.sounds.playSound(SoundsEnum.PIECE_CONNECTED)
      }
      if (ret.anyRotated && this.playerSettings.rotateSoundEnabled()) {
        this.sounds.playSound(SoundsEnum.PIECE_ROTATED)
      }
    }
    if (ret.anyDropped) {
      if (ts - this.lastSentImageSnapshotTs > this.snapshotsIntervalMs) {
        this.lastSentImageSnapshotTs = ts
        if (this.rendererWebgl) {
          const imageStr = createImageSnapshot(this.gameId, this.rendererWebgl)
          Communication.sendImageSnapshot(imageStr, ts)
          this.rerender = true
        } else if (this.rendererCanvas2d) {
          const imageStr = createImageSnapshot(this.gameId, this.rendererCanvas2d)
          Communication.sendImageSnapshot(imageStr, ts)
        }
      }
    }

    Communication.sendClientEvent(evt)
  }

  private initStatusInterval(): void {
    if (this.updateStatusInterval) {
      clearInterval(this.updateStatusInterval)
    }
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
      GameCommon.setBanned(gameObject.id, gameObject.banned)
    })
  }

  public setJoinPassword(password: string): void {
    this.joinPassword = password
  }

  public async init(): Promise<void> {
    try {
      await this.connect()
      await this.initBaseProps()
      this.initStatusInterval()
      this.initServerEventCallbacks()
      this.initGameLoop()
    } catch (e) {
      this.hud.setConnectionState({ state: ConnectionStatesEnum.SERVER_ERROR, errorDetails: e as ServerErrorDetails })
      this.rerender = false
    }
  }
}
