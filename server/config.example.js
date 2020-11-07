const hostname = '127.0.0.1'

export default {
  http: {
    hostname: hostname,
    port: 1337,
  },
  ws: {
    hostname: hostname,
    port: 1338,
    connectstring: `ws://localhost:1338/ws`,
  },
}
