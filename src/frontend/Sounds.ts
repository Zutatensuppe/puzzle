import { Assets } from "./Assets";
import { PlayerSettings } from "./PlayerSettings";

export class Sounds {
  constructor (
    private assets: Assets,
    private playerSettings: PlayerSettings,
  ) {
    // pass
  }

  playPieceConnected() {
    const vol = this.playerSettings.soundsVolume()
    this.assets.Audio.CLICK.volume = vol / 100
    this.assets.Audio.CLICK.play()
  }

  playOtherPieceConnected() {
    const vol = this.playerSettings.soundsVolume()
    this.assets.Audio.CLICK_2.volume = vol / 100
    this.assets.Audio.CLICK_2.play()
  }
}
