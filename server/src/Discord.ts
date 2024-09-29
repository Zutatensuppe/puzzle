import { DiscordConfig } from '../../common/src/Types'
import { logger } from '../../common/src/Util'

const log = logger('Discord.ts')

export class Discord {
  constructor(
    private config: DiscordConfig,
  ) {
    // pass
  }

  announce (message: string) {
    if (
      this.config.announce.channelId === 'CHANNEL ID' ||
      this.config.announce.guildId === 'GUILD/SERVER ID'
    ){
      log.info('skipping Discord.announce, channelId or guildId is not set')
      return
    }

    void fetch(this.config.bot.url + '/announce', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guildId: this.config.announce.guildId,
        channelId: this.config.announce.channelId,
        message: message,
      }),
    })
  }
}
