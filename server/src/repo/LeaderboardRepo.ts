import DbData from '../app/DbData'
import type Db from '../lib/Db'
import type { Leaderboard, LeaderboardEntry, LeaderboardId, UserId } from '@common/Types'

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

interface LeaderboardDataRow {
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
      await this.db.run(`truncate ${DbData.Tables.LeaderboardEntries}`)

      for (const lb of this.LEADERBOARDS) {
        await this.updateLeaderboard(lb.name)
      }
    })
  }

  private async updateLeaderboard(
    leaderboardName: string,
  ): Promise<void> {
    const rows = await this.queryLeaderboardData(leaderboardName)
    const leaderboardId = await this.db.upsert(DbData.Tables.Leaderboard, { name: leaderboardName }, ['name'], 'id')
    const entryRows: LeaderboardEntryRow[] = rows.map((row, i) => ({
      games_count: row.games_count,
      leaderboard_id: leaderboardId,
      pieces_count: row.pieces_count,
      rank: row.pieces_count ? i + 1 : 0,
      user_id: row.user_id,
    }))
    await this.db.insertMany(DbData.Tables.LeaderboardEntries, entryRows)
  }

  private queryLeaderboardData(
    leaderboardName: string,
  ): Promise<LeaderboardDataRow[]> {
    return this.db._getMany<LeaderboardDataRow>(`
      with relevant_users as (
        select u.id from ${DbData.Tables.Users} u
          inner join ${DbData.Tables.UserIdentity} ui on ui.user_id = u.id and ui.provider_name = 'local'
          inner join ${DbData.Tables.Accounts} a on a.id::text = ui.provider_id and a.status = 'verified'
        union
        select u.id from ${DbData.Tables.Users} u
          inner join ${DbData.Tables.UserIdentity} ui on ui.user_id = u.id and ui.provider_name = 'twitch'
      ),
      tmp as (
        select
          uxg.user_id,
          count(uxg.game_id)::int as games_count,
          sum(uxg.pieces_count)::int as pieces_count
        from ${DbData.Tables.UserXGame} uxg
        inner join ${DbData.Tables.Games} g on g.id = uxg.game_id and g.finished is not null and g.private = 0
        where
          uxg.pieces_count > 0
          ${
            leaderboardName === 'week' ? `and g.finished > (current_timestamp - interval '1 week')` :
            leaderboardName === 'month' ? `and g.finished > (current_timestamp - interval '1 month')` :
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
  }

  public async getTop10Leaderboards(
    userId: UserId,
  ): Promise<Leaderboard[]> {
    const leaderboards: Leaderboard[] = []
    for (const lb of this.LEADERBOARDS) {
      const leaderboard = await this.getTop10Leaderboard(lb.name, userId)
      if (leaderboard) {
        leaderboards.push(leaderboard)
      }
    }
    return leaderboards
  }

  private async getTop10Leaderboard(
    leaderboardName: string,
    userId: UserId,
  ): Promise<Leaderboard | null> {
    const leaderboard = await this.db.get<LeaderboardRow>(DbData.Tables.Leaderboard, { name: leaderboardName })
    if (!leaderboard) {
      return null
    }

    const leaderboardUserEntry = userId ? await this.db._get<LeaderboardEntry>(`
      select
        lbe.*, u.name as user_name
      from ${DbData.Tables.LeaderboardEntries} lbe
        inner join ${DbData.Tables.Users} u on u.id = lbe.user_id
      where lbe.user_id = $1 and lbe.leaderboard_id = $2
    `, [userId, leaderboard.id]) : null

    const leaderboardEntries = await this.db._getMany<LeaderboardEntry>(`
      select
        lbe.*, u.name as user_name
      from ${DbData.Tables.LeaderboardEntries} lbe
        inner join ${DbData.Tables.Users} u on u.id = lbe.user_id
      where
        lbe.leaderboard_id = $1
        and lbe.pieces_count > 0
      order by
        lbe.pieces_count desc,
        lbe.games_count desc
      limit 10
    `, [leaderboard.id])

    return {
      id: leaderboard.id,
      name: leaderboard.name,
      entries: leaderboardEntries,
      userEntry: leaderboardUserEntry,
    }
  }

  public async getLeaderboardRanks(userId: UserId): Promise<Record<string, { rank: number, piecesCount: number }>> {
    const entries = await this.db.getMany<LeaderboardEntryRow>(
      DbData.Tables.LeaderboardEntries,
      { user_id: userId },
    )

    const leaderboards = await this.db.getMany<LeaderboardRow>(DbData.Tables.Leaderboard)

    const ranks: Record<string, { rank: number, piecesCount: number }> = {}
    for (const leaderboard of leaderboards) {
      const val = entries.find(entry => entry.leaderboard_id === leaderboard.id)
      ranks[leaderboard.name] = { rank: val?.rank ?? 0, piecesCount: val?.pieces_count ?? 0 }
    }
    return ranks
  }
}
