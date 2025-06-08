import type { Assets } from './Assets'
import type { PlayerSettings } from './PlayerSettings'

export class Sounds {
  constructor (
    private assets: Assets,
    private playerSettings: PlayerSettings,
  ) {
    // pass
  }

  private play(audio: HTMLAudioElement) {
    const cloned = audio.cloneNode() as HTMLAudioElement
    const vol = this.playerSettings.soundsVolume()
    cloned.volume = vol / 100
    cloned.addEventListener('ended', () => {
      cloned.remove()
    })
    cloned.play().catch(_e => {
      cloned.remove()
    })
  }

  playPieceConnected() {
    this.play(this.assets.Audio.CLICK)
  }

  playOtherPieceConnected() {
    this.play(this.assets.Audio.CLICK_2)
  }

  playPieceRotated() {
    this.play(this.assets.Audio.ROTATE)
  }
}
