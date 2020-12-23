// Map<gameId, Socket[]>
const SOCKETS = {}

function socketExists(gameId, socket) {
  if (!(gameId in SOCKETS)) {
    return false
  }
  return SOCKETS[gameId].includes(socket)
}

function removeSocket(gameId, socket) {
  if (!(gameId in SOCKETS)) {
    return
  }
  SOCKETS[gameId] = SOCKETS[gameId].filter(s => s !== socket)
  console.log('removed socket: ', gameId, socket.protocol)
  console.log('socket count: ', Object.keys(SOCKETS[gameId]).length)
}

function addSocket(gameId, socket) {
  if (!(gameId in SOCKETS)) {
    SOCKETS[gameId] = []
  }
  if (!SOCKETS[gameId].includes(socket)) {
    SOCKETS[gameId].push(socket)
    console.log('added socket: ', gameId, socket.protocol)
    console.log('socket count: ', Object.keys(SOCKETS[gameId]).length)
  }
}

function getSockets(gameId) {
  if (!(gameId in SOCKETS)) {
    return []
  }
  return SOCKETS[gameId]
}

export default {
  addSocket,
  removeSocket,
  socketExists,
  getSockets,
}
