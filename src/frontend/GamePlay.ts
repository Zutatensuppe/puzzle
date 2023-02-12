"use strict"

import GameCommon from '../common/GameCommon'
import Protocol from '../common/Protocol'
import { Game as GameType, EncodedGame, Hud, ServerEvent, GameEvent } from '../common/Types'
import { Game } from './Game'
import Communication from './Communication'
import Util from '../common/Util'

export class GamePlay extends Game<Hud> {

  private updateStatusInterval: NodeJS.Timeout | null = null

  async connect(): Promise<void> {
    Communication.onConnectionStateChange((state) => {
      this.hud.setConnectionState(state)
    })

    const game: EncodedGame = await Communication.connect(this)
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
    const changes = GameCommon.handleInput(this.gameId, this.clientId, evt, ts)
    if (this.playerSettings.soundsEnabled()) {
      if (changes.find(change => change[0] === Protocol.PLAYER_SNAP)) {
        this.sounds.playPieceConnected()
      }
    }
    if (changes.length > 0) {
      this.requireRerender()
    }
    Communication.sendClientEvent(evt)
  }

  private initStatusInterval(): void {
    this.updateStatusInterval = setInterval(() => {
      this.puzzleStatus.update(this.time())
    }, 1000)
  }

  private initServerEventCallbacks(): void {
    Communication.onServerChange((msg: ServerEvent) => {
      this.onServerEvent(msg)
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
