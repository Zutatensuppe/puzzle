/*
SERVER_CLIENT_MESSAGE_PROTOCOL
NOTE: clients always send game id and their id
      when creating sockets (via socket.protocol), so
      this doesn't need to be set in each message data

NOTE: first value in the array is always the type of event/message
      when describing them below, the value each has is used
      instead of writing EVENT_TYPE or something ismilar


CLIENT_EVENT_TYPE.EVENT: event triggered by clients and sent to server
[
  CLIENT_EVENT_TYPE.EVENT, // constant value, type of event
  CLIENT_SEQ, // sequence number sent by client.
  EV_DATA, // (eg. mouse input info)
]

SERVER_EVENT_TYPE.EVENT: event sent to clients after recieving a client
                 event and processing it
[
  SERVER_EVENT_TYPE.EVENT, // constant value, type of event
  CLIENT_ID, // user who sent the client event
  CLIENT_SEQ, // sequence number of the client event msg
  CHANGES_TRIGGERED_BY_CLIENT_EVENT,
]

CLIENT_EVENT_TYPE.INIT: event sent by client to enter a game
[
  CLIENT_EVENT_TYPE.INIT, // constant value, type of event
]

SERVER_EVENT_TYPE.INIT: event sent to one client after that client
                connects to a game
[
  SERVER_EVENT_TYPE.INIT, // constant value, type of event
  GAME, // complete game instance required by
        // client to build client side of the game
]
*/
export const GAME_VERSION = 4 // must be increased whenever there is an incompatible change

export enum SERVER_EVENT_TYPE {
  UPDATE = 1,
  INIT = 4,
  SYNC = 5,
  INSUFFICIENT_AUTH = 7,
}

export enum CLIENT_EVENT_TYPE {
  UPDATE = 2,
  INIT = 3,
  IMAGE_SNAPSHOT = 6,
}

export enum LOG_TYPE {
  HEADER = 1,
  ADD_PLAYER = 2,
  GAME_EVENT = 3,
  UPDATE_PLAYER = 4,
}

export enum CHANGE_TYPE {
  DATA = 1,
  PIECE = 2,
  PLAYER = 3,
  PLAYER_SNAP = 4,
}

export enum GAME_EVENT_TYPE {
  INPUT_EV_MOUSE_DOWN = 1,
  INPUT_EV_MOUSE_UP = 2,
  INPUT_EV_MOUSE_MOVE = 3,
  INPUT_EV_ZOOM_IN = 4,
  INPUT_EV_ZOOM_OUT = 5,
  INPUT_EV_BG_COLOR = 6,
  INPUT_EV_PLAYER_COLOR = 7,
  INPUT_EV_PLAYER_NAME = 8,
  INPUT_EV_MOVE = 9,
  INPUT_EV_TOGGLE_PREVIEW = 10,
  INPUT_EV_TOGGLE_SOUNDS = 11,
  INPUT_EV_ROTATE = 24,

  INPUT_EV_REPLAY_TOGGLE_PAUSE = 12,
  INPUT_EV_REPLAY_SPEED_UP = 13,
  INPUT_EV_REPLAY_SPEED_DOWN = 14,

  INPUT_EV_TOGGLE_PLAYER_NAMES = 15,
  INPUT_EV_CENTER_FIT_PUZZLE = 16,

  INPUT_EV_TOGGLE_FIXED_PIECES = 17,
  INPUT_EV_TOGGLE_LOOSE_PIECES = 18,

  INPUT_EV_STORE_POS = 19,
  INPUT_EV_RESTORE_POS = 20,

  INPUT_EV_CONNECTION_CLOSE = 21,

  INPUT_EV_TOGGLE_TABLE = 22,
  INPUT_EV_TOGGLE_INTERFACE = 23,

  INPUT_EV_BAN_PLAYER = 25,
  INPUT_EV_UNBAN_PLAYER = 26,
}
