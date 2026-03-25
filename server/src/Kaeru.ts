import type { KaeruConfig, UserRow } from '@common/Types'
import { logger } from '@common/Util'
import jwt from 'jsonwebtoken'

const log = logger('Kaeru.ts')

export class Kaeru {
  constructor(private config: KaeruConfig) {
    // pass
  }

  createToken(user: UserRow, avatarUrl: string | null): string | null {
    if (this.config.sso_private_key === 'SOME_KEY') {
      log.info('skipping Kaeru.createToken, sso_private_key is not set')
      return null
    }
    const userData: Record<string, unknown> = {
      id: user.id,
      name: user.name,
    }
    if (user.email) {
      userData.email = user.email
    }
    if (avatarUrl) {
      userData.avatarUrl = avatarUrl
    }
    return jwt.sign(userData, this.config.sso_private_key, { algorithm: 'HS256' })
  }
}
