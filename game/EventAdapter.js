export default class EventAdapter {
    constructor(canvas) {
        this._mouseEvts = []
        canvas.addEventListener('mousedown', this._mouseDown.bind(this))
        canvas.addEventListener('mouseup', this._mouseUp.bind(this))
        canvas.addEventListener('mousemove', this._mouseMove.bind(this))
        canvas.addEventListener('wheel', this._wheel.bind(this))
    }

    consumeAll() {
        if (this._mouseEvts.length === 0) {
            return []
        }
        const all = this._mouseEvts.slice()
        this._mouseEvts = []
        return all
    }

    _mouseDown(e) {
        if (e.button === 0) {
            this._mouseEvts.push({type: 'down', x: e.offsetX, y: e.offsetY})
        }
    }

    _mouseUp(e) {
        if (e.button === 0) {
            this._mouseEvts.push({type: 'up', x: e.offsetX, y: e.offsetY})
        }
    }

    _mouseMove(e) {
        this._mouseEvts.push({type: 'move', x: e.offsetX, y: e.offsetY})
    }

    _wheel(e) {
        this._mouseEvts.push({type: 'wheel', deltaY: e.deltaY, x: e.offsetX, y: e.offsetY})
    }
}
