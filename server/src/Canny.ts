import jwt from 'jsonwebtoken'
import { CannyConfig, UserRow } from '../../common/src/Types'
import { logger } from '../../common/src/Util'

const log = logger('Canny.ts')

export class Canny {
  constructor(private config: CannyConfig) {
    // pass
  }

  createToken(user: UserRow): string | null {
    if (!user.email) {
      return null
    }
    if (this.config.sso_private_key === 'SOME_KEY') {
      log.info('skipping Canny.createToken, sso_private_key is not set')
    }
    const userData = {
      email: user.email,
      id: user.id,
      name: user.name,
    }

    // TODO: create this only when needed and cache it
    return jwt.sign(userData, this.config.sso_private_key, { algorithm: 'HS256' })
  }
}
