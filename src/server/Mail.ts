// @ts-ignore
import SibApiV3Sdk from 'sib-api-v3-sdk'
import { logger } from '../common/Util'

import { MailConfig, MailServicePasswordResetData, MailServiceRegistrationData } from '../common/Types'

const log = logger('Mail.ts')

type TransacEmailError = any
type TransacEmailResponseData = any

const BASE_URL = 'https://jigsaw.hyottoko.club'
const NAME = 'jigsaw.hyottoko.club'
const NOREPLY_MAIL = 'noreply@jigsaw.hyottoko.club'
const SENDER = { name: NAME, email: NOREPLY_MAIL }

class Mail {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi

  constructor(cfg: MailConfig) {
    const defaultClient = SibApiV3Sdk.ApiClient.instance
    const apiKey = defaultClient.authentications['api-key']
    apiKey.apiKey = cfg.sendinblue_api_key
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
  }

  sendPasswordResetMail(passwordReset: MailServicePasswordResetData) {
    const mail = new SibApiV3Sdk.SendSmtpEmail()
    mail.subject = '{{params.subject}}'
    mail.htmlContent = `<html><body>
      <h1>Hello {{params.username}}</h1>
      <p>To reset your password for <a href="${BASE_URL}">${NAME}</a>
      click the following link:</p>
      <p><a href="{{params.link}}">{{params.link}}</a></p>
      </body></html>`
    mail.sender = SENDER
    mail.to = [{
      email: passwordReset.user.email,
      name: passwordReset.user.name,
    }]
    mail.params = {
      username: passwordReset.user.name,
      subject: `Password Reset for ${NAME}`,
      link: `${BASE_URL}/#password-reset=${passwordReset.token.token}`
    }
    this.send(mail)
  }

  sendRegistrationMail(registration: MailServiceRegistrationData) {
    const mail = new SibApiV3Sdk.SendSmtpEmail()
    mail.subject = '{{params.subject}}'
    mail.htmlContent = `<html><body>
      <h1>Hello {{params.username}}</h1>
      <p>Thank you for registering an account at <a href="${BASE_URL}">${NAME}</a>.</p>
      <p>Please confirm your registration by clicking the following link:</p>
      <p><a href="{{params.link}}">{{params.link}}</a></p>
      </body></html>`
    mail.sender = SENDER
    mail.to = [{
      email: registration.user.email,
      name: registration.user.name,
    }]
    mail.params = {
      username: registration.user.name,
      subject: `User Registration on ${NAME}`,
      link: `${BASE_URL}/api/verify-email/${registration.token.token}`
    }
    this.send(mail)
  }

  send(mail: SibApiV3Sdk.SendSmtpEmail) {
    this.apiInstance.sendTransacEmail(mail).then(function (data: TransacEmailResponseData) {
      log.info({ data }, 'API called successfully')
    }, function (error: TransacEmailError) {
      log.error({ error })
    })
  }
}

export default Mail
