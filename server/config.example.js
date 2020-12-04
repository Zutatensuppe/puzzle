export default {
  http: {
    hostname: '127.0.0.1',
    port: 1337,
  },
  ws: {
    hostname: '127.0.0.1',
    port: 1338,
    connectstring: `ws://localhost:1338/ws`,
  },
  persistence: {
    interval: 30000,
  },
}
