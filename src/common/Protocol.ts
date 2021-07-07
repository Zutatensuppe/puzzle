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

const LOG_HEADER = 1
const LOG_ADD_PLAYER = 2
const LOG_UPDATE_PLAYER = 4
const LOG_HANDLE_INPUT = 3

const INPUT_EV_MOUSE_DOWN = 1
const INPUT_EV_MOUSE_UP = 2
const INPUT_EV_MOUSE_MOVE = 3
const INPUT_EV_ZOOM_IN = 4
const INPUT_EV_ZOOM_OUT = 5
const INPUT_EV_BG_COLOR = 6
const INPUT_EV_PLAYER_COLOR = 7
const INPUT_EV_PLAYER_NAME = 8
const INPUT_EV_MOVE = 9
const INPUT_EV_TOGGLE_PREVIEW = 10
const INPUT_EV_TOGGLE_SOUNDS = 11

const INPUT_EV_REPLAY_TOGGLE_PAUSE = 12
const INPUT_EV_REPLAY_SPEED_UP = 13
const INPUT_EV_REPLAY_SPEED_DOWN = 14

const INPUT_EV_TOGGLE_PLAYER_NAMES = 15

const CHANGE_DATA = 1
const CHANGE_TILE = 2
const CHANGE_PLAYER = 3

export default {
  EV_SERVER_EVENT,
  EV_SERVER_INIT,
  EV_CLIENT_EVENT,
  EV_CLIENT_INIT,

  LOG_HEADER,
  LOG_ADD_PLAYER,
  LOG_UPDATE_PLAYER,
  LOG_HANDLE_INPUT,

  INPUT_EV_MOVE, // move by x/y

  INPUT_EV_MOUSE_DOWN,
  INPUT_EV_MOUSE_UP,
  INPUT_EV_MOUSE_MOVE,

  INPUT_EV_ZOOM_IN,
  INPUT_EV_ZOOM_OUT,
  INPUT_EV_BG_COLOR,
  INPUT_EV_PLAYER_COLOR,
  INPUT_EV_PLAYER_NAME,

  INPUT_EV_TOGGLE_PREVIEW,
  INPUT_EV_TOGGLE_SOUNDS,

  INPUT_EV_REPLAY_TOGGLE_PAUSE,
  INPUT_EV_REPLAY_SPEED_UP,
  INPUT_EV_REPLAY_SPEED_DOWN,

  INPUT_EV_TOGGLE_PLAYER_NAMES,

  CHANGE_DATA,
  CHANGE_TILE,
  CHANGE_PLAYER,
}
