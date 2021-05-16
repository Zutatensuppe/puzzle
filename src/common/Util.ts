import { Rng } from './Rng'


const pad = (x: any, pad: string) => {
  const str = `${x}`
  if (str.length >= pad.length) {
    return str
  }
  return pad.substr(0, pad.length - str.length) + str
}

export const logger = (...pre: Array<any>) => {
  const log = (m: 'log'|'info'|'error') => (...args: Array<any>) => {
    const d = new Date()
    const hh = pad(d.getHours(), '00')
    const mm = pad(d.getMinutes(), '00')
    const ss = pad(d.getSeconds(), '00')
    console[m](`${hh}:${mm}:${ss}`, ...pre, ...args)
  }
  return {
    log: log('log'),
    error: log('error'),
    info: log('info'),
  }
}

// get a unique id
export const uniqId = () => Date.now().toString(36) + Math.random().toString(36).substring(2)

// get a random int between min and max (inclusive)
export const randomInt = (
  rng: Rng,
  min: number,
  max: number,
) => rng.random(min, max)

// get one random item from the given array
export const choice = (
  rng: Rng,
  array: Array<any>
) => array[randomInt(rng, 0, array.length - 1)]

// return a shuffled (shallow) copy of the given array
export const shuffle = (
  rng: Rng,
  array: Array<any>
) => {
  const arr = array.slice()
  for (let i = 0; i <= arr.length - 2; i++)
  {
    const j = randomInt(rng, i, arr.length -1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr
}

function encodeShape(data: any): number {
  if (typeof data === 'number') {
      return data
  }
  /* encoded in 1 byte:
    00000000
          ^^ top
        ^^   right
      ^^     bottom
    ^^       left
  */
  return ((data.top    + 1) << 0)
       | ((data.right  + 1) << 2)
       | ((data.bottom + 1) << 4)
       | ((data.left   + 1) << 6)
}

function decodeShape(data: any) {
  if (typeof data !== 'number') {
      return data
  }
  return {
    top:    (data >> 0 & 0b11) - 1,
    right:  (data >> 2 & 0b11) - 1,
    bottom: (data >> 4 & 0b11) - 1,
    left:   (data >> 6 & 0b11) - 1,
  }
}

function encodeTile(data: any): Array<any> {
  if (Array.isArray(data)) {
    return data
  }
  return [data.idx, data.pos.x, data.pos.y, data.z, data.owner, data.group]
}

function decodeTile(data: any) {
  if (!Array.isArray(data)) {
    return data
  }
  return {
    idx: data[0],
    pos: {
      x: data[1],
      y: data[2],
    },
    z: data[3],
    owner: data[4],
    group: data[5],
  }
}

function encodePlayer(data: any): Array<any> {
  if (Array.isArray(data)) {
    return data
  }
  return [
    data.id,
    data.x,
    data.y,
    data.d,
    data.name,
    data.color,
    data.bgcolor,
    data.points,
    data.ts,
  ]
}

function decodePlayer(data: any) {
  if (!Array.isArray(data)) {
    return data
  }
  return {
    id: data[0],
    x: data[1],
    y: data[2],
    d: data[3], // mouse down
    name: data[4],
    color: data[5],
    bgcolor: data[6],
    points: data[7],
    ts: data[8],
  }
}

function encodeGame(data: any): Array<any> {
  if (Array.isArray(data)) {
    return data
  }
  return [
    data.id,
    data.rng.type,
    Rng.serialize(data.rng.obj),
    data.puzzle,
    data.players,
    data.evtInfos,
    data.scoreMode,
  ]
}

function decodeGame(data: any) {
  if (!Array.isArray(data)) {
    return data
  }
  return {
    id: data[0],
    rng: {
      type: data[1],
      obj: Rng.unserialize(data[2]),
    },
    puzzle: data[3],
    players: data[4],
    evtInfos: data[5],
    scoreMode: data[6],
  }
}

function coordByTileIdx(info: any, tileIdx: number) {
  const wTiles = info.width / info.tileSize
  return {
    x: tileIdx % wTiles,
    y: Math.floor(tileIdx / wTiles),
  }
}

const hash = (str: string): number => {
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    let chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export default {
  hash,
  uniqId,
  randomInt,
  choice,
  shuffle,

  encodeShape,
  decodeShape,

  encodeTile,
  decodeTile,

  encodePlayer,
  decodePlayer,

  encodeGame,
  decodeGame,

  coordByTileIdx,
}
