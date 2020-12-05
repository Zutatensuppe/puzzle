import GameCommon from './../common/GameCommon.js'

export default {
  newGame: GameCommon.newGame,
  getActivePlayers: GameCommon.getActivePlayers,
  handleInput: GameCommon.handleInput,
  getPlayerBgColor: GameCommon.getPlayerBgColor,
  getPlayerColor: GameCommon.getPlayerColor,
  getPlayerName: GameCommon.getPlayerName,
  changePlayer: GameCommon.changePlayer,
  setPlayer: GameCommon.setPlayer,
  setTile: GameCommon.setTile,
  getImageUrl: GameCommon.getImageUrl,
  setPuzzleData: GameCommon.setPuzzleData,
  getTableWidth: GameCommon.getTableWidth,
  getTableHeight: GameCommon.getTableHeight,
  getPuzzleWidth: GameCommon.getPuzzleWidth,
  getPuzzleHeight: GameCommon.getPuzzleHeight,
  getTilesSortedByZIndex: GameCommon.getTilesSortedByZIndex,
  getFirstOwnedTile: GameCommon.getFirstOwnedTile,
  getTileDrawOffset: GameCommon.getTileDrawOffset,
  getTileDrawSize: GameCommon.getTileDrawSize,
}
