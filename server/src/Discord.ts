import type { DiscordChannel, DiscordConfig } from '../../common/src/Types'
import { logger } from '../../common/src/Util'

const log = logger('Discord.ts')

export class Discord {
  constructor(
    private config: DiscordConfig,
  ) {
    // pass
  }

  public async report (message: string): Promise<void> {
    await this.doAnnounce(message, this.config.report)
  }

  public async announce (message: string): Promise<void> {
    await this.doAnnounce(message, this.config.announce)
  }

  private async doAnnounce (
    message: string,
    channel: DiscordChannel,
  ): Promise<void> {
    if (
      channel.channelId === 'CHANNEL ID' ||
      channel.guildId === 'GUILD/SERVER ID'
    ) {
      log.info('skipping Discord.doAnnounce, channelId or guildId is not set')
      return
    }

    const { channelId, guildId } = channel
    await fetch(`${this.config.bot.url}/announce`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guildId, channelId, message }),
    })
  }
}
