import { UserInfo } from '../src/Users'

declare module 'express-serve-static-core' {
  interface Request {
    userInfo?: UserInfo
  }
}
