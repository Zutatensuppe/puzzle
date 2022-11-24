import Util from "../../common/Util"
import storage from "../storage"
import user from "./../user"

export interface Response {
  status: number,
  text: string,
  json: () => Promise<any>,
}

export interface Options {
  body: FormData|string,
  headers?: any,
  onUploadProgress?: (ev: ProgressEvent<XMLHttpRequestEventTarget>) => any,
}

let xhrClientId: string = ''
let xhrClientSecret: string = ''
const request = async (
  method: string,
  url: string,
  options: Options
): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const xhr = new window.XMLHttpRequest()
    xhr.open(method, url, true)
    xhr.withCredentials = true
    for (const k in options.headers || {}) {
      xhr.setRequestHeader(k, options.headers[k])
    }

    xhr.setRequestHeader('Client-Id', xhrClientId)
    xhr.setRequestHeader('Client-Secret', xhrClientSecret)

    xhr.addEventListener('load', function (_ev: ProgressEvent<XMLHttpRequestEventTarget>
      ) {
      resolve({
        status: this.status,
        text: this.responseText,
        json: async () => JSON.parse(this.responseText),
      })
    })
    xhr.addEventListener('error', function (_ev: ProgressEvent<XMLHttpRequestEventTarget>) {
      reject(new Error('xhr error'))
    })
    if (xhr.upload && options.onUploadProgress) {
      xhr.upload.addEventListener('progress', function (ev: ProgressEvent<XMLHttpRequestEventTarget>) {
        // typescript complains without this extra check
        if (options.onUploadProgress) {
          options.onUploadProgress(ev)
        }
      })
    }
    xhr.send(options.body || null)
  })
}

const uniq = (str: string) => {
  let val = storage.getStr(str, '')
  if (!val) {
    val = Util.uniqId()
    storage.setStr(str, val)
  }
  return val
}

export default {
  init: () => {
    xhrClientId = uniq('ID')
    xhrClientSecret = uniq('SECRET')

    user.eventBus.on('login', () => {
      const u = user.getMe()
      if (u) {
        xhrClientId = u.clientId
        xhrClientSecret = u.clientSecret
      }
    })

    user.eventBus.on('logout', () => {
      xhrClientId = uniq('ID')
      xhrClientSecret = uniq('SECRET')
    })
  },
  request,
  get: (url: string, options: any): Promise<Response> => {
    return request('get', url, options)
  },
  delete: (url: string, options: any): Promise<Response> => {
    return request('delete', url, options)
  },
  post: (url: string, options: any): Promise<Response> => {
    return request('post', url, options)
  },
  clientId: () => xhrClientId
}
