
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

export default {
    randomInt,
    choice,
    shuffle,
}
