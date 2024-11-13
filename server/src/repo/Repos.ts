import Db from '../Db'
import { Server } from '../Server'
import { AccountsRepo } from './AccountsRepo'
import { AnnouncementsRepo } from './AnnouncementsRepo'
import { FeaturedRepo } from './FeaturedRepo'
import { GamesRepo } from './GamesRepo'
import { ImagesRepo } from './ImagesRepo'
import { LeaderboardRepo } from './LeaderboardRepo'
import { LivestreamsRepo } from './LivestreamsRepo'
import { TokensRepo } from './TokensRepo'
import { UserIdentityRepo } from './UserIdentityRepo'
import { UsersRepo } from './UsersRepo'

export class Repos {
  public accounts: AccountsRepo
  public announcements: AnnouncementsRepo
  public featured: FeaturedRepo
  public games: GamesRepo
  public images: ImagesRepo
  public leaderboard: LeaderboardRepo
  public livestreams: LivestreamsRepo
  public tokens: TokensRepo
  public userIdentity: UserIdentityRepo
  public users: UsersRepo

  constructor(db: Db) {
    this.accounts = new AccountsRepo(db)
    this.announcements = new AnnouncementsRepo(db)
    this.featured = new FeaturedRepo(db)
    this.games = new GamesRepo(db, this)
    this.images = new ImagesRepo(db)
    this.leaderboard = new LeaderboardRepo(db)
    this.livestreams = new LivestreamsRepo(db)
    this.tokens = new TokensRepo(db)
    this.userIdentity = new UserIdentityRepo(db)
    this.users = new UsersRepo(db)
  }

  init(server: Server) {
    this.featured.init(server)
  }
}
