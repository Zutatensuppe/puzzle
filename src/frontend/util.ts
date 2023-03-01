export function debounce<F extends (...args: any[]) => any>(func: F, wait: number): F {
  let timeoutID: number
  if (!Number.isInteger(wait)) {
    console.warn('Called debounce without a valid number')
    wait = 300
  }
  // conversion through any necessary as it wont satisfy criteria otherwise
  return <any>function (this: any, ...args: any[]) {
    clearTimeout(timeoutID)
    // eslint-disable-next-line
    const context = this
    timeoutID = window.setTimeout(function () {
      func.apply(context, args)
    }, wait)
  }
}
