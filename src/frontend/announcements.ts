import api from './_api'
import { Announcement } from '../common/Types'

let announcements: Announcement[] = []
async function init(): Promise<void> {
  announcements = await api.pub.getAnnouncements()
}

export default {
  announcements: () => announcements,
  init,
}
