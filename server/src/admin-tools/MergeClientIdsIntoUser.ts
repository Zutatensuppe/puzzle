import Db from '../Db'
import { EncodedPlayer, MergeClientIdsIntoUserResult, Player } from '../Types'
import Util, { logger } from '../../../common/src/Util'

const log = logger()

export class MergeClientIdsIntoUser {
  constructor(
    private db: Db,
  ) { }

  async run(
    userId: number,
    clientIds: string[],
    dry: boolean,
  ): Promise<MergeClientIdsIntoUserResult> {
    const result: MergeClientIdsIntoUserResult = {
      dry,
      updatedGameIds: [],
      updatedImageIds: [],
      removedUserIds: [],
      userIdsWithIdentities: [],
      userIdsWithoutIdentities: [],
    }
    const gameRows = await this.db.getMany('games')
    const user = await this.db.get('users', { id: userId })
    log.info('fixing ' + user.name + ' (id: ' + user.id + ')')

    const tmpUsers = await this.db.getMany('users', { client_id: { '$in': clientIds } })
    const identities = await this.db.getMany('user_identity', { user_id: { '$in': tmpUsers.map(u => u.id) } })
    const userIdsWithIdentities = identities.map(i => i.user_id)
    const userIdsWithoutIdentities = tmpUsers.map(u => u.id).filter(id => !userIdsWithIdentities.includes(id))
    result.userIdsWithIdentities = userIdsWithIdentities
    result.userIdsWithoutIdentities = userIdsWithoutIdentities

    const clientIdsToBeExcluded = userIdsWithIdentities.length > 0
      ? (await this.db._getMany('select client_id from users where id in (' + userIdsWithIdentities.join(',') + ') and id != ' + user.id)).map(row => row.client_id)
      : []

    const clientIdsOfUser = clientIds.filter(clientId => !clientIdsToBeExcluded.includes(clientId))

    const otherUserIdsOfUser = userIdsWithoutIdentities
    const userIdsOfUser = [user.id, ...otherUserIdsOfUser]

    // update games
    for (const gameRow of gameRows) {
      const data = JSON.parse(gameRow.data)

      // check if target player already exists in the players array
      const decodedPlayers: Player[] = data.players.map((player: EncodedPlayer) => Util.decodePlayer(player))

      let needUpdate = false
      let targetPlayer: Player | undefined = decodedPlayers.find((p: Player) => user.client_id === p.id)
      if (!targetPlayer) {
        targetPlayer = decodedPlayers.find((p: Player) => clientIdsOfUser.includes(p.id))
        needUpdate = true
      }
      if (targetPlayer) {
        const playersOfUser = decodedPlayers.filter((p: Player) => clientIdsOfUser.includes(p.id))
        if (playersOfUser.length > 1) {
          needUpdate = true
        }

        if (needUpdate) {
          // combine all of user points to the target user
          let points = 0
          playersOfUser.forEach((p: Player) => {
            points += p.points
          })
          targetPlayer.points = points
          targetPlayer.id = user.client_id

          // leave other players untouched
          const otherPlayers = decodedPlayers.filter((p: Player) => !clientIdsOfUser.includes(p.id) && p !== targetPlayer)
          const newPlayers = [targetPlayer, ...otherPlayers].map((p: Player) => Util.encodePlayer(p))
          data.players = newPlayers

          log.info(`updating user ${user.name} in game ${gameRow.id}.`)
          if (!dry) {
            await this.db.update('games', { data: JSON.stringify(data) }, { id: gameRow.id })
          }
          result.updatedGameIds.push(gameRow.id)
        }
      }
    }

    // update images
    const imageRows = await this.db.getMany('images', { uploader_user_id: { '$in': otherUserIdsOfUser } })
    if (imageRows.length > 0) {
      log.info(`updating images uploader from ${otherUserIdsOfUser.join('|')} to ${user.id}.`)
      if (!dry) {
        await this.db.update('images', { uploader_user_id: user.id }, { uploader_user_id: { '$in': otherUserIdsOfUser } })
      }
      result.updatedImageIds.push(...imageRows.map(row => row.id))
    }

    const userXgames = await this.db.getMany('user_x_game', { user_id: { '$in': userIdsOfUser } })
    if (userXgames.length > 0) {
      let needUpdate = false
      const piecesCountByGame: Record<string, number> = {}
      for (const userXgame of userXgames) {
        if (userXgame.user_id !== user.id) {
          needUpdate = true
        }
        piecesCountByGame[userXgame.game_id] = piecesCountByGame[userXgame.game_id] || 0
        piecesCountByGame[userXgame.game_id] += userXgame.pieces_count
      }
      if (needUpdate) {
        for (const gameId of Object.keys(piecesCountByGame)) {
          log.info(`updating uxer_x_game ${gameId} entries from ${otherUserIdsOfUser.join('|')} to ${user.id}. new pieces count: ${piecesCountByGame[gameId]}.`)
          if (!dry) {
            await this.db.delete('user_x_game', { game_id: gameId, user_id: { '$in': userIdsOfUser } })
            await this.db.insert('user_x_game', { game_id: gameId, user_id: user.id, pieces_count: piecesCountByGame[gameId] })
          }
        }
      }
    }

    // update users
    const userRows = await this.db.getMany('users', { id: { '$in': otherUserIdsOfUser } })
    if (userRows.length > 0) {
      log.info(`removing other user entries ${otherUserIdsOfUser.join('|')} of ${user.id}.`)
      if (!dry) {
        await this.db.delete('users', { id: { '$in': otherUserIdsOfUser } })
      }
      result.removedUserIds.push(...otherUserIdsOfUser)
    }

    return result
  }
}
