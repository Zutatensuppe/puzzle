import api from './_api'
import { Announcement } from '../../common/src/Types'
import storage from './storage'
import { reactive } from 'vue'

const state = reactive({
  announcements: [] as Announcement[],
  lastAnnouncement: 0,
  lastSeenAnnouncement: storage.getInt('lastSeenAnnouncement', 0),
  unseenAnnouncementCount: 0,
})

function isNew(announcement: Announcement): boolean {
  return new Date(announcement.created).getTime() > state.lastSeenAnnouncement
}

async function init(): Promise<void> {
  state.announcements = await api.pub.getAnnouncements()
  state.lastAnnouncement = state.announcements.length
    ? new Date(state.announcements[0].created).getTime()
    : 0

  if (state.lastSeenAnnouncement === 0) {
    // if we have never seen an announcement, set last seen to
    // the actual last announcement
    // this has the effect that first time visitors will not see the
    // announcement count popping up
    markAsSeen()
  } else {
    state.unseenAnnouncementCount = state.announcements.filter(isNew).length
  }
}

function markAsSeen(): void {
  state.lastSeenAnnouncement = state.lastAnnouncement
  storage.setInt('lastSeenAnnouncement', state.lastSeenAnnouncement)
  state.unseenAnnouncementCount = state.announcements.filter(isNew).length
}

export default {
  state,
  isNew,
  markAsSeen,
  init,
}
