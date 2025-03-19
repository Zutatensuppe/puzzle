import { Server } from './Server'
import { GameId, ImageId, UserRow } from './Types'

export class Moderation {
  private server!: Server

  public init (server: Server) {
    this.server = server
  }

  public async reportGame(
    gameId: GameId,
    user: UserRow | null,
    reason: string,
  ): Promise<void> {
    const message = [
      '```',
      `Game reported: ${gameId}`,
      `User: ${user?.name}`,
      `Reason: ${reason}`,
      '```',
    ].join('\n')
    await this.server.discord.report(message)
  }

  public async reportImage(
    imageId: ImageId,
    user: UserRow | null,
    reason: string,
  ): Promise<void> {
    const message = [
      '```',
      `Image reported: ${imageId}`,
      `User: ${user?.name}`,
      `Reason: ${reason}`,
      '```',
    ].join('\n')
    await this.server.discord.report(message)
  }
}
