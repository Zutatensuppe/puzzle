import { AppTokenAuthProvider } from '@twurple/auth'
import { ApiClient } from '@twurple/api'
import { Livestream, LivestreamId, TwitchConfig } from '../../common/src/Types'
import { logger } from '../../common/src/Util'

const log = logger('Twitch.ts')

export class Twitch {
  private apiClient: ApiClient | null = null
  constructor(twitchConfig: TwitchConfig) {
    if (
      twitchConfig.client_id === 'SOME_ID' ||
      twitchConfig.client_secret === 'SOME_SECRET'
    ) {
      log.info('skipping Twitch.connect, credentials are not set')
      return
    }

    log.info('Twitch.connect')

    const authProvider = new AppTokenAuthProvider(
      twitchConfig.client_id,
      twitchConfig.client_secret,
    )

    this.apiClient = new ApiClient({ authProvider })
  }

  public async getLivestreams(): Promise<Livestream[]> {
    if (!this.apiClient) {
      log.info('skipping Twitch.getLivestreams, apiClient is not set')
      return []
    }

    const streams = await this.apiClient.streams.getStreams({
      game: '1315117298',
    })
    const livestreams: Livestream[] = []
    for (const stream of streams.data) {
      const user = await stream.getUser()
      livestreams.push({
        id: stream.id as LivestreamId,
        title: stream.title,
        url: `https://twitch/${user.name}`,
        user_display_name: stream.userDisplayName,
        user_thumbnail: user.profilePictureUrl,
        language: stream.language,
        viewers: stream.viewers,
      })
    }
    return livestreams
  }
}
