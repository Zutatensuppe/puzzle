// @ts-ignore
import SibApiV3Sdk from 'sib-api-v3-sdk'
import { logger } from '../../common/src/Util'
import type { MailConfig, MailServicePasswordResetData, MailServiceRegistrationData } from '../../common/src/Types'

const log = logger('Mail.ts')

type TransacEmailError = any
type TransacEmailResponseData = any

const NAME = 'jigsaw.hyottoko.club'
const NOREPLY_MAIL = 'noreply@jigsaw.hyottoko.club'
const SENDER = { name: NAME, email: NOREPLY_MAIL }

class Mail {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null
  private publicBaseUrl: string

  constructor(cfg: MailConfig, publicBaseUrl: string) {
    this.publicBaseUrl = publicBaseUrl
    if (cfg.sendinblue_api_key === 'SOME_API_KEY') {
      log.info('skipping Mail constructor, sendinblue_api_key is not set')
      return
    }
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
      <p>To reset your password for <a href="${this.publicBaseUrl}">${NAME}</a>
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
      link: `${this.publicBaseUrl}/#password-reset=${passwordReset.token.token}`,
    }
    this.send(mail)
  }

  sendRegistrationMail(registration: MailServiceRegistrationData) {
    const mail = new SibApiV3Sdk.SendSmtpEmail()
    mail.subject = '{{params.subject}}'
    mail.htmlContent = `<html><body>
      <h1>Hello {{params.username}}</h1>
      <p>Thank you for registering an account at <a href="${this.publicBaseUrl}">${NAME}</a>.</p>
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
      link: `${this.publicBaseUrl}/api/verify-email/${registration.token.token}`,
    }
    this.send(mail)
  }

  send(mail: SibApiV3Sdk.SendSmtpEmail) {
    if (!this.apiInstance) {
      log.info('skipping Mail.send, apiInstance is not set')
      return
    }
    this.apiInstance.sendTransacEmail(mail).then(function (data: TransacEmailResponseData) {
      log.info({ data }, 'API called successfully')
    }, function (error: TransacEmailError) {
      log.error({ error })
    })
  }
}

export default Mail
