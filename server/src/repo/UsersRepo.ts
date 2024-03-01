import Crypto from '../Crypto'
import Db, { WhereRaw } from '../Db'

const TABLE = 'users'

export interface UserRow {
  id: number
  created: Date
  client_id: string
  name: string
  email: string
}

export interface UserGroupRow {
  id: number
  name: string
}

export class UsersRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async insert(user: Partial<UserRow>): Promise<number> {
    if (user.email) {
      user.email = Crypto.encrypt(user.email)
    }
    return await this.db.insert(TABLE, user, 'id') as number
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

  async getGroupsByUserId(userId: number): Promise<UserGroupRow[]> {
    const relations = await this.db.getMany('user_x_user_group', { user_id: userId })
    const groupIds = relations.map(r => r.user_group_id)
    return await this.db.getMany('user_groups', { id: { '$in': groupIds }}) as UserGroupRow[]
  }
}
