import jwt from 'jsonwebtoken'
import { CannyConfig } from '../common/Types'
import { UserRow } from './repo/UsersRepo'

export class Canny {
  constructor(private config: CannyConfig) {
    // pass
  }

  createToken(user: UserRow): string | null {
    if (!user.email) {
      return null
    }
    const userData = {
      email: user.email,
      id: user.id,
      name: user.name,
    }
    return jwt.sign(userData, this.config.sso_private_key, { algorithm: 'HS256' })
  }
}
