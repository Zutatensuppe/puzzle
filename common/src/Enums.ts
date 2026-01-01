export enum SoundsEnum {
  PIECE_CONNECTED = 0,
  OPPONENT_PIECE_CONNECTED = 1,
  PIECE_ROTATED = 2,
}

export enum GraphicsEnum {
  CURSOR_HAND_RAW = 0,
  CURSOR_HAND = 1,
  CURSOR_HAND_MASK = 2,

  CURSOR_GRAB_RAW = 3,
  CURSOR_GRAB = 4,
  CURSOR_GRAB_MASK = 5,

  BADGE_MASK = 6,
  BADGE_OVERLAY_ACTIVE = 7,
  BADGE_OVERLAY_IDLE = 8,

  BADGE_ANON_ACTIVE = 9,
  BADGE_ANON_IDLE = 10,

  PIECE_STENCILS_SPRITESHEET = 11,
}

export enum ConnectionStatesEnum {
  NOT_CONNECTED = 0, // not connected yet
  DISCONNECTED = 1, // not connected, but was connected before
  CONNECTED = 2, // connected
  CONNECTING = 3, // connecting
  CLOSED = 4, // not connected (closed on purpose)
  SERVER_ERROR = 5, // not connected (determined by server)
}
