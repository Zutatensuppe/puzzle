export enum CONN_STATE {
  NOT_CONNECTED = 0, // not connected yet
  DISCONNECTED = 1, // not connected, but was connected before
  CONNECTED = 2, // connected
  CONNECTING = 3, // connecting
  CLOSED = 4, // not connected (closed on purpose)
  SERVER_ERROR = 5, // not connected (determined by server)
}
