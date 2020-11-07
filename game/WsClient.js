import WsWrapper from './WsWrapper.js'

export default class WsClient extends WsWrapper {
  constructor(addr, protocols) {
    super(addr, protocols)
    this._on = {}
    this.onopen = (e) => {
      this._dispatch('socket', 'open', e)
    }
    this.onmessage = (e) => {
      this._dispatch('socket', 'message', e)
      if (!!this._on['message']) {
        const d = this._parseMessageData(e.data)
        if (d.event) {
          this._dispatch('message', d.event, d.data)
        }
      }
    }
    this.onclose = (e) => {
      this._dispatch('socket', 'close', e)
    }
  }

  onSocket(tag, callback) {
    this.addEventListener('socket', tag, callback)
  }

  onMessage(tag, callback) {
    this.addEventListener('message', tag, callback)
  }

  addEventListener(type, tag, callback) {
    const tags = Array.isArray(tag) ? tag : [tag]
    this._on[type] = this._on[type] || {}
    for (const t of tags) {
      this._on[type][t] = this._on[type][t] || []
      this._on[type][t].push(callback)
    }
  }

  _parseMessageData(data) {
    try {
      const d = JSON.parse(data)
      if (d.event) {
        return {event: d.event, data: d.data || null}
      }
    } catch {
    }
    return {event: null, data: null}
  }

  _dispatch(type, tag, ...args) {
    const t = this._on[type] || {}
    const callbacks = (t[tag] || [])
    if (callbacks.length === 0) {
      return
    }

    console.log(`ws dispatch ${type} ${tag}`)
    for (const callback of callbacks) {
      callback(...args)
    }
  }
}
