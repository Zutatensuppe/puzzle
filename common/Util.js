// get a unique id
export const uniqId = () => Date.now().toString(36) + Math.random().toString(36).substring(2)

// get a random int between min and max (inclusive)
export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// get one random item from the given array
export const choice = (array) => array[randomInt(0, array.length - 1)]

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

export default {
  uniqId,
  randomInt,
  choice,
  shuffle,
  timestamp,
}
