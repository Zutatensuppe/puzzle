import { AppTokenAuthProvider } from '@twurple/auth'
import { ApiClient } from '@twurple/api'
import { Livestream, TwitchConfig } from './Types'

export class Twitch {
  private apiClient: ApiClient
  constructor(twitchConfig: TwitchConfig) {
    console.log('Twitch.connect')

    const authProvider = new AppTokenAuthProvider(
      twitchConfig.client_id,
      twitchConfig.client_secret,
    )

    this.apiClient = new ApiClient({ authProvider })
  }

  public async getLivestreams(): Promise<Livestream[]> {
    const streams = await this.apiClient.streams.getStreams({
      game: '1315117298',
    })
    const livestreams: Livestream[] = []
    for (const stream of streams.data) {
      const user = await stream.getUser()
      livestreams.push({
        id: stream.id,
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
