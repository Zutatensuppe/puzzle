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
    return await this.db.insert(TABLE, user, 'id') as number
  }

  async update(user: UserRow): Promise<void> {
    await this.db.update(TABLE, user, { id: user.id })
  }

  async get(where: WhereRaw): Promise<UserRow | null> {
    const user = await this.db.get(TABLE, where)
    if (user) {
      user.id = parseInt(user.id, 10)
    }
    return user
  }
  async getGroupsByUserId(userId: number): Promise<UserGroupRow[]> {
    const relations = await this.db.getMany('user_x_user_group', { user_id: userId })
    const groupIds = relations.map(r => r.user_group_id)
    return await this.db.getMany('user_groups', { id: { '$in': groupIds }}) as UserGroupRow[]
  }
}
