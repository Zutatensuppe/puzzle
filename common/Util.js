// get a unique id
export const uniqId = () => Date.now().toString(36) + Math.random().toString(36).substring(2)

// get a random int between min and max (inclusive)
export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// get one random item from the given array
export const choice = (array) => array[randomInt(0, array.length - 1)]

export const throttle = (fn, delay) => {
  let canCall = true
  return (...args) => {
    if (canCall) {
      fn.apply(null, args)
      canCall = false
      setTimeout(() => {
        canCall = true
      }, delay)
    }
  }
}

// return a shuffled (shallow) copy of the given array
export const shuffle = (array) => {
  let arr = array.slice()
  for (let i = 0; i <= arr.length - 2; i++)
  {
    const j = randomInt(i, arr.length -1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr
}

export const timestamp = () => {
  const d = new Date();
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  )
}

function encodeShape(data) {
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

function decodeShape(data) {
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

function encodeTile(data) {
  if (Array.isArray(data)) {
    return data
  }
  return [data.idx, data.pos.x, data.pos.y, data.z, data.owner, data.group]
}

function decodeTile(data) {
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

function encodePlayer(data) {
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

function decodePlayer(data) {
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

function coordByTileIdx(info, tileIdx) {
  const wTiles = info.width / info.tileSize
  return {
    x: tileIdx % wTiles,
    y: Math.floor(tileIdx / wTiles),
  }
}

export default {
  uniqId,
  randomInt,
  choice,
  throttle,
  shuffle,
  timestamp,

  encodeShape,
  decodeShape,

  encodeTile,
  decodeTile,

  encodePlayer,
  decodePlayer,

  coordByTileIdx,
}
