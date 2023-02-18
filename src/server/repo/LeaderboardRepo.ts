import { Leaderboard, LeaderboardEntry } from '../../common/Types'
import Db, { WhereRaw } from '../Db'

interface LeaderboardRow {
  id: number
  name: string
}

export class LeaderboardRepo {
  private readonly LEADERBOARDS = [
    { name: 'overall', minPieces: -1, maxPieces: -1 },
    { name: '1000+', minPieces: 1000, maxPieces: -1 },
    { name: '500+', minPieces: 500, maxPieces: 999 },
    { name: '100+', minPieces: 100, maxPieces: 499 },
  ]

  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  public async updateLeaderboards(): Promise<void> {
    await this.db.txn(async () => {
      await this.db.run('truncate leaderboard_entries')

      for (const lb of this.LEADERBOARDS) {
        const leaderboardId = await this.db.upsert('leaderboard', { name: lb.name }, { name: lb.name }, 'id')
        const whereRaw: WhereRaw = {}
        if (lb.minPieces >= 0) {
          whereRaw['g.pieces_count'] = whereRaw['g.pieces_count'] || {}
          whereRaw['g.pieces_count']['$gte'] = lb.minPieces
        }
        if (lb.maxPieces >= 0) {
          whereRaw['g.pieces_count'] = whereRaw['g.pieces_count'] || {}
          whereRaw['g.pieces_count']['$lte'] = lb.maxPieces
        }

        const where = this.db._buildWhere(whereRaw)
        const rows = await this.db._getMany(`
          with relevant_users as (
            select u.id from users u
              inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'local'
              inner join accounts a on a.id::text = ui.provider_id and a.status = 'verified'
            union
            select u.id from users u
              inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'twitch'
          ),
          tmp as (
            select
              uxg.user_id,
              count(uxg.game_id)::int as games_count,
              sum(uxg.pieces_count)::int as pieces_count
            from user_x_game uxg
            inner join games g on g.id = uxg.game_id and g.finished is not null and g.private = 0
            ${where.sql}
            group by uxg.user_id
          )
          select
            u.id as user_id,
            coalesce(tmp.games_count, 0) as games_count,
            coalesce(tmp.pieces_count, 0) as pieces_count
          from relevant_users u
          left join tmp on tmp.user_id = u.id
          order by pieces_count desc, games_count desc
        `, where.values)
        let i = 1
        for (const row of rows) {
          row.leaderboard_id = leaderboardId
          row.rank = row.pieces_count ? i : 0
          this.db.insert('leaderboard_entries', row)
          i++
        }
      }
    })
  }

  public async getTop10(userId: number): Promise<Leaderboard[]> {
    const leaderboards: Leaderboard[] = []
    for (const lb of this.LEADERBOARDS) {
      const leaderboard: LeaderboardRow = await this.db.get('leaderboard', { name: lb.name })
      const leaderboardUserEntry: LeaderboardEntry | null = userId ? await this.db._get(`
        select
          lbe.*, u.name as user_name
        from leaderboard_entries lbe
          inner join users u on u.id = lbe.user_id
        where lbe.user_id = $1 and lbe.leaderboard_id = $2
      `, [userId, leaderboard.id]) : null
      const leaderboardEntries: LeaderboardEntry[] = await this.db._getMany(`
        select
          lbe.*, u.name as user_name
        from leaderboard_entries lbe
          inner join users u on u.id = lbe.user_id
        where
          lbe.leaderboard_id = $1
          and lbe.pieces_count > 0
        order by
          lbe.pieces_count desc,
          lbe.games_count desc
        limit 10
      `, [leaderboard.id])
      leaderboards.push({
        id: leaderboard.id,
        name: leaderboard.name,
        entries: leaderboardEntries,
        userEntry: leaderboardUserEntry,
      })
    }
    return leaderboards
  }
}
