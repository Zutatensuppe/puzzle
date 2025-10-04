import type Db from '../Db'
import type { Leaderboard, LeaderboardEntry, LeaderboardId, UserId } from '../../../common/src/Types'

interface LeaderboardRow {
  id: LeaderboardId
  name: string
}

interface LeaderboardEntryRow {
  leaderboard_id: number
  rank: number
  user_id: UserId
  games_count: number
  pieces_count: number
}

export class LeaderboardRepo {
  private readonly LEADERBOARD_ALLTIME = 'alltime'
  private readonly LEADERBOARD_7_DAYS = 'week'
  private readonly LEADERBOARD_30_DAYS = 'month'

  private readonly LEADERBOARDS = [
    { name: this.LEADERBOARD_ALLTIME },
    { name: this.LEADERBOARD_7_DAYS },
    { name: this.LEADERBOARD_30_DAYS },
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
        const leaderboardId = await this.db.upsert('leaderboard', { name: lb.name }, ['name'], 'id')
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
            where
              uxg.pieces_count > 0
              ${
                lb.name === 'week' ? `and g.finished > (current_timestamp - interval '1 week')` :
                lb.name === 'month' ? `and g.finished > (current_timestamp - interval '1 month')` :
                ''
              }
            group by uxg.user_id
          )
          select
            u.id as user_id,
            coalesce(tmp.games_count, 0) as games_count,
            coalesce(tmp.pieces_count, 0) as pieces_count
          from relevant_users u
          left join tmp on tmp.user_id = u.id
          order by pieces_count desc, games_count desc
        `)
        let i = 1
        for (const row of rows) {
          row.leaderboard_id = leaderboardId
          row.rank = row.pieces_count ? i : 0
          i++
        }
        await this.db.insertMany('leaderboard_entries', rows)
      }
    })
  }

  public async getTop10(userId: UserId): Promise<Leaderboard[]> {
    const leaderboards: Leaderboard[] = []
    for (const lb of this.LEADERBOARDS) {
      const leaderboard: LeaderboardRow | null = await this.db.get('leaderboard', { name: lb.name })
      if (!leaderboard) {
        continue
      }
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

  public async getLeaderboardRanks(userId: UserId): Promise<Record<string, { rank: number, piecesCount: number }>> {
    const entries: LeaderboardEntryRow[] = await this.db.getMany(
      'leaderboard_entries',
      { user_id: userId },
    )

    const leaderboards: LeaderboardRow[] = await this.db.getMany('leaderboard')

    const ranks: Record<string, { rank: number, piecesCount: number }> = {}
    for (const leaderboard of leaderboards) {
      const val = entries.find(entry => entry.leaderboard_id === leaderboard.id)
      ranks[leaderboard.name] = { rank: val?.rank ?? 0, piecesCount: val?.pieces_count ?? 0 }
    }
    return ranks
  }
}
