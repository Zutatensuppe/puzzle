import Crypto from '../Crypto'
import Db, { WhereRaw } from '../Db'
import { ClientId, UserGroupId, UserId } from '../../../common/src/Types'

const TABLE = 'users'

export interface UserRow {
  id: UserId
  created: Date
  client_id: ClientId
  name: string
  email: string
}

export interface UserGroupRow {
  id: UserGroupId
  name: string
}

export class UsersRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async count(): Promise<number> {
    return await this.db.count(TABLE)
  }

  async getAll(offset: number, limit: number): Promise<UserRow[]> {
    return await this.db.getMany(TABLE, undefined, [{ id: -1 }], { offset, limit })
  }

  async insert(user: Omit<UserRow, 'id'>): Promise<UserId> {
    if (user.email) {
      user.email = Crypto.encrypt(user.email)
    }
    return await this.db.insert(TABLE, user, 'id') as UserId
  }

  async update(user: UserRow): Promise<void> {
    if (user.email) {
      user.email = Crypto.encrypt(user.email)
    }
    await this.db.update(TABLE, user, { id: user.id })
  }

  async getMany(where: WhereRaw): Promise<UserRow[]> {
    return await this.db.getMany(TABLE, where)
  }

  async get(where: WhereRaw): Promise<UserRow | null> {
    if (where.email) {
      where.email = Crypto.encrypt(where.email)
    }
    const user = await this.db.get(TABLE, where)
    if (user) {
      user.id = parseInt(user.id, 10)
      if (user.email) {
        user.email = Crypto.decrypt(user.email)
      }
    }
    return user
  }

  async getGroupsByUserId(userId: UserId): Promise<UserGroupRow[]> {
    const relations = await this.db.getMany('user_x_user_group', { user_id: userId })
    const groupIds = relations.map(r => r.user_group_id)
    return await this.db.getMany('user_groups', { id: { '$in': groupIds }}) as UserGroupRow[]
  }

  async getUserGroupByName(name: string): Promise<UserGroupRow | null> {
    return await this.db.get('user_groups', { name })
  }

  async isInGroup(userId: UserId, groupName: string): Promise<boolean> {
    const adminGroup = await this.getUserGroupByName(groupName)
    if (!adminGroup) {
      return false
    }
    const userXAdmin = await this.db.get('user_x_user_group', {
      user_group_id: adminGroup.id,
      user_id: userId,
    })
    return !!userXAdmin
  }

  async getUserGroups(): Promise<UserGroupRow[]> {
    return await this.db.getMany('user_groups', undefined, [{ id: -1 }])
  }
}
