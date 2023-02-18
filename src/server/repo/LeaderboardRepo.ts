import { LeaderboardRow } from '../../common/Types'
import Db from '../Db'

export class LeaderboardRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  public async updateLeaderboard(): Promise<void> {
    await this.db.txn(async () => {
      await this.db.run('truncate leaderboard')
      const relevantUsers = await this.db._getMany(`
        select u.id from users u
          inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'local'
          inner join accounts a on a.id::text = ui.provider_id and a.status = 'verified'
        union
        select u.id from users u
          inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'twitch'
      `)
      const where = this.db._buildWhere({ user_id: { '$in': relevantUsers.map(row => row.id) } })
      const rows = await this.db._getMany(`
        select
          uxg.user_id,
          count(uxg.game_id)::int as games_count,
          sum(uxg.pieces_count)::int as pieces_count
        from user_x_game uxg
        inner join games g on g.id = uxg.game_id and g.finished is not null and g.private = 0
        ${where.sql}
        group by uxg.user_id
        order by pieces_count desc, games_count desc
      `, where.values)
      let i = 1
      for (const row of rows) {
        row.rank = i++
        this.db.insert('leaderboard', row)
      }
    })
  }

  public async getByUserId(userId: number): Promise<LeaderboardRow> {
    return await this.db._get(`
      select
        lb.*, u.name as user_name
      from leaderboard lb
        inner join users u on u.id = lb.user_id
      where lb.user_id = $1
    `, [userId])
  }

  public async getTop10(): Promise<LeaderboardRow[]> {
    return await this.db._getMany(`
      select
        lb.*, u.name as user_name
      from leaderboard lb
        inner join users u on u.id = lb.user_id
      order by
        lb.pieces_count desc,
        lb.games_count desc
      limit 10
    `)
  }
}
