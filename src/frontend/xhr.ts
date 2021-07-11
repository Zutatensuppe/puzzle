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

    xhr.addEventListener('load', function (ev: ProgressEvent<XMLHttpRequestEventTarget>
      ) {
      resolve({
        status: this.status,
        text: this.responseText,
        json: async () => JSON.parse(this.responseText),
      })
    })
    xhr.addEventListener('error', function (ev: ProgressEvent<XMLHttpRequestEventTarget>) {
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

export default {
  request,
  get: (url: string, options: any): Promise<Response> => {
    return request('get', url, options)
  },
  post: (url: string, options: any): Promise<Response> => {
    return request('post', url, options)
  },
  setClientId: (clientId: string): void => {
    xhrClientId = clientId
  },
  setClientSecret: (clientSecret: string): void => {
    xhrClientSecret = clientSecret
  },
}
