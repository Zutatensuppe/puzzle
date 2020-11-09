let _pt = 0
let _mindiff = 0

const checkpoint_start = (mindiff) => {
  _pt = performance.now()
  _mindiff = mindiff
}

const checkpoint = (label) => {
  const now = performance.now();
  const diff = now - _pt
  if (diff > _mindiff) {
    console.log(label + ': ' + (diff));
  }
  _pt = now;
}

export default {
  checkpoint_start,
  checkpoint,
}
