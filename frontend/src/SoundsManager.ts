import type { Assets } from './Assets'
import type { SoundsEnum } from '../../common/src/Constants'
import type { PlayerSettings } from './PlayerSettings'

export class SoundsManager {
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

  public playSound(sound: SoundsEnum) {
    this.play(this.assets.Audio[sound])
  }
}
