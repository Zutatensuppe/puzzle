import Crypto from '../Crypto'
import type Db from '../lib/Db'
import type { WhereRaw } from '../lib/Db'
import type { UserAvatar, UserAvatarId, UserAvatarRow, UserGroupRow, UserId, UserRow } from '@common/Types'
import config from '../Config'
import DbData from '../app/DbData'

export class UsersRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async count(): Promise<number> {
    return await this.db.count(DbData.Tables.Users)
  }

  async getAll(offset: number, limit: number): Promise<UserRow[]> {
    return await this.db.getMany(DbData.Tables.Users, undefined, [{ id: -1 }], { offset, limit })
  }

  async insert(user: Omit<UserRow, 'id'>): Promise<UserId> {
    if (user.email) {
      user.email = Crypto.encrypt(user.email)
    }
    return await this.db.insert(DbData.Tables.Users, user, 'id') as UserId
  }

  async update(user: UserRow): Promise<void> {
    if (user.email) {
      user.email = Crypto.encrypt(user.email)
    }
    await this.db.update(DbData.Tables.Users, user, { id: user.id })
  }

  async getMany(where: WhereRaw): Promise<UserRow[]> {
    return await this.db.getMany(DbData.Tables.Users, where)
  }

  async getManyByIds(ids: UserId[]): Promise<UserRow[]> {
    if (ids.length === 0) {
      return []
    }
    return await this.db.getMany(DbData.Tables.Users, { id: { '$in': ids } })
  }

  async get(where: WhereRaw): Promise<UserRow | null> {
    if (where.email) {
      where.email = Crypto.encrypt(where.email)
    }
    const user = await this.db.get<UserRow>(DbData.Tables.Users, where)
    if (user) {
      if (user.email) {
        user.email = Crypto.decrypt(user.email)
      }
    }
    return user
  }

  public async getUserAvatarByUserId(userId: UserId): Promise<UserAvatar | null> {
    const row = await this.db._get<UserAvatarRow & { user_id: UserId }>(`
      SELECT
        a.*,
        s.user_id
      FROM
        ${DbData.Tables.UserAvatars} a
      INNER JOIN
        ${DbData.Tables.UserSettings} s on s.avatar_id = a.id
      INNER JOIN
        ${DbData.Tables.Users} u on u.id = s.user_id
      WHERE
        u.id = $1
      ;
    `, [userId])
    if (!row) {
      return null
    }

    const avatar: UserAvatar = {
      created: (new Date(row.created)).getTime(),
      filename: row.filename,
      height: row.height,
      width: row.width,
      id: row.id,
      url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(row.filename)}`,
      userId: row.user_id,
    }
    return avatar
  }

  public async getUserAvatarRow(userAvatarId: UserAvatarId): Promise<UserAvatarRow | null> {
    return await this.db.get(DbData.Tables.UserAvatars, { id: userAvatarId })
  }

  async getGroupsByUserId(userId: UserId): Promise<UserGroupRow[]> {
    return await this.db._getMany<UserGroupRow>(`
      SELECT ug.*
      FROM ${DbData.Tables.UserXUserGroup} x
      INNER JOIN ${DbData.Tables.UserGroups} ug ON ug.id = x.user_group_id
      WHERE x.user_id = $1
    `, [userId])
  }

  async getUserGroupByName(name: string): Promise<UserGroupRow | null> {
    return await this.db.get(DbData.Tables.UserGroups, { name })
  }

  async isInGroup(userId: UserId, groupName: string): Promise<boolean> {
    const group = await this.getUserGroupByName(groupName)
    if (!group) {
      return false
    }
    const userXGroup = await this.db.get(DbData.Tables.UserXUserGroup, {
      user_group_id: group.id,
      user_id: userId,
    })
    return !!userXGroup
  }

  async getUserGroups(): Promise<UserGroupRow[]> {
    return await this.db.getMany(DbData.Tables.UserGroups, undefined, [{ id: -1 }])
  }
}
