"use strict"

import Time from '../common/Time.js'

const CODE_CUSTOM_DISCONNECT = 4000

/**
 * Wrapper around ws that
 * - buffers 'send' until a connection is available
 * - automatically tries to reconnect on close
 */
export default class WsClient {
  // actual ws handle
  handle = null

  // timeout for automatic reconnect
  reconnectTimeout = null

  // buffer for 'send'
  sendBuffer = []

  constructor(addr, protocols) {
    this.addr = addr
    this.protocols = protocols

    this.onopen = () => {}
    this.onclose = () => {}
    this.onmessage = () => {}

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

  send (txt) {
    if (this.handle) {
      this.handle.send(txt)
    } else {
      this.sendBuffer.push(txt)
    }
  }

  connect() {
    let ws = new WebSocket(this.addr, this.protocols)
    ws.onopen = (e) => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
      }
      this.handle = ws
      // should have a queue worker
      while (this.sendBuffer.length > 0) {
        this.handle.send(this.sendBuffer.shift())
      }
      this.onopen(e)
    }
    ws.onmessage = (e) => {
      this.onmessage(e)
    }
    ws.onerror = (e) => {
      this.handle = null
      this.reconnectTimeout = setTimeout(() => { this.connect() }, 1 * Time.SEC)
      this.onclose(e)
    }
    ws.onclose = (e) => {
      this.handle = null
      if (e.code !== CODE_CUSTOM_DISCONNECT) {
        this.reconnectTimeout = setTimeout(() => { this.connect() }, 1 * Time.SEC)
      }
      this.onclose(e)
    }
  }

  disconnect() {
    if (this.handle) {
      this.handle.close(CODE_CUSTOM_DISCONNECT)
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

    for (const callback of callbacks) {
      callback(...args)
    }
  }
}
