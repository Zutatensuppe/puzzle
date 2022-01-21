import { EncodedGame, EncodedPiece, EncodedPlayer, Game, Piece, Player, Puzzle } from '../../src/common/Types'
import Util from '../../src/common/Util'

describe('Util', () => {
  test('slug', () => {
    expect(Util.slug('^%5k0sj55%%zxc0j')).toBe('5k0sj55-zxc0j')
  })

  test('pad', () => {
    expect(Util.pad(5, '0000')).toBe('0005')
    expect(Util.pad(5555, '00')).toBe('5555')
  })

  test.each([
    {shape: {top: -1, right: -1, bottom: -1, left: -1 }, encoded: 0b00000000 },
    {shape: {top:  1, right: -1, bottom: -1, left: -1 }, encoded: 0b00000010 },
    {shape: {top:  0, right: -1, bottom: -1, left: -1 }, encoded: 0b00000001 },
    {shape: {top: -1, right: -1, bottom:  1, left: -1 }, encoded: 0b00100000 },
    {shape: {top: -1, right: -1, bottom:  0, left: -1 }, encoded: 0b00010000 },
    {shape: {top: -1, right: -1, bottom: -1, left:  1 }, encoded: 0b10000000 },
    {shape: {top: -1, right: -1, bottom: -1, left:  0 }, encoded: 0b01000000 },
    {shape: {top: -1, right:  1, bottom: -1, left: -1 }, encoded: 0b00001000 },
    {shape: {top: -1, right:  0, bottom: -1, left: -1 }, encoded: 0b00000100 },
    {shape: {top:  1, right:  1, bottom:  1, left:  1 }, encoded: 0b10101010 },
  ])('de/encodeShape $shape', ({shape, encoded}) => {
    expect(Util.encodeShape(shape)).toEqual(encoded)
    expect(Util.decodeShape(encoded)).toEqual(shape)
  })

  test.each([
    {
      piece: {idx: 1, pos: {x: 2, y: 3}, z: 4, owner: 5, group: 6} as Piece,
      encoded: [1, 2, 3, 4, 5, 6] as EncodedPiece,
    },
    {
      piece: {idx: 1, pos: {x: 0, y: 9}, z: 4, owner: -1, group: 6} as Piece,
      encoded: [1, 0, 9, 4, -1, 6] as EncodedPiece,
    },
  ])('de/encodePiece $piece', ({piece, encoded}) => {
    expect(Util.encodePiece(piece)).toEqual(encoded)
    expect(Util.decodePiece(encoded)).toEqual(piece)
  })

  test.each([
    {
      player: {id: 'bla', x: 1, y: 2, d: 0, name: 'name', color: 'color', bgcolor: 'bgcolor', points: 5, ts: 6} as Player,
      encoded: ['bla', 1, 2, 0, 'name', 'color', 'bgcolor', 5, 6] as EncodedPlayer
    },
  ])('de/encodePlayer $player', ({player, encoded}) => {
    expect(Util.encodePlayer(player)).toEqual(encoded)
    expect(Util.decodePlayer(encoded)).toEqual(player)
  })

  const rng = {
    rand_high: 1,
    rand_low: 1,
    random: (min: number, max: number): number => 0,
    choice: <T> (array: Array<T>): T => array[0],
    shuffle: <T> (array: Array<T>): Array<T> => array,
  }
  const puzzle: Puzzle = {
    tiles: [],
    data: {
      started: 0,
      finished: 0,
      maxGroup: 0,
      maxZ: 0,
    },
    info: {
      table: {width: 0, height: 0},
      targetTiles: 0,
      width: 0,
      height: 0,
      tileSize: 0,
      tileDrawSize: 0,
      tileMarginWidth: 0,
      tileDrawOffset: 0,
      snapDistance: 0,
      tiles: 0,
      tilesX: 0,
      tilesY: 0,
      shapes: [],
    },
  }
  test.each([
    {
      game: {id: 'id', rng: { type: 'asd', obj: rng}, puzzle: puzzle, players: [], scoreMode: 1, shapeMode: 1, snapMode: 1, creatorUserId: 1, hasReplay: true, gameVersion: 1, private: true} as Game,
      encoded: ['id', 'asd', {rand_high: 1, rand_low: 1}, puzzle, [], 1, 1, 1, 1, true, 1, true] as EncodedGame,
    },
  ])('de/encodeGame $game', ({game, encoded}) => {
    expect(Util.encodeGame(game)).toEqual(encoded)

    const decoded = Util.decodeGame(encoded)
    // check relevant properties of rng object separately
    // because new object is never equal to original one
    expect(decoded.rng.obj.rand_high).toEqual(encoded[2].rand_high)
    expect(decoded.rng.obj.rand_low).toEqual(encoded[2].rand_low)
    decoded.rng.obj = rng
    expect(decoded).toEqual(game)
  })
})
