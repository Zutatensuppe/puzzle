import jwt from 'jsonwebtoken'
import { CannyConfig } from '../../common/src/Types'
import { UserRow } from './repo/UsersRepo'
import { logger } from '../../common/src/Util'

const log = logger('Canny.ts')

export class Canny {
  constructor(private config: CannyConfig) {
    // pass
  }

  createToken(user: UserRow): string | null {
    if (this.config.sso_private_key === 'SOME_KEY') {
      log.info('skipping Canny.createToken, sso_private_key is not set')
    }

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
