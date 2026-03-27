import type { ClientId, TwitchConfig, UserRow } from '@common/Types'
import Util, { uniqId } from '@common/Util'
import type { Server } from '../../Server'

interface TwitchOauthTokenResponseData {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string[]
  token_type: string
}

export interface TwitchAuthResult {
  ok: boolean
  userId?: UserRow['id']
}

export class TwitchAuth {
  constructor(
    private readonly server: Server,
    private readonly twitchConfig: TwitchConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
  }

  async handle(
    code: string,
    stateParam: string,
    redirectUris: string[],
  ): Promise<TwitchAuthResult> {
    const body = {
      client_id: this.twitchConfig.client_id,
      client_secret: this.twitchConfig.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: '',
    }

    for (const redirectUri of redirectUris) {
      body.redirect_uri = redirectUri
      const tokenRes = await this.fetchFn(`https://id.twitch.tv/oauth2/token${Util.asQueryArgs(body)}`, {
        method: 'POST',
      })
      if (!tokenRes.ok) {
        continue
      }

      const tokenData = await tokenRes.json() as TwitchOauthTokenResponseData

      const userRes = await this.fetchFn(`https://api.twitch.tv/helix/users`, {
        headers: {
          'Client-ID': this.twitchConfig.client_id,
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })
      if (!userRes.ok) {
        continue
      }

      const userData = await userRes.json()
      const provider_name = 'twitch'
      const provider_id = userData.data[0].id
      const provider_email = userData.data[0].email

      const identity = await this.server.users.getIdentity({
        provider_name,
        provider_id,
      })

      const client_id = String(stateParam || '') as ClientId
      let user: UserRow | null = null
      if (identity) {
        user = await this.server.users.getUserByIdentity(identity)
      }
      if (!user) {
        user = await this.server.users.getUser({ client_id })
      }

      if (!user) {
        user = await this.server.users.createUser({
          client_id: await this.determineNewUserClientId(client_id),
          // TODO: date gets converted to string automatically. fix this type hint
          // @ts-ignore
          created: new Date(),
          email: provider_email,
          name: userData.data[0].display_name,
          trusted: 0,
          trust_manually_set: 0,
        })
      } else {
        let updateNeeded = false
        if (!user.name || user.name !== userData.data[0].display_name) {
          user.name = userData.data[0].display_name
          updateNeeded = true
        }
        if (!user.email) {
          user.email = provider_email
          updateNeeded = true
        }
        if (updateNeeded) {
          await this.server.users.updateUser(user)
        }
      }

      if (!identity) {
        await this.server.repos.userIdentity.insert({
          user_id: user.id,
          provider_name,
          provider_id,
          provider_email,
        })
      } else {
        let updateNeeded = false
        if (identity.user_id !== user.id) {
          identity.user_id = user.id
          updateNeeded = true
        }
        if (!identity.provider_email) {
          identity.provider_email = provider_email
          updateNeeded = true
        }
        if (updateNeeded) {
          await this.server.repos.userIdentity.update(identity)
        }
      }

      return { ok: true, userId: user.id }
    }

    return { ok: false }
  }

  private async determineNewUserClientId(originalClientId: ClientId | ''): Promise<ClientId> {
    return originalClientId && !await this.server.users.clientIdTaken(originalClientId)
      ? originalClientId
      : uniqId() as ClientId
  }
}
