import { ClientId } from '../../../common/src/Types'
import storage from '../storage'

export const JSON_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

export interface Response<T> {
  status: number,
  text: string,
  json: () => Promise<T>,
}

export interface Options {
  body: FormData|string,
  headers?: any,
  onUploadProgress?: (ev: ProgressEvent<XMLHttpRequestEventTarget>) => any,
}

export class XhrRequest<T> {
  private xhr: XMLHttpRequest | null = null
  constructor(
    private readonly method: string,
    private readonly url: string,
    private readonly options: Options,
  ) {
    // pass
  }

  send(): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
      this.xhr = new window.XMLHttpRequest()
      this.xhr.open(this.method, this.url, true)
      this.xhr.withCredentials = true
      for (const k in this.options.headers || {}) {
        this.xhr.setRequestHeader(k, this.options.headers[k])
      }

      this.xhr.setRequestHeader('Client-Id', xhrClientId)

      this.xhr.addEventListener('load', function (_ev: ProgressEvent<XMLHttpRequestEventTarget>,
        ) {
        resolve({
          status: this.status,
          text: this.responseText,
          json: () => JSON.parse(this.responseText),
        })
      })
      this.xhr.addEventListener('error', function (_ev: ProgressEvent<XMLHttpRequestEventTarget>) {
        reject(new Error('xhr error'))
      })
      if (this.xhr.upload && this.options.onUploadProgress) {
        this.xhr.upload.addEventListener('progress', (ev: ProgressEvent<XMLHttpRequestEventTarget>) => {
          // typescript complains without this extra check
          if (this.options.onUploadProgress) {
            this.options.onUploadProgress(ev)
          }
        })
      }
      this.xhr.send(this.options.body || null)
    })
  }

  abort(): void {
    this.xhr?.abort()
  }
}

let xhrClientId: ClientId = '' as ClientId
const request = async <T>(
  method: string,
  url: string,
  options: Options,
): Promise<Response<T>> => {
  const r = new XhrRequest<T>(method, url, options)
  return await r.send()
}

export default {
  init: () => {
    xhrClientId = storage.uniq('ID') as ClientId
  },
  get: <T>(url: string, options: any): Promise<Response<T>> => {
    return request('get', url, options)
  },
  getRequest: <T>(url: string, options: any): XhrRequest<T> => {
    return new XhrRequest('get', url, options)
  },
  delete: <T>(url: string, options: any): Promise<Response<T>> => {
    return request('delete', url, options)
  },
  post: <T>(url: string, options: any): Promise<Response<T>> => {
    return request('post', url, options)
  },
  put: <T>(url: string, options: any): Promise<Response<T>> => {
    return request('put', url, options)
  },
  clientId: () => xhrClientId,
  setClientId: (clientId: ClientId) => {
    xhrClientId = clientId
  },
}
