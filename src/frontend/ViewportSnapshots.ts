import { Camera, Snapshot } from './Camera'
import { EventAdapter } from './EventAdapter'

export class ViewportSnapshots {
  public static readonly LAST = 'last'

  private viewportToggleSlot: string = ''
  private viewportSnapshots: Record<string, Snapshot> = {}

  constructor(
    private evts: EventAdapter,
    private viewport: Camera
  ) {
    // pass
  }

  snap(slot: string) {
    this.viewportSnapshots[slot] = this.viewport.snapshot()
  }

  remove(slot: string) {
    delete this.viewportSnapshots[slot]
  }

  handle(slot: string): string | null {
    if (this.viewportSnapshots[ViewportSnapshots.LAST] && this.viewportToggleSlot === slot) {
      const prev = this.viewport.snapshot()
      const curr = this.viewportSnapshots[ViewportSnapshots.LAST]
      this.viewport.fromSnapshot(curr)
      this.evts.createSnapshotEvents(prev, curr)
      delete this.viewportSnapshots[ViewportSnapshots.LAST]
      return ViewportSnapshots.LAST
    }

    if (this.viewportSnapshots[slot]) {
      const curr = this.viewportSnapshots[slot]
      const prev = this.viewport.snapshot()
      this.viewportSnapshots[ViewportSnapshots.LAST] = prev
      this.viewportToggleSlot = slot
      this.viewport.fromSnapshot(curr)
      this.evts.createSnapshotEvents(prev, curr)
      return slot
    }
    return null
  }
}
