import WebSocket from 'ws';
import express from 'express';
import compression from 'compression';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sizeOf from 'image-size';
import exif from 'exif';
import sharp from 'sharp';
import v8 from 'v8';
import bsqlite from 'better-sqlite3';

var PieceEdge;
(function (PieceEdge) {
    PieceEdge[PieceEdge["Flat"] = 0] = "Flat";
    PieceEdge[PieceEdge["Out"] = 1] = "Out";
    PieceEdge[PieceEdge["In"] = -1] = "In";
})(PieceEdge || (PieceEdge = {}));
var ScoreMode;
(function (ScoreMode) {
    ScoreMode[ScoreMode["FINAL"] = 0] = "FINAL";
    ScoreMode[ScoreMode["ANY"] = 1] = "ANY";
})(ScoreMode || (ScoreMode = {}));
var ShapeMode;
(function (ShapeMode) {
    ShapeMode[ShapeMode["NORMAL"] = 0] = "NORMAL";
    ShapeMode[ShapeMode["ANY"] = 1] = "ANY";
    ShapeMode[ShapeMode["FLAT"] = 2] = "FLAT";
})(ShapeMode || (ShapeMode = {}));
var SnapMode;
(function (SnapMode) {
    SnapMode[SnapMode["NORMAL"] = 0] = "NORMAL";
    SnapMode[SnapMode["REAL"] = 1] = "REAL";
})(SnapMode || (SnapMode = {}));

class Rng {
    constructor(seed) {
        this.rand_high = seed || 0xDEADC0DE;
        this.rand_low = seed ^ 0x49616E42;
    }
    random(min, max) {
        this.rand_high = ((this.rand_high << 16) + (this.rand_high >> 16) + this.rand_low) & 0xffffffff;
        this.rand_low = (this.rand_low + this.rand_high) & 0xffffffff;
        const n = (this.rand_high >>> 0) / 0xffffffff;
        return (min + n * (max - min + 1)) | 0;
    }
    // get one random item from the given array
    choice(array) {
        return array[this.random(0, array.length - 1)];
    }
    // return a shuffled (shallow) copy of the given array
    shuffle(array) {
        const arr = array.slice();
        for (let i = 0; i <= arr.length - 2; i++) {
            const j = this.random(i, arr.length - 1);
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }
    static serialize(rng) {
        return {
            rand_high: rng.rand_high,
            rand_low: rng.rand_low
        };
    }
    static unserialize(rngSerialized) {
        const rng = new Rng(0);
        rng.rand_high = rngSerialized.rand_high;
        rng.rand_low = rngSerialized.rand_low;
        return rng;
    }
}

const slug = (str) => {
    let tmp = str.toLowerCase();
    tmp = tmp.replace(/[^a-z0-9]+/g, '-');
    tmp = tmp.replace(/^-|-$/, '');
    return tmp;
};
const pad = (x, pad) => {
    const str = `${x}`;
    if (str.length >= pad.length) {
        return str;
    }
    return pad.substr(0, pad.length - str.length) + str;
};
const logger = (...pre) => {
    const log = (m) => (...args) => {
        const d = new Date();
        const hh = pad(d.getHours(), '00');
        const mm = pad(d.getMinutes(), '00');
        const ss = pad(d.getSeconds(), '00');
        console[m](`${hh}:${mm}:${ss}`, ...pre, ...args);
    };
    return {
        log: log('log'),
        error: log('error'),
        info: log('info'),
    };
};
// get a unique id
const uniqId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};
function encodeShape(data) {
    /* encoded in 1 byte:
      00000000
            ^^ top
          ^^   right
        ^^     bottom
      ^^       left
    */
    return ((data.top + 1) << 0)
        | ((data.right + 1) << 2)
        | ((data.bottom + 1) << 4)
        | ((data.left + 1) << 6);
}
function decodeShape(data) {
    return {
        top: (data >> 0 & 0b11) - 1,
        right: (data >> 2 & 0b11) - 1,
        bottom: (data >> 4 & 0b11) - 1,
        left: (data >> 6 & 0b11) - 1,
    };
}
function encodePiece(data) {
    return [data.idx, data.pos.x, data.pos.y, data.z, data.owner, data.group];
}
function decodePiece(data) {
    return {
        idx: data[0],
        pos: {
            x: data[1],
            y: data[2],
        },
        z: data[3],
        owner: data[4],
        group: data[5],
    };
}
function encodePlayer(data) {
    return [
        data.id,
        data.x,
        data.y,
        data.d,
        data.name,
        data.color,
        data.bgcolor,
        data.points,
        data.ts,
    ];
}
function decodePlayer(data) {
    return {
        id: data[0],
        x: data[1],
        y: data[2],
        d: data[3],
        name: data[4],
        color: data[5],
        bgcolor: data[6],
        points: data[7],
        ts: data[8],
    };
}
function encodeGame(data) {
    return [
        data.id,
        data.rng.type || '',
        Rng.serialize(data.rng.obj),
        data.puzzle,
        data.players,
        data.evtInfos,
        data.scoreMode || ScoreMode.FINAL,
        data.shapeMode || ShapeMode.ANY,
        data.snapMode || SnapMode.NORMAL,
    ];
}
function decodeGame(data) {
    return {
        id: data[0],
        rng: {
            type: data[1],
            obj: Rng.unserialize(data[2]),
        },
        puzzle: data[3],
        players: data[4],
        evtInfos: data[5],
        scoreMode: data[6],
        shapeMode: data[7],
        snapMode: data[8],
    };
}
function coordByPieceIdx(info, pieceIdx) {
    const wTiles = info.width / info.tileSize;
    return {
        x: pieceIdx % wTiles,
        y: Math.floor(pieceIdx / wTiles),
    };
}
const hash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};
function asQueryArgs(data) {
    const q = [];
    for (const k in data) {
        const pair = [k, data[k]].map(encodeURIComponent);
        q.push(pair.join('='));
    }
    if (q.length === 0) {
        return '';
    }
    return `?${q.join('&')}`;
}
var Util = {
    hash,
    slug,
    uniqId,
    encodeShape,
    decodeShape,
    encodePiece,
    decodePiece,
    encodePlayer,
    decodePlayer,
    encodeGame,
    decodeGame,
    coordByPieceIdx,
    asQueryArgs,
};

const log$5 = logger('WebSocketServer.js');
/*
Example config

config = {
  hostname: 'localhost',
  port: 1338,
  connectstring: `ws://localhost:1338/ws`,
}
*/
class EvtBus {
    constructor() {
        this._on = {};
    }
    on(type, callback) {
        this._on[type] = this._on[type] || [];
        this._on[type].push(callback);
    }
    dispatch(type, ...args) {
        (this._on[type] || []).forEach((cb) => {
            cb(...args);
        });
    }
}
class WebSocketServer {
    constructor(config) {
        this.config = config;
        this._websocketserver = null;
        this.evt = new EvtBus();
    }
    on(type, callback) {
        this.evt.on(type, callback);
    }
    listen() {
        this._websocketserver = new WebSocket.Server(this.config);
        this._websocketserver.on('connection', (socket, request) => {
            const pathname = new URL(this.config.connectstring).pathname;
            if (request.url.indexOf(pathname) !== 0) {
                log$5.log('bad request url: ', request.url);
                socket.close();
                return;
            }
            socket.on('message', (data) => {
                log$5.log(`ws`, socket.protocol, data);
                this.evt.dispatch('message', { socket, data });
            });
            socket.on('close', () => {
                this.evt.dispatch('close', { socket });
            });
        });
    }
    close() {
        if (this._websocketserver) {
            this._websocketserver.close();
        }
    }
    notifyOne(data, socket) {
        socket.send(JSON.stringify(data));
    }
}

/*
SERVER_CLIENT_MESSAGE_PROTOCOL
NOTE: clients always send game id and their id
      when creating sockets (via socket.protocol), so
      this doesn't need to be set in each message data

NOTE: first value in the array is always the type of event/message
      when describing them below, the value each has is used
      instead of writing EVENT_TYPE or something ismilar


EV_CLIENT_EVENT: event triggered by clients and sent to server
[
  EV_CLIENT_EVENT, // constant value, type of event
  CLIENT_SEQ, // sequence number sent by client.
  EV_DATA, // (eg. mouse input info)
]

EV_SERVER_EVENT: event sent to clients after recieving a client
                 event and processing it
[
  EV_SERVER_EVENT, // constant value, type of event
  CLIENT_ID, // user who sent the client event
  CLIENT_SEQ, // sequence number of the client event msg
  CHANGES_TRIGGERED_BY_CLIENT_EVENT,
]

EV_CLIENT_INIT: event sent by client to enter a game
[
  EV_CLIENT_INIT, // constant value, type of event
]

EV_SERVER_INIT: event sent to one client after that client
                connects to a game
[
  EV_SERVER_INIT, // constant value, type of event
  GAME, // complete game instance required by
        // client to build client side of the game
]
*/
const EV_SERVER_EVENT = 1;
const EV_SERVER_INIT = 4;
const EV_CLIENT_EVENT = 2;
const EV_CLIENT_INIT = 3;
const LOG_HEADER = 1;
const LOG_ADD_PLAYER = 2;
const LOG_UPDATE_PLAYER = 4;
const LOG_HANDLE_INPUT = 3;
const INPUT_EV_MOUSE_DOWN = 1;
const INPUT_EV_MOUSE_UP = 2;
const INPUT_EV_MOUSE_MOVE = 3;
const INPUT_EV_ZOOM_IN = 4;
const INPUT_EV_ZOOM_OUT = 5;
const INPUT_EV_BG_COLOR = 6;
const INPUT_EV_PLAYER_COLOR = 7;
const INPUT_EV_PLAYER_NAME = 8;
const INPUT_EV_MOVE = 9;
const INPUT_EV_TOGGLE_PREVIEW = 10;
const INPUT_EV_TOGGLE_SOUNDS = 11;
const INPUT_EV_REPLAY_TOGGLE_PAUSE = 12;
const INPUT_EV_REPLAY_SPEED_UP = 13;
const INPUT_EV_REPLAY_SPEED_DOWN = 14;
const CHANGE_DATA = 1;
const CHANGE_TILE = 2;
const CHANGE_PLAYER = 3;
var Protocol = {
    EV_SERVER_EVENT,
    EV_SERVER_INIT,
    EV_CLIENT_EVENT,
    EV_CLIENT_INIT,
    LOG_HEADER,
    LOG_ADD_PLAYER,
    LOG_UPDATE_PLAYER,
    LOG_HANDLE_INPUT,
    INPUT_EV_MOVE,
    INPUT_EV_MOUSE_DOWN,
    INPUT_EV_MOUSE_UP,
    INPUT_EV_MOUSE_MOVE,
    INPUT_EV_ZOOM_IN,
    INPUT_EV_ZOOM_OUT,
    INPUT_EV_BG_COLOR,
    INPUT_EV_PLAYER_COLOR,
    INPUT_EV_PLAYER_NAME,
    INPUT_EV_TOGGLE_PREVIEW,
    INPUT_EV_TOGGLE_SOUNDS,
    INPUT_EV_REPLAY_TOGGLE_PAUSE,
    INPUT_EV_REPLAY_SPEED_UP,
    INPUT_EV_REPLAY_SPEED_DOWN,
    CHANGE_DATA,
    CHANGE_TILE,
    CHANGE_PLAYER,
};

function pointSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function pointAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
function pointDistance(a, b) {
    const diffX = a.x - b.x;
    const diffY = a.y - b.y;
    return Math.sqrt(diffX * diffX + diffY * diffY);
}
function pointInBounds(pt, rect) {
    return pt.x >= rect.x
        && pt.x <= rect.x + rect.w
        && pt.y >= rect.y
        && pt.y <= rect.y + rect.h;
}
function rectCenter(rect) {
    return {
        x: rect.x + (rect.w / 2),
        y: rect.y + (rect.h / 2),
    };
}
/**
 * Returns a rectangle with same dimensions as the given one, but
 * location (x/y) moved by x and y.
 *
 * @param {x, y, w,, h} rect
 * @param number x
 * @param number y
 * @returns {x, y, w, h}
 */
function rectMoved(rect, x, y) {
    return {
        x: rect.x + x,
        y: rect.y + y,
        w: rect.w,
        h: rect.h,
    };
}
/**
 * Returns true if the rectangles overlap, including their borders.
 *
 * @param {x, y, w, h} rectA
 * @param {x, y, w, h} rectB
 * @returns bool
 */
function rectsOverlap(rectA, rectB) {
    return !(rectB.x > (rectA.x + rectA.w)
        || rectA.x > (rectB.x + rectB.w)
        || rectB.y > (rectA.y + rectA.h)
        || rectA.y > (rectB.y + rectB.h));
}
function rectCenterDistance(rectA, rectB) {
    return pointDistance(rectCenter(rectA), rectCenter(rectB));
}
var Geometry = {
    pointSub,
    pointAdd,
    pointDistance,
    pointInBounds,
    rectCenter,
    rectMoved,
    rectCenterDistance,
    rectsOverlap,
};

const MS = 1;
const SEC = MS * 1000;
const MIN = SEC * 60;
const HOUR = MIN * 60;
const DAY = HOUR * 24;
const timestamp = () => {
    const d = new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
};
const durationStr = (duration) => {
    const d = Math.floor(duration / DAY);
    duration = duration % DAY;
    const h = Math.floor(duration / HOUR);
    duration = duration % HOUR;
    const m = Math.floor(duration / MIN);
    duration = duration % MIN;
    const s = Math.floor(duration / SEC);
    return `${d}d ${h}h ${m}m ${s}s`;
};
const timeDiffStr = (from, to) => durationStr(to - from);
var Time = {
    MS,
    SEC,
    MIN,
    HOUR,
    DAY,
    timestamp,
    timeDiffStr,
    durationStr,
};

const IDLE_TIMEOUT_SEC = 30;
// Map<gameId, Game>
const GAMES = {};
function exists$1(gameId) {
    return (!!GAMES[gameId]) || false;
}
function __createPlayerObject(id, ts) {
    return {
        id: id,
        x: 0,
        y: 0,
        d: 0,
        name: null,
        color: null,
        bgcolor: null,
        points: 0,
        ts: ts,
    };
}
function setGame(gameId, game) {
    GAMES[gameId] = game;
}
function getPlayerIndexById(gameId, playerId) {
    let i = 0;
    for (const player of GAMES[gameId].players) {
        if (Util.decodePlayer(player).id === playerId) {
            return i;
        }
        i++;
    }
    return -1;
}
function getPlayerIdByIndex(gameId, playerIndex) {
    if (GAMES[gameId].players.length > playerIndex) {
        return Util.decodePlayer(GAMES[gameId].players[playerIndex]).id;
    }
    return null;
}
function getPlayer(gameId, playerId) {
    const idx = getPlayerIndexById(gameId, playerId);
    if (idx === -1) {
        return null;
    }
    return Util.decodePlayer(GAMES[gameId].players[idx]);
}
function setPlayer(gameId, playerId, player) {
    const idx = getPlayerIndexById(gameId, playerId);
    if (idx === -1) {
        GAMES[gameId].players.push(Util.encodePlayer(player));
    }
    else {
        GAMES[gameId].players[idx] = Util.encodePlayer(player);
    }
}
function setPiece(gameId, pieceIdx, piece) {
    GAMES[gameId].puzzle.tiles[pieceIdx] = Util.encodePiece(piece);
}
function setPuzzleData(gameId, data) {
    GAMES[gameId].puzzle.data = data;
}
function playerExists(gameId, playerId) {
    const idx = getPlayerIndexById(gameId, playerId);
    return idx !== -1;
}
function getActivePlayers(gameId, ts) {
    const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC;
    return getAllPlayers(gameId).filter((p) => p.ts >= minTs);
}
function getIdlePlayers(gameId, ts) {
    const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC;
    return getAllPlayers(gameId).filter((p) => p.ts < minTs && p.points > 0);
}
function addPlayer$1(gameId, playerId, ts) {
    if (!playerExists(gameId, playerId)) {
        setPlayer(gameId, playerId, __createPlayerObject(playerId, ts));
    }
    else {
        changePlayer(gameId, playerId, { ts });
    }
}
function getEvtInfo(gameId, playerId) {
    if (playerId in GAMES[gameId].evtInfos) {
        return GAMES[gameId].evtInfos[playerId];
    }
    return {
        _last_mouse: null,
        _last_mouse_down: null,
    };
}
function setEvtInfo(gameId, playerId, evtInfo) {
    GAMES[gameId].evtInfos[playerId] = evtInfo;
}
function getAllGames() {
    return Object.values(GAMES).sort((a, b) => {
        // when both have same finished state, sort by started
        if (isFinished(a.id) === isFinished(b.id)) {
            return b.puzzle.data.started - a.puzzle.data.started;
        }
        // otherwise, sort: unfinished, finished
        return isFinished(a.id) ? 1 : -1;
    });
}
function getAllPlayers(gameId) {
    return GAMES[gameId]
        ? GAMES[gameId].players.map(Util.decodePlayer)
        : [];
}
function get$1(gameId) {
    return GAMES[gameId] || null;
}
function getPieceCount(gameId) {
    return GAMES[gameId].puzzle.tiles.length;
}
function getImageUrl(gameId) {
    return GAMES[gameId].puzzle.info.imageUrl;
}
function setImageUrl(gameId, imageUrl) {
    GAMES[gameId].puzzle.info.imageUrl = imageUrl;
}
function getScoreMode(gameId) {
    return GAMES[gameId].scoreMode || ScoreMode.FINAL;
}
function getSnapMode(gameId) {
    return GAMES[gameId].snapMode || SnapMode.NORMAL;
}
function isFinished(gameId) {
    return getFinishedPiecesCount(gameId) === getPieceCount(gameId);
}
function getFinishedPiecesCount(gameId) {
    let count = 0;
    for (const t of GAMES[gameId].puzzle.tiles) {
        if (Util.decodePiece(t).owner === -1) {
            count++;
        }
    }
    return count;
}
function getPiecesSortedByZIndex(gameId) {
    const pieces = GAMES[gameId].puzzle.tiles.map(Util.decodePiece);
    return pieces.sort((t1, t2) => t1.z - t2.z);
}
function changePlayer(gameId, playerId, change) {
    const player = getPlayer(gameId, playerId);
    if (player === null) {
        return;
    }
    for (const k of Object.keys(change)) {
        // @ts-ignore
        player[k] = change[k];
    }
    setPlayer(gameId, playerId, player);
}
function changeData(gameId, change) {
    for (const k of Object.keys(change)) {
        // @ts-ignore
        GAMES[gameId].puzzle.data[k] = change[k];
    }
}
function changePiece(gameId, pieceIdx, change) {
    for (const k of Object.keys(change)) {
        const piece = Util.decodePiece(GAMES[gameId].puzzle.tiles[pieceIdx]);
        // @ts-ignore
        piece[k] = change[k];
        GAMES[gameId].puzzle.tiles[pieceIdx] = Util.encodePiece(piece);
    }
}
const getPiece = (gameId, pieceIdx) => {
    return Util.decodePiece(GAMES[gameId].puzzle.tiles[pieceIdx]);
};
const getPieceGroup = (gameId, tileIdx) => {
    const tile = getPiece(gameId, tileIdx);
    return tile.group;
};
const isCornerPiece = (gameId, tileIdx) => {
    const info = GAMES[gameId].puzzle.info;
    return (tileIdx === 0 // top left corner
        || tileIdx === (info.tilesX - 1) // top right corner
        || tileIdx === (info.tiles - info.tilesX) // bottom left corner
        || tileIdx === (info.tiles - 1) // bottom right corner
    );
};
const getFinalPiecePos = (gameId, tileIdx) => {
    const info = GAMES[gameId].puzzle.info;
    const boardPos = {
        x: (info.table.width - info.width) / 2,
        y: (info.table.height - info.height) / 2
    };
    const srcPos = srcPosByTileIdx(gameId, tileIdx);
    return Geometry.pointAdd(boardPos, srcPos);
};
const getPiecePos = (gameId, tileIdx) => {
    const tile = getPiece(gameId, tileIdx);
    return tile.pos;
};
// todo: instead, just make the table bigger and use that :)
const getBounds = (gameId) => {
    const tw = getTableWidth(gameId);
    const th = getTableHeight(gameId);
    const overX = Math.round(tw / 4);
    const overY = Math.round(th / 4);
    return {
        x: 0 - overX,
        y: 0 - overY,
        w: tw + 2 * overX,
        h: th + 2 * overY,
    };
};
const getPieceBounds = (gameId, tileIdx) => {
    const s = getPieceSize(gameId);
    const tile = getPiece(gameId, tileIdx);
    return {
        x: tile.pos.x,
        y: tile.pos.y,
        w: s,
        h: s,
    };
};
const getPieceZIndex = (gameId, pieceIdx) => {
    return getPiece(gameId, pieceIdx).z;
};
const getFirstOwnedPieceIdx = (gameId, playerId) => {
    for (const t of GAMES[gameId].puzzle.tiles) {
        const tile = Util.decodePiece(t);
        if (tile.owner === playerId) {
            return tile.idx;
        }
    }
    return -1;
};
const getFirstOwnedPiece = (gameId, playerId) => {
    const idx = getFirstOwnedPieceIdx(gameId, playerId);
    return idx < 0 ? null : GAMES[gameId].puzzle.tiles[idx];
};
const getPieceDrawOffset = (gameId) => {
    return GAMES[gameId].puzzle.info.tileDrawOffset;
};
const getPieceDrawSize = (gameId) => {
    return GAMES[gameId].puzzle.info.tileDrawSize;
};
const getPieceSize = (gameId) => {
    return GAMES[gameId].puzzle.info.tileSize;
};
const getStartTs = (gameId) => {
    return GAMES[gameId].puzzle.data.started;
};
const getFinishTs = (gameId) => {
    return GAMES[gameId].puzzle.data.finished;
};
const getMaxGroup = (gameId) => {
    return GAMES[gameId].puzzle.data.maxGroup;
};
const getMaxZIndex = (gameId) => {
    return GAMES[gameId].puzzle.data.maxZ;
};
const getMaxZIndexByPieceIdxs = (gameId, pieceIdxs) => {
    let maxZ = 0;
    for (const pieceIdx of pieceIdxs) {
        const curZ = getPieceZIndex(gameId, pieceIdx);
        if (curZ > maxZ) {
            maxZ = curZ;
        }
    }
    return maxZ;
};
function srcPosByTileIdx(gameId, tileIdx) {
    const info = GAMES[gameId].puzzle.info;
    const c = Util.coordByPieceIdx(info, tileIdx);
    const cx = c.x * info.tileSize;
    const cy = c.y * info.tileSize;
    return { x: cx, y: cy };
}
function getSurroundingTilesByIdx(gameId, tileIdx) {
    const info = GAMES[gameId].puzzle.info;
    const c = Util.coordByPieceIdx(info, tileIdx);
    return [
        // top
        (c.y > 0) ? (tileIdx - info.tilesX) : -1,
        // right
        (c.x < info.tilesX - 1) ? (tileIdx + 1) : -1,
        // bottom
        (c.y < info.tilesY - 1) ? (tileIdx + info.tilesX) : -1,
        // left
        (c.x > 0) ? (tileIdx - 1) : -1,
    ];
}
const setPiecesZIndex = (gameId, tileIdxs, zIndex) => {
    for (const tilesIdx of tileIdxs) {
        changePiece(gameId, tilesIdx, { z: zIndex });
    }
};
const moveTileDiff = (gameId, tileIdx, diff) => {
    const oldPos = getPiecePos(gameId, tileIdx);
    const pos = Geometry.pointAdd(oldPos, diff);
    changePiece(gameId, tileIdx, { pos });
};
const movePiecesDiff = (gameId, pieceIdxs, diff) => {
    const drawSize = getPieceDrawSize(gameId);
    const bounds = getBounds(gameId);
    const cappedDiff = diff;
    for (const pieceIdx of pieceIdxs) {
        const t = getPiece(gameId, pieceIdx);
        if (t.pos.x + diff.x < bounds.x) {
            cappedDiff.x = Math.max(bounds.x - t.pos.x, cappedDiff.x);
        }
        else if (t.pos.x + drawSize + diff.x > bounds.x + bounds.w) {
            cappedDiff.x = Math.min(bounds.x + bounds.w - t.pos.x + drawSize, cappedDiff.x);
        }
        if (t.pos.y + diff.y < bounds.y) {
            cappedDiff.y = Math.max(bounds.y - t.pos.y, cappedDiff.y);
        }
        else if (t.pos.y + drawSize + diff.y > bounds.y + bounds.h) {
            cappedDiff.y = Math.min(bounds.y + bounds.h - t.pos.y + drawSize, cappedDiff.y);
        }
    }
    for (const pieceIdx of pieceIdxs) {
        moveTileDiff(gameId, pieceIdx, cappedDiff);
    }
};
const isFinishedPiece = (gameId, pieceIdx) => {
    return getPieceOwner(gameId, pieceIdx) === -1;
};
const getPieceOwner = (gameId, pieceIdx) => {
    return getPiece(gameId, pieceIdx).owner;
};
const finishPieces = (gameId, pieceIdxs) => {
    for (const pieceIdx of pieceIdxs) {
        changePiece(gameId, pieceIdx, { owner: -1, z: 1 });
    }
};
const setTilesOwner = (gameId, pieceIdxs, owner) => {
    for (const pieceIdx of pieceIdxs) {
        changePiece(gameId, pieceIdx, { owner });
    }
};
// get all grouped tiles for a tile
function getGroupedPieceIdxs(gameId, pieceIdx) {
    const pieces = GAMES[gameId].puzzle.tiles;
    const piece = Util.decodePiece(pieces[pieceIdx]);
    const grouped = [];
    if (piece.group) {
        for (const other of pieces) {
            const otherPiece = Util.decodePiece(other);
            if (otherPiece.group === piece.group) {
                grouped.push(otherPiece.idx);
            }
        }
    }
    else {
        grouped.push(piece.idx);
    }
    return grouped;
}
// Returns the index of the puzzle tile with the highest z index
// that is not finished yet and that matches the position
const freePieceIdxByPos = (gameId, pos) => {
    const info = GAMES[gameId].puzzle.info;
    const pieces = GAMES[gameId].puzzle.tiles;
    let maxZ = -1;
    let pieceIdx = -1;
    for (let idx = 0; idx < pieces.length; idx++) {
        const piece = Util.decodePiece(pieces[idx]);
        if (piece.owner !== 0) {
            continue;
        }
        const collisionRect = {
            x: piece.pos.x,
            y: piece.pos.y,
            w: info.tileSize,
            h: info.tileSize,
        };
        if (Geometry.pointInBounds(pos, collisionRect)) {
            if (maxZ === -1 || piece.z > maxZ) {
                maxZ = piece.z;
                pieceIdx = idx;
            }
        }
    }
    return pieceIdx;
};
const getPlayerBgColor = (gameId, playerId) => {
    const p = getPlayer(gameId, playerId);
    return p ? p.bgcolor : null;
};
const getPlayerColor = (gameId, playerId) => {
    const p = getPlayer(gameId, playerId);
    return p ? p.color : null;
};
const getPlayerName = (gameId, playerId) => {
    const p = getPlayer(gameId, playerId);
    return p ? p.name : null;
};
const getPlayerPoints = (gameId, playerId) => {
    const p = getPlayer(gameId, playerId);
    return p ? p.points : 0;
};
// determine if two tiles are grouped together
const areGrouped = (gameId, tileIdx1, tileIdx2) => {
    const g1 = getPieceGroup(gameId, tileIdx1);
    const g2 = getPieceGroup(gameId, tileIdx2);
    return !!(g1 && g1 === g2);
};
const getTableWidth = (gameId) => {
    return GAMES[gameId].puzzle.info.table.width;
};
const getTableHeight = (gameId) => {
    return GAMES[gameId].puzzle.info.table.height;
};
const getPuzzle = (gameId) => {
    return GAMES[gameId].puzzle;
};
const getRng = (gameId) => {
    return GAMES[gameId].rng.obj;
};
const getPuzzleWidth = (gameId) => {
    return GAMES[gameId].puzzle.info.width;
};
const getPuzzleHeight = (gameId) => {
    return GAMES[gameId].puzzle.info.height;
};
function handleInput$1(gameId, playerId, input, ts, onSnap) {
    const puzzle = GAMES[gameId].puzzle;
    const evtInfo = getEvtInfo(gameId, playerId);
    const changes = [];
    const _dataChange = () => {
        changes.push([Protocol.CHANGE_DATA, puzzle.data]);
    };
    const _pieceChange = (pieceIdx) => {
        changes.push([
            Protocol.CHANGE_TILE,
            Util.encodePiece(getPiece(gameId, pieceIdx)),
        ]);
    };
    const _pieceChanges = (pieceIdxs) => {
        for (const pieceIdx of pieceIdxs) {
            _pieceChange(pieceIdx);
        }
    };
    const _playerChange = () => {
        const player = getPlayer(gameId, playerId);
        if (!player) {
            return;
        }
        changes.push([
            Protocol.CHANGE_PLAYER,
            Util.encodePlayer(player),
        ]);
    };
    // put both tiles (and their grouped tiles) in the same group
    const groupTiles = (gameId, pieceIdx1, pieceIdx2) => {
        const pieces = GAMES[gameId].puzzle.tiles;
        const group1 = getPieceGroup(gameId, pieceIdx1);
        const group2 = getPieceGroup(gameId, pieceIdx2);
        let group;
        const searchGroups = [];
        if (group1) {
            searchGroups.push(group1);
        }
        if (group2) {
            searchGroups.push(group2);
        }
        if (group1) {
            group = group1;
        }
        else if (group2) {
            group = group2;
        }
        else {
            const maxGroup = getMaxGroup(gameId) + 1;
            changeData(gameId, { maxGroup });
            _dataChange();
            group = getMaxGroup(gameId);
        }
        changePiece(gameId, pieceIdx1, { group });
        _pieceChange(pieceIdx1);
        changePiece(gameId, pieceIdx2, { group });
        _pieceChange(pieceIdx2);
        // TODO: strange
        if (searchGroups.length > 0) {
            for (const p of pieces) {
                const piece = Util.decodePiece(p);
                if (searchGroups.includes(piece.group)) {
                    changePiece(gameId, piece.idx, { group });
                    _pieceChange(piece.idx);
                }
            }
        }
    };
    const type = input[0];
    if (type === Protocol.INPUT_EV_BG_COLOR) {
        const bgcolor = input[1];
        changePlayer(gameId, playerId, { bgcolor, ts });
        _playerChange();
    }
    else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
        const color = input[1];
        changePlayer(gameId, playerId, { color, ts });
        _playerChange();
    }
    else if (type === Protocol.INPUT_EV_PLAYER_NAME) {
        const name = `${input[1]}`.substr(0, 16);
        changePlayer(gameId, playerId, { name, ts });
        _playerChange();
    }
    else if (type === Protocol.INPUT_EV_MOVE) {
        const w = input[1];
        const h = input[2];
        const player = getPlayer(gameId, playerId);
        if (player) {
            const x = player.x - w;
            const y = player.y - h;
            changePlayer(gameId, playerId, { ts, x, y });
            _playerChange();
        }
    }
    else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
        const x = input[1];
        const y = input[2];
        const pos = { x, y };
        changePlayer(gameId, playerId, { d: 1, ts });
        _playerChange();
        evtInfo._last_mouse_down = pos;
        const tileIdxAtPos = freePieceIdxByPos(gameId, pos);
        if (tileIdxAtPos >= 0) {
            const maxZ = getMaxZIndex(gameId) + 1;
            changeData(gameId, { maxZ });
            _dataChange();
            const tileIdxs = getGroupedPieceIdxs(gameId, tileIdxAtPos);
            setPiecesZIndex(gameId, tileIdxs, getMaxZIndex(gameId));
            setTilesOwner(gameId, tileIdxs, playerId);
            _pieceChanges(tileIdxs);
        }
        evtInfo._last_mouse = pos;
    }
    else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
        const x = input[1];
        const y = input[2];
        const pos = { x, y };
        if (evtInfo._last_mouse_down === null) {
            // player is just moving the hand
            changePlayer(gameId, playerId, { x, y, ts });
            _playerChange();
        }
        else {
            const pieceIdx = getFirstOwnedPieceIdx(gameId, playerId);
            if (pieceIdx >= 0) {
                // player is moving a tile (and hand)
                changePlayer(gameId, playerId, { x, y, ts });
                _playerChange();
                // check if pos is on the tile, otherwise dont move
                // (mouse could be out of table, but tile stays on it)
                const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
                let anyOk = Geometry.pointInBounds(pos, getBounds(gameId))
                    && Geometry.pointInBounds(evtInfo._last_mouse_down, getBounds(gameId));
                for (const idx of pieceIdxs) {
                    const bounds = getPieceBounds(gameId, idx);
                    if (Geometry.pointInBounds(pos, bounds)) {
                        anyOk = true;
                        break;
                    }
                }
                if (anyOk) {
                    const diffX = x - evtInfo._last_mouse_down.x;
                    const diffY = y - evtInfo._last_mouse_down.y;
                    const diff = { x: diffX, y: diffY };
                    movePiecesDiff(gameId, pieceIdxs, diff);
                    _pieceChanges(pieceIdxs);
                }
            }
            else {
                // player is just moving map, so no change in position!
                changePlayer(gameId, playerId, { ts });
                _playerChange();
            }
            evtInfo._last_mouse_down = pos;
        }
        evtInfo._last_mouse = pos;
    }
    else if (type === Protocol.INPUT_EV_MOUSE_UP) {
        const x = input[1];
        const y = input[2];
        const pos = { x, y };
        const d = 0;
        evtInfo._last_mouse_down = null;
        const pieceIdx = getFirstOwnedPieceIdx(gameId, playerId);
        if (pieceIdx >= 0) {
            // drop the tile(s)
            const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
            setTilesOwner(gameId, pieceIdxs, 0);
            _pieceChanges(pieceIdxs);
            // Check if the tile was dropped near the final location
            const tilePos = getPiecePos(gameId, pieceIdx);
            const finalPos = getFinalPiecePos(gameId, pieceIdx);
            let canSnapToFinal = false;
            if (getSnapMode(gameId) === SnapMode.REAL) {
                // only can snap to final if any of the grouped pieces are
                // corner pieces
                for (const pieceIdxTmp of pieceIdxs) {
                    if (isCornerPiece(gameId, pieceIdxTmp)) {
                        canSnapToFinal = true;
                        break;
                    }
                }
            }
            else {
                canSnapToFinal = true;
            }
            if (canSnapToFinal
                && Geometry.pointDistance(finalPos, tilePos) < puzzle.info.snapDistance) {
                const diff = Geometry.pointSub(finalPos, tilePos);
                // Snap the tile to the final destination
                movePiecesDiff(gameId, pieceIdxs, diff);
                finishPieces(gameId, pieceIdxs);
                _pieceChanges(pieceIdxs);
                let points = getPlayerPoints(gameId, playerId);
                if (getScoreMode(gameId) === ScoreMode.FINAL) {
                    points += pieceIdxs.length;
                }
                else if (getScoreMode(gameId) === ScoreMode.ANY) {
                    points += 1;
                }
                else ;
                changePlayer(gameId, playerId, { d, ts, points });
                _playerChange();
                // check if the puzzle is finished
                if (getFinishedPiecesCount(gameId) === getPieceCount(gameId)) {
                    changeData(gameId, { finished: ts });
                    _dataChange();
                }
                if (onSnap) {
                    onSnap(playerId);
                }
            }
            else {
                // Snap to other tiles
                const check = (gameId, tileIdx, otherTileIdx, off) => {
                    const info = GAMES[gameId].puzzle.info;
                    if (otherTileIdx < 0) {
                        return false;
                    }
                    if (areGrouped(gameId, tileIdx, otherTileIdx)) {
                        return false;
                    }
                    const tilePos = getPiecePos(gameId, tileIdx);
                    const dstPos = Geometry.pointAdd(getPiecePos(gameId, otherTileIdx), { x: off[0] * info.tileSize, y: off[1] * info.tileSize });
                    if (Geometry.pointDistance(tilePos, dstPos) < info.snapDistance) {
                        const diff = Geometry.pointSub(dstPos, tilePos);
                        let pieceIdxs = getGroupedPieceIdxs(gameId, tileIdx);
                        movePiecesDiff(gameId, pieceIdxs, diff);
                        groupTiles(gameId, tileIdx, otherTileIdx);
                        pieceIdxs = getGroupedPieceIdxs(gameId, tileIdx);
                        if (isFinishedPiece(gameId, otherTileIdx)) {
                            finishPieces(gameId, pieceIdxs);
                        }
                        else {
                            const zIndex = getMaxZIndexByPieceIdxs(gameId, pieceIdxs);
                            setPiecesZIndex(gameId, pieceIdxs, zIndex);
                        }
                        _pieceChanges(pieceIdxs);
                        return true;
                    }
                    return false;
                };
                let snapped = false;
                for (const pieceIdxTmp of getGroupedPieceIdxs(gameId, pieceIdx)) {
                    const othersIdxs = getSurroundingTilesByIdx(gameId, pieceIdxTmp);
                    if (check(gameId, pieceIdxTmp, othersIdxs[0], [0, 1]) // top
                        || check(gameId, pieceIdxTmp, othersIdxs[1], [-1, 0]) // right
                        || check(gameId, pieceIdxTmp, othersIdxs[2], [0, -1]) // bottom
                        || check(gameId, pieceIdxTmp, othersIdxs[3], [1, 0]) // left
                    ) {
                        snapped = true;
                        break;
                    }
                }
                if (snapped && getScoreMode(gameId) === ScoreMode.ANY) {
                    const points = getPlayerPoints(gameId, playerId) + 1;
                    changePlayer(gameId, playerId, { d, ts, points });
                    _playerChange();
                }
                else {
                    changePlayer(gameId, playerId, { d, ts });
                    _playerChange();
                }
                if (snapped && getSnapMode(gameId) === SnapMode.REAL) {
                    if (getFinishedPiecesCount(gameId) === getPieceCount(gameId)) {
                        changeData(gameId, { finished: ts });
                        _dataChange();
                    }
                }
                if (snapped && onSnap) {
                    onSnap(playerId);
                }
            }
        }
        else {
            changePlayer(gameId, playerId, { d, ts });
            _playerChange();
        }
        evtInfo._last_mouse = pos;
    }
    else if (type === Protocol.INPUT_EV_ZOOM_IN) {
        const x = input[1];
        const y = input[2];
        changePlayer(gameId, playerId, { x, y, ts });
        _playerChange();
        evtInfo._last_mouse = { x, y };
    }
    else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
        const x = input[1];
        const y = input[2];
        changePlayer(gameId, playerId, { x, y, ts });
        _playerChange();
        evtInfo._last_mouse = { x, y };
    }
    else {
        changePlayer(gameId, playerId, { ts });
        _playerChange();
    }
    setEvtInfo(gameId, playerId, evtInfo);
    return changes;
}
var GameCommon = {
    setGame,
    exists: exists$1,
    playerExists,
    getActivePlayers,
    getIdlePlayers,
    addPlayer: addPlayer$1,
    getFinishedPiecesCount,
    getPieceCount,
    getImageUrl,
    setImageUrl,
    get: get$1,
    getAllGames,
    getPlayerBgColor,
    getPlayerColor,
    getPlayerName,
    getPlayerIndexById,
    getPlayerIdByIndex,
    changePlayer,
    setPlayer,
    setPiece,
    setPuzzleData,
    getTableWidth,
    getTableHeight,
    getPuzzle,
    getRng,
    getPuzzleWidth,
    getPuzzleHeight,
    getPiecesSortedByZIndex,
    getFirstOwnedPiece,
    getPieceDrawOffset,
    getPieceDrawSize,
    getFinalPiecePos,
    getStartTs,
    getFinishTs,
    handleInput: handleInput$1,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_DIR = `${__dirname}/../..`;
const DATA_DIR = `${BASE_DIR}/data`;
const UPLOAD_DIR = `${BASE_DIR}/data/uploads`;
const UPLOAD_URL = `/uploads`;
const PUBLIC_DIR = `${BASE_DIR}/build/public/`;
const DB_PATCHES_DIR = `${BASE_DIR}/src/dbpatches`;
const DB_FILE = `${BASE_DIR}/data/db.sqlite`;

const LINES_PER_LOG_FILE = 10000;
const POST_GAME_LOG_DURATION = 5 * Time.MIN;
const shouldLog = (finishTs, currentTs) => {
    // when not finished yet, always log
    if (!finishTs) {
        return true;
    }
    // in finished games, log max POST_GAME_LOG_DURATION after
    // the game finished, to record winning dance moves etc :P
    const timeSinceGameEnd = currentTs - finishTs;
    return timeSinceGameEnd <= POST_GAME_LOG_DURATION;
};
const filename = (gameId, offset) => `${DATA_DIR}/log_${gameId}-${offset}.log`;
const idxname = (gameId) => `${DATA_DIR}/log_${gameId}.idx.log`;
const create = (gameId, ts) => {
    const idxfile = idxname(gameId);
    if (!fs.existsSync(idxfile)) {
        fs.appendFileSync(idxfile, JSON.stringify({
            gameId: gameId,
            total: 0,
            lastTs: ts,
            currentFile: '',
            perFile: LINES_PER_LOG_FILE,
        }));
    }
};
const exists = (gameId) => {
    const idxfile = idxname(gameId);
    return fs.existsSync(idxfile);
};
const _log = (gameId, type, ...args) => {
    const idxfile = idxname(gameId);
    if (!fs.existsSync(idxfile)) {
        return;
    }
    const idxObj = JSON.parse(fs.readFileSync(idxfile, 'utf-8'));
    if (idxObj.total % idxObj.perFile === 0) {
        idxObj.currentFile = filename(gameId, idxObj.total);
    }
    const tsIdx = type === Protocol.LOG_HEADER ? 3 : (args.length - 1);
    const ts = args[tsIdx];
    if (type !== Protocol.LOG_HEADER) {
        // for everything but header save the diff to last log entry
        args[tsIdx] = ts - idxObj.lastTs;
    }
    const line = JSON.stringify([type, ...args]).slice(1, -1);
    fs.appendFileSync(idxObj.currentFile, line + "\n");
    idxObj.total++;
    idxObj.lastTs = ts;
    fs.writeFileSync(idxfile, JSON.stringify(idxObj));
};
const get = (gameId, offset = 0) => {
    const idxfile = idxname(gameId);
    if (!fs.existsSync(idxfile)) {
        return [];
    }
    const file = filename(gameId, offset);
    if (!fs.existsSync(file)) {
        return [];
    }
    const log = fs.readFileSync(file, 'utf-8').split("\n");
    return log.filter(line => !!line).map(line => {
        return JSON.parse(`[${line}]`);
    });
};
var GameLog = {
    shouldLog,
    create,
    exists,
    log: _log,
    get,
};

const log$4 = logger('Images.ts');
const resizeImage = async (filename) => {
    if (!filename.toLowerCase().match(/\.(jpe?g|webp|png)$/)) {
        return;
    }
    const imagePath = `${UPLOAD_DIR}/${filename}`;
    const imageOutPath = `${UPLOAD_DIR}/r/${filename}`;
    const orientation = await getExifOrientation(imagePath);
    let sharpImg = sharp(imagePath, { failOnError: false });
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    if (orientation === 6) {
        sharpImg = sharpImg.rotate();
    }
    else if (orientation === 3) {
        sharpImg = sharpImg.rotate().rotate();
    }
    else if (orientation === 8) {
        sharpImg = sharpImg.rotate().rotate().rotate();
    }
    const sizes = [
        [150, 100],
        [375, 210],
    ];
    for (const [w, h] of sizes) {
        log$4.info(w, h, imagePath);
        await sharpImg
            .resize(w, h, { fit: 'contain' })
            .toFile(`${imageOutPath}-${w}x${h}.webp`);
    }
};
async function getExifOrientation(imagePath) {
    return new Promise((resolve) => {
        new exif.ExifImage({ image: imagePath }, (error, exifData) => {
            if (error) {
                resolve(0);
            }
            else {
                resolve(exifData.image.Orientation || 0);
            }
        });
    });
}
const getAllTags = (db) => {
    const query = `
select c.id, c.slug, c.title, count(*) as total from categories c
inner join image_x_category ixc on c.id = ixc.category_id
inner join images i on i.id = ixc.image_id
group by c.id order by total desc;`;
    return db._getMany(query).map(row => ({
        id: parseInt(row.id, 10) || 0,
        slug: row.slug,
        title: row.title,
        total: parseInt(row.total, 10) || 0,
    }));
};
const getTags = (db, imageId) => {
    const query = `
select * from categories c
inner join image_x_category ixc on c.id = ixc.category_id
where ixc.image_id = ?`;
    return db._getMany(query, [imageId]).map(row => ({
        id: parseInt(row.id, 10) || 0,
        slug: row.slug,
        title: row.title,
        total: 0,
    }));
};
const imageFromDb = (db, imageId) => {
    const i = db.get('images', { id: imageId });
    return {
        id: i.id,
        filename: i.filename,
        file: `${UPLOAD_DIR}/${i.filename}`,
        url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
        title: i.title,
        tags: getTags(db, i.id),
        created: i.created * 1000,
        width: i.width,
        height: i.height,
    };
};
const allImagesFromDb = (db, tagSlugs, orderBy) => {
    const orderByMap = {
        alpha_asc: [{ filename: 1 }],
        alpha_desc: [{ filename: -1 }],
        date_asc: [{ created: 1 }],
        date_desc: [{ created: -1 }],
    };
    // TODO: .... clean up
    const wheresRaw = {};
    if (tagSlugs.length > 0) {
        const c = db.getMany('categories', { slug: { '$in': tagSlugs } });
        if (!c) {
            return [];
        }
        const where = db._buildWhere({
            'category_id': { '$in': c.map(x => x.id) }
        });
        const ids = db._getMany(`
select i.id from image_x_category ixc
inner join images i on i.id = ixc.image_id ${where.sql};
`, where.values).map(img => img.id);
        if (ids.length === 0) {
            return [];
        }
        wheresRaw['id'] = { '$in': ids };
    }
    const images = db.getMany('images', wheresRaw, orderByMap[orderBy]);
    return images.map(i => ({
        id: i.id,
        filename: i.filename,
        file: `${UPLOAD_DIR}/${i.filename}`,
        url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
        title: i.title,
        tags: getTags(db, i.id),
        created: i.created * 1000,
        width: i.width,
        height: i.height,
    }));
};
/**
 * @deprecated old function, now database is used
 */
const allImagesFromDisk = (tags, sort) => {
    let images = fs.readdirSync(UPLOAD_DIR)
        .filter(f => f.toLowerCase().match(/\.(jpe?g|webp|png)$/))
        .map(f => ({
        id: 0,
        filename: f,
        file: `${UPLOAD_DIR}/${f}`,
        url: `${UPLOAD_URL}/${encodeURIComponent(f)}`,
        title: f.replace(/\.[a-z]+$/, ''),
        tags: [],
        created: fs.statSync(`${UPLOAD_DIR}/${f}`).mtime.getTime(),
        width: 0,
        height: 0, // may have to fill when the function is used again
    }));
    switch (sort) {
        case 'alpha_asc':
            images = images.sort((a, b) => {
                return a.file > b.file ? 1 : -1;
            });
            break;
        case 'alpha_desc':
            images = images.sort((a, b) => {
                return a.file < b.file ? 1 : -1;
            });
            break;
        case 'date_asc':
            images = images.sort((a, b) => {
                return a.created > b.created ? 1 : -1;
            });
            break;
        case 'date_desc':
        default:
            images = images.sort((a, b) => {
                return a.created < b.created ? 1 : -1;
            });
            break;
    }
    return images;
};
async function getDimensions(imagePath) {
    const dimensions = sizeOf(imagePath);
    const orientation = await getExifOrientation(imagePath);
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    if (orientation === 6 || orientation === 8) {
        return {
            w: dimensions.height || 0,
            h: dimensions.width || 0,
        };
    }
    return {
        w: dimensions.width || 0,
        h: dimensions.height || 0,
    };
}
var Images = {
    allImagesFromDisk,
    imageFromDb,
    allImagesFromDb,
    getAllTags,
    resizeImage,
    getDimensions,
};

// cut size of each puzzle tile in the
// final resized version of the puzzle image
const TILE_SIZE = 64;
async function createPuzzle(rng, targetTiles, image, ts, shapeMode) {
    const imagePath = image.file;
    const imageUrl = image.url;
    // determine puzzle information from the image dimensions
    const dim = await Images.getDimensions(imagePath);
    if (!dim.w || !dim.h) {
        throw `[ 2021-05-16 invalid dimension for path ${imagePath} ]`;
    }
    const info = determinePuzzleInfo(dim, targetTiles);
    const rawPieces = new Array(info.tiles);
    for (let i = 0; i < rawPieces.length; i++) {
        rawPieces[i] = { idx: i };
    }
    const shapes = determinePuzzleTileShapes(rng, info, shapeMode);
    let positions = new Array(info.tiles);
    for (const piece of rawPieces) {
        const coord = Util.coordByPieceIdx(info, piece.idx);
        positions[piece.idx] = {
            // instead of info.tileSize, we use info.tileDrawSize
            // to spread the tiles a bit
            x: coord.x * info.tileSize * 1.5,
            y: coord.y * info.tileSize * 1.5,
        };
    }
    const tableWidth = info.width * 3;
    const tableHeight = info.height * 3;
    const off = info.tileSize * 1.5;
    const last = {
        x: info.width - (1 * off),
        y: info.height - (2 * off),
    };
    let countX = Math.ceil(info.width / off) + 2;
    let countY = Math.ceil(info.height / off) + 2;
    let diffX = off;
    let diffY = 0;
    let index = 0;
    for (const pos of positions) {
        pos.x = last.x;
        pos.y = last.y;
        last.x += diffX;
        last.y += diffY;
        index++;
        // did we move horizontally?
        if (diffX !== 0) {
            if (index === countX) {
                diffY = diffX;
                countY++;
                diffX = 0;
                index = 0;
            }
        }
        else {
            if (index === countY) {
                diffX = -diffY;
                countX++;
                diffY = 0;
                index = 0;
            }
        }
    }
    // then shuffle the positions
    positions = rng.shuffle(positions);
    const pieces = rawPieces.map(piece => {
        return Util.encodePiece({
            idx: piece.idx,
            group: 0,
            z: 0,
            // who owns the tile
            // 0 = free for taking
            // -1 = finished
            // other values: id of player who has the tile
            owner: 0,
            // physical current position of the tile (x/y in pixels)
            // this position is the initial position only and is the
            // value that changes when moving a tile
            pos: positions[piece.idx],
        });
    });
    // Complete puzzle object
    return {
        // tiles array
        tiles: pieces,
        // game data for puzzle, data changes during the game
        data: {
            // TODO: maybe calculate this each time?
            maxZ: 0,
            maxGroup: 0,
            started: ts,
            finished: 0, // finish timestamp
        },
        // static puzzle information. stays same for complete duration of
        // the game
        info: {
            table: {
                width: tableWidth,
                height: tableHeight,
            },
            // information that was used to create the puzzle
            targetTiles: targetTiles,
            imageUrl,
            width: info.width,
            height: info.height,
            tileSize: info.tileSize,
            tileDrawSize: info.tileDrawSize,
            tileMarginWidth: info.tileMarginWidth,
            // offset in x and y when drawing tiles, so that they appear to be at pos
            tileDrawOffset: (info.tileDrawSize - info.tileSize) / -2,
            // max distance between tile and destination that
            // makes the tile snap to destination
            snapDistance: info.tileSize / 2,
            tiles: info.tiles,
            tilesX: info.tilesX,
            tilesY: info.tilesY,
            // ( index => {x, y} )
            // this is not the physical coordinate, but
            // the tile_coordinate
            // this can be used to determine where the
            // final destination of a tile is
            shapes: shapes, // tile shapes
        },
    };
}
function determineTabs(shapeMode) {
    switch (shapeMode) {
        case ShapeMode.ANY:
            return [-1, 0, 1];
        case ShapeMode.FLAT:
            return [0];
        case ShapeMode.NORMAL:
        default:
            return [-1, 1];
    }
}
function determinePuzzleTileShapes(rng, info, shapeMode) {
    const tabs = determineTabs(shapeMode);
    const shapes = new Array(info.tiles);
    for (let i = 0; i < info.tiles; i++) {
        const coord = Util.coordByPieceIdx(info, i);
        shapes[i] = {
            top: coord.y === 0 ? 0 : shapes[i - info.tilesX].bottom * -1,
            right: coord.x === info.tilesX - 1 ? 0 : rng.choice(tabs),
            left: coord.x === 0 ? 0 : shapes[i - 1].right * -1,
            bottom: coord.y === info.tilesY - 1 ? 0 : rng.choice(tabs),
        };
    }
    return shapes.map(Util.encodeShape);
}
const determineTilesXY = (dim, targetTiles) => {
    const w_ = dim.w < dim.h ? (dim.w * dim.h) : (dim.w * dim.w);
    const h_ = dim.w < dim.h ? (dim.h * dim.h) : (dim.w * dim.h);
    let size = 0;
    let tiles = 0;
    do {
        size++;
        tiles = Math.floor(w_ / size) * Math.floor(h_ / size);
    } while (tiles >= targetTiles);
    size--;
    return {
        tilesX: Math.round(w_ / size),
        tilesY: Math.round(h_ / size),
    };
};
const determinePuzzleInfo = (dim, targetTiles) => {
    const { tilesX, tilesY } = determineTilesXY(dim, targetTiles);
    const tiles = tilesX * tilesY;
    const tileSize = TILE_SIZE;
    const width = tilesX * tileSize;
    const height = tilesY * tileSize;
    const tileMarginWidth = tileSize * .5;
    const tileDrawSize = Math.round(tileSize + tileMarginWidth * 2);
    return {
        width,
        height,
        tileSize,
        tileMarginWidth,
        tileDrawSize,
        tiles,
        tilesX,
        tilesY,
    };
};

const log$3 = logger('GameStorage.js');
const dirtyGames = {};
function setDirty(gameId) {
    dirtyGames[gameId] = true;
}
function setClean(gameId) {
    delete dirtyGames[gameId];
}
function loadGames() {
    const files = fs.readdirSync(DATA_DIR);
    for (const f of files) {
        const m = f.match(/^([a-z0-9]+)\.json$/);
        if (!m) {
            continue;
        }
        const gameId = m[1];
        loadGame(gameId);
    }
}
function loadGame(gameId) {
    const file = `${DATA_DIR}/${gameId}.json`;
    const contents = fs.readFileSync(file, 'utf-8');
    let game;
    try {
        game = JSON.parse(contents);
    }
    catch {
        log$3.log(`[ERR] unable to load game from file ${file}`);
    }
    if (typeof game.puzzle.data.started === 'undefined') {
        game.puzzle.data.started = Math.round(fs.statSync(file).ctimeMs);
    }
    if (typeof game.puzzle.data.finished === 'undefined') {
        const unfinished = game.puzzle.tiles
            .map(Util.decodePiece)
            .find((t) => t.owner !== -1);
        game.puzzle.data.finished = unfinished ? 0 : Time.timestamp();
    }
    if (!Array.isArray(game.players)) {
        game.players = Object.values(game.players);
    }
    const gameObject = {
        id: game.id,
        rng: {
            type: game.rng ? game.rng.type : '_fake_',
            obj: game.rng ? Rng.unserialize(game.rng.obj) : new Rng(0),
        },
        puzzle: game.puzzle,
        players: game.players,
        evtInfos: {},
        scoreMode: game.scoreMode || ScoreMode.FINAL,
        shapeMode: game.shapeMode || ShapeMode.ANY,
        snapMode: game.snapMode || SnapMode.NORMAL,
    };
    GameCommon.setGame(gameObject.id, gameObject);
}
function persistGames() {
    for (const gameId of Object.keys(dirtyGames)) {
        persistGame(gameId);
    }
}
function persistGame(gameId) {
    const game = GameCommon.get(gameId);
    if (!game) {
        log$3.error(`[ERROR] unable to persist non existing game ${gameId}`);
        return;
    }
    if (game.id in dirtyGames) {
        setClean(game.id);
    }
    fs.writeFileSync(`${DATA_DIR}/${game.id}.json`, JSON.stringify({
        id: game.id,
        rng: {
            type: game.rng.type,
            obj: Rng.serialize(game.rng.obj),
        },
        puzzle: game.puzzle,
        players: game.players,
        scoreMode: game.scoreMode,
        shapeMode: game.shapeMode,
        snapMode: game.snapMode,
    }));
    log$3.info(`[INFO] persisted game ${game.id}`);
}
var GameStorage = {
    loadGames,
    loadGame,
    persistGames,
    persistGame,
    setDirty,
};

async function createGameObject(gameId, targetTiles, image, ts, scoreMode, shapeMode, snapMode) {
    const seed = Util.hash(gameId + ' ' + ts);
    const rng = new Rng(seed);
    return {
        id: gameId,
        rng: { type: 'Rng', obj: rng },
        puzzle: await createPuzzle(rng, targetTiles, image, ts, shapeMode),
        players: [],
        evtInfos: {},
        scoreMode,
        shapeMode,
        snapMode,
    };
}
async function createGame(gameId, targetTiles, image, ts, scoreMode, shapeMode, snapMode) {
    const gameObject = await createGameObject(gameId, targetTiles, image, ts, scoreMode, shapeMode, snapMode);
    GameLog.create(gameId, ts);
    GameLog.log(gameId, Protocol.LOG_HEADER, 1, targetTiles, image, ts, scoreMode, shapeMode, snapMode);
    GameCommon.setGame(gameObject.id, gameObject);
    GameStorage.setDirty(gameId);
}
function addPlayer(gameId, playerId, ts) {
    if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
        const idx = GameCommon.getPlayerIndexById(gameId, playerId);
        if (idx === -1) {
            GameLog.log(gameId, Protocol.LOG_ADD_PLAYER, playerId, ts);
        }
        else {
            GameLog.log(gameId, Protocol.LOG_UPDATE_PLAYER, idx, ts);
        }
    }
    GameCommon.addPlayer(gameId, playerId, ts);
    GameStorage.setDirty(gameId);
}
function handleInput(gameId, playerId, input, ts) {
    if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
        const idx = GameCommon.getPlayerIndexById(gameId, playerId);
        GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, ts);
    }
    const ret = GameCommon.handleInput(gameId, playerId, input, ts);
    GameStorage.setDirty(gameId);
    return ret;
}
var Game = {
    createGameObject,
    createGame,
    addPlayer,
    handleInput,
};

const log$2 = logger('GameSocket.js');
// Map<gameId, Socket[]>
const SOCKETS = {};
function socketExists(gameId, socket) {
    if (!(gameId in SOCKETS)) {
        return false;
    }
    return SOCKETS[gameId].includes(socket);
}
function removeSocket(gameId, socket) {
    if (!(gameId in SOCKETS)) {
        return;
    }
    SOCKETS[gameId] = SOCKETS[gameId].filter((s) => s !== socket);
    log$2.log('removed socket: ', gameId, socket.protocol);
    log$2.log('socket count: ', Object.keys(SOCKETS[gameId]).length);
}
function addSocket(gameId, socket) {
    if (!(gameId in SOCKETS)) {
        SOCKETS[gameId] = [];
    }
    if (!SOCKETS[gameId].includes(socket)) {
        SOCKETS[gameId].push(socket);
        log$2.log('added socket: ', gameId, socket.protocol);
        log$2.log('socket count: ', Object.keys(SOCKETS[gameId]).length);
    }
}
function getSockets(gameId) {
    if (!(gameId in SOCKETS)) {
        return [];
    }
    return SOCKETS[gameId];
}
var GameSockets = {
    addSocket,
    removeSocket,
    socketExists,
    getSockets,
};

const log$1 = logger('Db.ts');
class Db {
    constructor(file, patchesDir) {
        this.file = file;
        this.patchesDir = patchesDir;
        this.dbh = bsqlite(this.file);
    }
    close() {
        this.dbh.close();
    }
    patch(verbose = true) {
        if (!this.get('sqlite_master', { type: 'table', name: 'db_patches' })) {
            this.run('CREATE TABLE db_patches ( id TEXT PRIMARY KEY);', []);
        }
        const files = fs.readdirSync(this.patchesDir);
        const patches = (this.getMany('db_patches')).map(row => row.id);
        for (const f of files) {
            if (patches.includes(f)) {
                if (verbose) {
                    log$1.info(`➡ skipping already applied db patch: ${f}`);
                }
                continue;
            }
            const contents = fs.readFileSync(`${this.patchesDir}/${f}`, 'utf-8');
            const all = contents.split(';').map(s => s.trim()).filter(s => !!s);
            try {
                this.dbh.transaction((all) => {
                    for (const q of all) {
                        if (verbose) {
                            log$1.info(`Running: ${q}`);
                        }
                        this.run(q);
                    }
                    this.insert('db_patches', { id: f });
                })(all);
                log$1.info(`✓ applied db patch: ${f}`);
            }
            catch (e) {
                log$1.error(`✖ unable to apply patch: ${f} ${e}`);
                return;
            }
        }
    }
    _buildWhere(where) {
        const wheres = [];
        const values = [];
        for (const k of Object.keys(where)) {
            if (where[k] === null) {
                wheres.push(k + ' IS NULL');
                continue;
            }
            if (typeof where[k] === 'object') {
                let prop = '$nin';
                if (where[k][prop]) {
                    if (where[k][prop].length > 0) {
                        wheres.push(k + ' NOT IN (' + where[k][prop].map(() => '?') + ')');
                        values.push(...where[k][prop]);
                    }
                    continue;
                }
                prop = '$in';
                if (where[k][prop]) {
                    if (where[k][prop].length > 0) {
                        wheres.push(k + ' IN (' + where[k][prop].map(() => '?') + ')');
                        values.push(...where[k][prop]);
                    }
                    continue;
                }
                // TODO: implement rest of mongo like query args ($eq, $lte, $in...)
                throw new Error('not implemented: ' + JSON.stringify(where[k]));
            }
            wheres.push(k + ' = ?');
            values.push(where[k]);
        }
        return {
            sql: wheres.length > 0 ? ' WHERE ' + wheres.join(' AND ') : '',
            values,
        };
    }
    _buildOrderBy(orderBy) {
        const sorts = [];
        for (const s of orderBy) {
            const k = Object.keys(s)[0];
            sorts.push(k + ' COLLATE NOCASE ' + (s[k] > 0 ? 'ASC' : 'DESC'));
        }
        return sorts.length > 0 ? ' ORDER BY ' + sorts.join(', ') : '';
    }
    _get(query, params = []) {
        return this.dbh.prepare(query).get(...params);
    }
    run(query, params = []) {
        return this.dbh.prepare(query).run(...params);
    }
    _getMany(query, params = []) {
        return this.dbh.prepare(query).all(...params);
    }
    get(table, whereRaw = {}, orderBy = []) {
        const where = this._buildWhere(whereRaw);
        const orderBySql = this._buildOrderBy(orderBy);
        const sql = 'SELECT * FROM ' + table + where.sql + orderBySql;
        return this._get(sql, where.values);
    }
    getMany(table, whereRaw = {}, orderBy = []) {
        const where = this._buildWhere(whereRaw);
        const orderBySql = this._buildOrderBy(orderBy);
        const sql = 'SELECT * FROM ' + table + where.sql + orderBySql;
        return this._getMany(sql, where.values);
    }
    delete(table, whereRaw = {}) {
        const where = this._buildWhere(whereRaw);
        const sql = 'DELETE FROM ' + table + where.sql;
        return this.run(sql, where.values);
    }
    exists(table, whereRaw) {
        return !!this.get(table, whereRaw);
    }
    upsert(table, data, check, idcol = null) {
        if (!this.exists(table, check)) {
            return this.insert(table, data);
        }
        this.update(table, data, check);
        if (idcol === null) {
            return 0; // dont care about id
        }
        return this.get(table, check)[idcol]; // get id manually
    }
    insert(table, data) {
        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        const sql = 'INSERT INTO ' + table
            + ' (' + keys.join(',') + ')'
            + ' VALUES (' + keys.map(() => '?').join(',') + ')';
        return this.run(sql, values).lastInsertRowid;
    }
    update(table, data, whereRaw = {}) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            return;
        }
        const values = keys.map(k => data[k]);
        const setSql = ' SET ' + keys.join(' = ?,') + ' = ?';
        const where = this._buildWhere(whereRaw);
        const sql = 'UPDATE ' + table + setSql + where.sql;
        this.run(sql, [...values, ...where.values]);
    }
}

const db = new Db(DB_FILE, DB_PATCHES_DIR);
db.patch();
let configFile = '';
let last = '';
for (const val of process.argv) {
    if (last === '-c') {
        configFile = val;
    }
    last = val;
}
if (configFile === '') {
    process.exit(2);
}
const config = JSON.parse(String(fs.readFileSync(configFile)));
const log = logger('main.js');
const port = config.http.port;
const hostname = config.http.hostname;
const app = express();
app.use(compression());
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: function (req, file, cb) {
        cb(null, `${Util.uniqId()}-${file.originalname}`);
    }
});
const upload = multer({ storage }).single('file');
app.get('/api/conf', (req, res) => {
    res.send({
        WS_ADDRESS: config.ws.connectstring,
    });
});
app.get('/api/replay-data', async (req, res) => {
    const q = req.query;
    const offset = parseInt(q.offset, 10) || 0;
    if (offset < 0) {
        res.status(400).send({ reason: 'bad offset' });
        return;
    }
    const size = parseInt(q.size, 10) || 10000;
    if (size < 0 || size > 10000) {
        res.status(400).send({ reason: 'bad size' });
        return;
    }
    const gameId = q.gameId || '';
    if (!GameLog.exists(q.gameId)) {
        res.status(404).send({ reason: 'no log found' });
        return;
    }
    const log = GameLog.get(gameId, offset);
    let game = null;
    if (offset === 0) {
        // also need the game
        game = await Game.createGameObject(gameId, log[0][2], log[0][3], log[0][4], log[0][5] || ScoreMode.FINAL, log[0][6] || ShapeMode.NORMAL, log[0][7] || SnapMode.NORMAL);
    }
    res.send({ log, game: game ? Util.encodeGame(game) : null });
});
app.get('/api/newgame-data', (req, res) => {
    const q = req.query;
    const tagSlugs = q.tags ? q.tags.split(',') : [];
    res.send({
        images: Images.allImagesFromDb(db, tagSlugs, q.sort),
        tags: Images.getAllTags(db),
    });
});
app.get('/api/index-data', (req, res) => {
    const ts = Time.timestamp();
    const games = [
        ...GameCommon.getAllGames().map((game) => ({
            id: game.id,
            hasReplay: GameLog.exists(game.id),
            started: GameCommon.getStartTs(game.id),
            finished: GameCommon.getFinishTs(game.id),
            tilesFinished: GameCommon.getFinishedPiecesCount(game.id),
            tilesTotal: GameCommon.getPieceCount(game.id),
            players: GameCommon.getActivePlayers(game.id, ts).length,
            imageUrl: GameCommon.getImageUrl(game.id),
        })),
    ];
    res.send({
        gamesRunning: games.filter(g => !g.finished),
        gamesFinished: games.filter(g => !!g.finished),
    });
});
const setImageTags = (db, imageId, tags) => {
    tags.forEach((tag) => {
        const slug = Util.slug(tag);
        const id = db.upsert('categories', { slug, title: tag }, { slug }, 'id');
        if (id) {
            db.insert('image_x_category', {
                image_id: imageId,
                category_id: id,
            });
        }
    });
};
app.post('/api/save-image', express.json(), (req, res) => {
    const data = req.body;
    db.update('images', {
        title: data.title,
    }, {
        id: data.id,
    });
    db.delete('image_x_category', { image_id: data.id });
    if (data.tags) {
        setImageTags(db, data.id, data.tags);
    }
    res.send({ ok: true });
});
app.post('/api/upload', (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            log.log(err);
            res.status(400).send("Something went wrong!");
        }
        try {
            await Images.resizeImage(req.file.filename);
        }
        catch (err) {
            log.log(err);
            res.status(400).send("Something went wrong!");
        }
        const dim = await Images.getDimensions(`${UPLOAD_DIR}/${req.file.filename}`);
        const imageId = db.insert('images', {
            filename: req.file.filename,
            filename_original: req.file.originalname,
            title: req.body.title || '',
            created: Time.timestamp(),
            width: dim.w,
            height: dim.h,
        });
        if (req.body.tags) {
            const tags = req.body.tags.split(',').filter((tag) => !!tag);
            setImageTags(db, imageId, tags);
        }
        res.send(Images.imageFromDb(db, imageId));
    });
});
app.post('/api/newgame', express.json(), async (req, res) => {
    const gameSettings = req.body;
    log.log(gameSettings);
    const gameId = Util.uniqId();
    if (!GameCommon.exists(gameId)) {
        const ts = Time.timestamp();
        await Game.createGame(gameId, gameSettings.tiles, gameSettings.image, ts, gameSettings.scoreMode, gameSettings.shapeMode, gameSettings.snapMode);
    }
    res.send({ id: gameId });
});
app.use('/uploads/', express.static(UPLOAD_DIR));
app.use('/', express.static(PUBLIC_DIR));
const wss = new WebSocketServer(config.ws);
const notify = (data, sockets) => {
    for (const socket of sockets) {
        wss.notifyOne(data, socket);
    }
};
wss.on('close', async ({ socket }) => {
    try {
        const proto = socket.protocol.split('|');
        // const clientId = proto[0]
        const gameId = proto[1];
        GameSockets.removeSocket(gameId, socket);
    }
    catch (e) {
        log.error(e);
    }
});
wss.on('message', async ({ socket, data }) => {
    try {
        const proto = socket.protocol.split('|');
        const clientId = proto[0];
        const gameId = proto[1];
        // TODO: maybe handle different types of data
        // (but atm only string comes through)
        const msg = JSON.parse(data);
        const msgType = msg[0];
        switch (msgType) {
            case Protocol.EV_CLIENT_INIT:
                {
                    if (!GameCommon.exists(gameId)) {
                        throw `[game ${gameId} does not exist... ]`;
                    }
                    const ts = Time.timestamp();
                    Game.addPlayer(gameId, clientId, ts);
                    GameSockets.addSocket(gameId, socket);
                    const game = GameCommon.get(gameId);
                    if (!game) {
                        throw `[game ${gameId} does not exist (anymore)... ]`;
                    }
                    notify([Protocol.EV_SERVER_INIT, Util.encodeGame(game)], [socket]);
                }
                break;
            case Protocol.EV_CLIENT_EVENT:
                {
                    if (!GameCommon.exists(gameId)) {
                        throw `[game ${gameId} does not exist... ]`;
                    }
                    const clientSeq = msg[1];
                    const clientEvtData = msg[2];
                    const ts = Time.timestamp();
                    let sendGame = false;
                    if (!GameCommon.playerExists(gameId, clientId)) {
                        Game.addPlayer(gameId, clientId, ts);
                        sendGame = true;
                    }
                    if (!GameSockets.socketExists(gameId, socket)) {
                        GameSockets.addSocket(gameId, socket);
                        sendGame = true;
                    }
                    if (sendGame) {
                        const game = GameCommon.get(gameId);
                        if (!game) {
                            throw `[game ${gameId} does not exist (anymore)... ]`;
                        }
                        notify([Protocol.EV_SERVER_INIT, Util.encodeGame(game)], [socket]);
                    }
                    const changes = Game.handleInput(gameId, clientId, clientEvtData, ts);
                    notify([Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes], GameSockets.getSockets(gameId));
                }
                break;
        }
    }
    catch (e) {
        log.error(e);
    }
});
GameStorage.loadGames();
const server = app.listen(port, hostname, () => log.log(`server running on http://${hostname}:${port}`));
wss.listen();
const memoryUsageHuman = () => {
    const totalHeapSize = v8.getHeapStatistics().total_available_size;
    const totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2);
    log.log(`Total heap size (bytes) ${totalHeapSize}, (GB ~${totalHeapSizeInGB})`);
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    log.log(`Mem: ${Math.round(used * 100) / 100}M`);
};
memoryUsageHuman();
// persist games in fixed interval
const persistInterval = setInterval(() => {
    log.log('Persisting games...');
    GameStorage.persistGames();
    memoryUsageHuman();
}, config.persistence.interval);
const gracefulShutdown = (signal) => {
    log.log(`${signal} received...`);
    log.log('clearing persist interval...');
    clearInterval(persistInterval);
    log.log('persisting games...');
    GameStorage.persistGames();
    log.log('shutting down webserver...');
    server.close();
    log.log('shutting down websocketserver...');
    wss.close();
    log.log('shutting down...');
    process.exit();
};
// used by nodemon
process.once('SIGUSR2', () => {
    gracefulShutdown('SIGUSR2');
});
process.once('SIGINT', () => {
    gracefulShutdown('SIGINT');
});
process.once('SIGTERM', () => {
    gracefulShutdown('SIGTERM');
});
