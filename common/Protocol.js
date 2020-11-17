/*
SERVER_CLIENT_MESSAGE_PROTOCOL
NOTE: clients always send game id and their id
      when creating sockets (via socket.protocol), so
      this doesn't need to be set in each message data

NOTE: first value in the array is always the type of event/message
      when describing them below, the value each has is used
      instead of writing EVENT_TYPE or something ismilar


EV_CLIENT_EVENT: event triggered by clients and sent to server
[
  EV_CLIENT_EVENT, // constant value, type of event
  CLIENT_SEQ, // sequence number sent by client.
  EV_DATA, // (eg. mouse input info)
]

EV_SERVER_EVENT: event sent to clients after recieving a client
                 event and processing it
[
  EV_SERVER_EVENT, // constant value, type of event
  CLIENT_ID, // user who sent the client event
  CLIENT_SEQ, // sequence number of the client event msg
  CHANGES_TRIGGERED_BY_CLIENT_EVENT,
]

EV_CLIENT_INIT: event sent by client to enter a game
[
  EV_CLIENT_INIT, // constant value, type of event
]

EV_SERVER_INIT: event sent to one client after that client
                connects to a game
[
  EV_SERVER_INIT, // constant value, type of event
  GAME, // complete game instance required by
        // client to build client side of the game
]
*/
const EV_SERVER_EVENT = 1
const EV_SERVER_INIT = 4
const EV_CLIENT_EVENT = 2
const EV_CLIENT_INIT = 3

export default {
  EV_SERVER_EVENT,
  EV_SERVER_INIT,
  EV_CLIENT_EVENT,
  EV_CLIENT_INIT,
}
