import { WebSocketServer as WebSocketServer$1 } from 'ws';
import express from 'express';
import compression from 'compression';
import fs, { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import probe from 'probe-image-size';
import exif from 'exif';
import sharp from 'sharp';
import v8 from 'v8';
import { Mutex } from 'async-mutex';
import * as pg from 'pg';
import multer from 'multer';
import request from 'request';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

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
        data.scoreMode,
        data.shapeMode,
        data.snapMode,
        data.creatorUserId,
        data.hasReplay,
        data.gameVersion,
        data.private,
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
        scoreMode: data[5],
        shapeMode: data[6],
        snapMode: data[7],
        creatorUserId: data[8],
        hasReplay: data[9],
        gameVersion: data[10],
        private: data[11],
    };
}
/**
 * @deprecated Uses PuzzleInfo with 'tileSize' prop :(
 */
function coordByPieceIdxDeprecated(info, pieceIdx) {
    const wPieces = info.width / info.tileSize;
    return {
        x: pieceIdx % wPieces,
        y: Math.floor(pieceIdx / wPieces),
    };
}
function coordByPieceIdx(info, pieceIdx) {
    const wPieces = info.width / info.pieceSize;
    return {
        x: pieceIdx % wPieces,
        y: Math.floor(pieceIdx / wPieces),
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
    pad,
    uniqId,
    encodeShape,
    decodeShape,
    encodePiece,
    decodePiece,
    encodePlayer,
    decodePlayer,
    encodeGame,
    decodeGame,
    coordByPieceIdxDeprecated,
    coordByPieceIdx,
    asQueryArgs,
};

const log$6 = logger('WebSocketServer.js');
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
        this._websocketserver = new WebSocketServer$1(this.config);
        this._websocketserver.on('connection', (socket, request) => {
            const pathname = new URL(this.config.connectstring).pathname;
            if (request.url.indexOf(pathname) !== 0) {
                log$6.log('bad request url: ', request.url);
                socket.close();
                return;
            }
            socket.on('message', (data) => {
                const strData = String(data);
                log$6.log(`ws`, socket.protocol, strData);
                this.evt.dispatch('message', { socket, data: strData });
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
const GAME_VERSION = 4; // must be increased whenever there is an incompatible change
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
const INPUT_EV_TOGGLE_PLAYER_NAMES = 15;
const INPUT_EV_CENTER_FIT_PUZZLE = 16;
const INPUT_EV_TOGGLE_FIXED_PIECES = 17;
const INPUT_EV_TOGGLE_LOOSE_PIECES = 18;
const INPUT_EV_STORE_POS = 19;
const INPUT_EV_RESTORE_POS = 20;
const INPUT_EV_CONNECTION_CLOSE = 21;
const INPUT_EV_TOGGLE_TABLE = 22;
const INPUT_EV_TOGGLE_INTERFACE = 23;
const CHANGE_DATA = 1;
const CHANGE_PIECE = 2;
const CHANGE_PLAYER = 3;
const PLAYER_SNAP = 4;
var Protocol = {
    EV_SERVER_EVENT,
    EV_SERVER_INIT,
    EV_CLIENT_EVENT,
    EV_CLIENT_INIT,
    GAME_VERSION,
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
    INPUT_EV_TOGGLE_INTERFACE,
    INPUT_EV_TOGGLE_PREVIEW,
    INPUT_EV_TOGGLE_SOUNDS,
    INPUT_EV_REPLAY_TOGGLE_PAUSE,
    INPUT_EV_REPLAY_SPEED_UP,
    INPUT_EV_REPLAY_SPEED_DOWN,
    INPUT_EV_TOGGLE_PLAYER_NAMES,
    INPUT_EV_CENTER_FIT_PUZZLE,
    INPUT_EV_TOGGLE_FIXED_PIECES,
    INPUT_EV_TOGGLE_LOOSE_PIECES,
    INPUT_EV_TOGGLE_TABLE,
    INPUT_EV_STORE_POS,
    INPUT_EV_RESTORE_POS,
    INPUT_EV_CONNECTION_CLOSE,
    CHANGE_DATA,
    CHANGE_PIECE,
    CHANGE_PLAYER,
    PLAYER_SNAP,
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
const DefaultScoreMode = (v) => {
    if (v === ScoreMode.FINAL || v === ScoreMode.ANY) {
        return v;
    }
    return ScoreMode.FINAL;
};
const DefaultShapeMode = (v) => {
    if (v === ShapeMode.NORMAL || v === ShapeMode.ANY || v === ShapeMode.FLAT) {
        return v;
    }
    return ShapeMode.NORMAL;
};
const DefaultSnapMode = (v) => {
    if (v === SnapMode.NORMAL || v === SnapMode.REAL) {
        return v;
    }
    return SnapMode.NORMAL;
};

const IDLE_TIMEOUT_SEC = 30;
// Map<gameId, Game>
const GAMES = {};
function loaded(gameId) {
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
function unsetGame(gameId) {
    delete GAMES[gameId];
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
    return Game_getActivePlayers(GAMES[gameId], ts);
}
function getIdlePlayers(gameId, ts) {
    return Game_getIdlePlayers(GAMES[gameId], ts);
}
function addPlayer$1(gameId, playerId, ts) {
    if (!playerExists(gameId, playerId)) {
        setPlayer(gameId, playerId, __createPlayerObject(playerId, ts));
    }
    else {
        changePlayer(gameId, playerId, { ts });
    }
}
function get$1(gameId) {
    return GAMES[gameId] || null;
}
function getPieceCount(gameId) {
    return Game_getPieceCount(GAMES[gameId]);
}
function getImageUrl(gameId) {
    return Game_getImageUrl(GAMES[gameId]);
}
function getScoreMode(gameId) {
    return GAMES[gameId].scoreMode;
}
function getSnapMode(gameId) {
    return GAMES[gameId].snapMode;
}
function getVersion(gameId) {
    return GAMES[gameId].gameVersion;
}
function getFinishedPiecesCount(gameId) {
    return Game_getFinishedPiecesCount(GAMES[gameId]);
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
const getPieceGroup = (gameId, pieceIdx) => {
    const piece = getPiece(gameId, pieceIdx);
    return piece.group;
};
const isCornerPiece = (gameId, pieceIdx) => {
    const info = GAMES[gameId].puzzle.info;
    return (pieceIdx === 0 // top left corner
        || pieceIdx === (info.tilesX - 1) // top right corner
        || pieceIdx === (info.tiles - info.tilesX) // bottom left corner
        || pieceIdx === (info.tiles - 1) // bottom right corner
    );
};
const getFinalPiecePos = (gameId, pieceIdx) => {
    const info = GAMES[gameId].puzzle.info;
    const boardPos = {
        x: (info.table.width - info.width) / 2,
        y: (info.table.height - info.height) / 2
    };
    const srcPos = srcPosByPieceIdx(gameId, pieceIdx);
    return Geometry.pointAdd(boardPos, srcPos);
};
const getPiecePos = (gameId, pieceIdx) => {
    const piece = getPiece(gameId, pieceIdx);
    return piece.pos;
};
// TODO: instead, just make the table bigger and use that :)
const getBounds = (gameId) => {
    const gameVersion = getVersion(gameId);
    if (gameVersion <= 3) {
        return getBounds_v3(gameId);
    }
    return getBounds_v4(gameId);
};
const getBounds_v4 = (gameId) => {
    return { x: 0, y: 0, w: getTableWidth(gameId), h: getTableHeight(gameId) };
};
const getBounds_v3 = (gameId) => {
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
const getPieceZIndex = (gameId, pieceIdx) => {
    return getPiece(gameId, pieceIdx).z;
};
const getFirstOwnedPieceIdx = (gameId, playerId) => {
    for (const t of GAMES[gameId].puzzle.tiles) {
        const piece = Util.decodePiece(t);
        if (piece.owner === playerId) {
            return piece.idx;
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
const getStartTs = (gameId) => {
    return Game_getStartTs(GAMES[gameId]);
};
const getFinishTs = (gameId) => {
    return Game_getFinishTs(GAMES[gameId]);
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
function srcPosByPieceIdx(gameId, pieceIdx) {
    const info = GAMES[gameId].puzzle.info;
    const c = Util.coordByPieceIdxDeprecated(info, pieceIdx);
    const cx = c.x * info.tileSize;
    const cy = c.y * info.tileSize;
    return { x: cx, y: cy };
}
function getSurroundingPiecesByIdx(gameId, pieceIdx) {
    const info = GAMES[gameId].puzzle.info;
    const c = Util.coordByPieceIdxDeprecated(info, pieceIdx);
    return [
        // top
        (c.y > 0) ? (pieceIdx - info.tilesX) : -1,
        // right
        (c.x < info.tilesX - 1) ? (pieceIdx + 1) : -1,
        // bottom
        (c.y < info.tilesY - 1) ? (pieceIdx + info.tilesX) : -1,
        // left
        (c.x > 0) ? (pieceIdx - 1) : -1,
    ];
}
const setPiecesZIndex = (gameId, pieceIdxs, zIndex) => {
    for (const pieceIdx of pieceIdxs) {
        changePiece(gameId, pieceIdx, { z: zIndex });
    }
};
const movePieceDiff = (gameId, pieceIdx, diff) => {
    const oldPos = getPiecePos(gameId, pieceIdx);
    const pos = Geometry.pointAdd(oldPos, diff);
    changePiece(gameId, pieceIdx, { pos });
};
const movePiecesDiff = (gameId, pieceIdxs, diff) => {
    const gameVersion = getVersion(gameId);
    if (gameVersion >= 3) {
        return movePiecesDiff_v3(gameId, pieceIdxs, diff);
    }
    return movePiecesDiff_v2(gameId, pieceIdxs, diff);
};
const movePiecesDiff_v2 = (gameId, pieceIdxs, diff) => {
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
    if (!cappedDiff.x && !cappedDiff.y) {
        return false;
    }
    for (const pieceIdx of pieceIdxs) {
        movePieceDiff(gameId, pieceIdx, cappedDiff);
    }
    return true;
};
const movePiecesDiff_v3 = (gameId, pieceIdxs, diff) => {
    const bounds = getBounds(gameId);
    const off = getPieceDrawSize(gameId) + (2 * getPieceDrawOffset(gameId));
    const minX = bounds.x;
    const minY = bounds.y;
    const maxX = minX + bounds.w - off;
    const maxY = minY + bounds.h - off;
    const cappedDiff = diff;
    for (const pieceIdx of pieceIdxs) {
        const t = getPiece(gameId, pieceIdx);
        if (diff.x < 0) {
            cappedDiff.x = Math.max(minX - t.pos.x, cappedDiff.x);
        }
        else {
            cappedDiff.x = Math.min(maxX - t.pos.x, cappedDiff.x);
        }
        if (diff.y < 0) {
            cappedDiff.y = Math.max(minY - t.pos.y, cappedDiff.y);
        }
        else {
            cappedDiff.y = Math.min(maxY - t.pos.y, cappedDiff.y);
        }
    }
    if (!cappedDiff.x && !cappedDiff.y) {
        return false;
    }
    for (const pieceIdx of pieceIdxs) {
        movePieceDiff(gameId, pieceIdx, cappedDiff);
    }
    return true;
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
const setPiecesOwner = (gameId, pieceIdxs, owner) => {
    for (const pieceIdx of pieceIdxs) {
        changePiece(gameId, pieceIdx, { owner });
    }
};
// returns the count of pieces in the same group as
// the piece identified by pieceIdx
function getGroupedPieceCount(gameId, pieceIdx) {
    return getGroupedPieceIdxs(gameId, pieceIdx).length;
}
// get all grouped pieces for a piece
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
// Returns the index of the puzzle piece with the highest z index
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
// determine if two pieces are grouped together
const areGrouped = (gameId, pieceIdx1, pieceIdx2) => {
    const g1 = getPieceGroup(gameId, pieceIdx1);
    const g2 = getPieceGroup(gameId, pieceIdx2);
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
const maySnapToFinal = (gameId, pieceIdxs) => {
    if (getSnapMode(gameId) === SnapMode.REAL) {
        // only can snap to final if any of the grouped pieces are
        // corner pieces
        for (const pieceIdx of pieceIdxs) {
            if (isCornerPiece(gameId, pieceIdx)) {
                return true;
            }
        }
        return false;
    }
    // in other modes can always snap
    return true;
};
function handleInput$1(gameId, playerId, input, ts) {
    const puzzle = GAMES[gameId].puzzle;
    const changes = [];
    const _dataChange = () => {
        changes.push([Protocol.CHANGE_DATA, puzzle.data]);
    };
    const _pieceChange = (pieceIdx) => {
        changes.push([
            Protocol.CHANGE_PIECE,
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
    let anySnapped = false;
    // put both pieces (and their grouped pieces) in the same group
    const groupPieces = (gameId, pieceIdx1, pieceIdx2) => {
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
    if (type === Protocol.INPUT_EV_CONNECTION_CLOSE) {
        // player lost connection, so un-own all their pieces
        const pieceIdx = getFirstOwnedPieceIdx(gameId, playerId);
        if (pieceIdx >= 0) {
            const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
            setPiecesOwner(gameId, pieceIdxs, 0);
            _pieceChanges(pieceIdxs);
        }
    }
    else if (type === Protocol.INPUT_EV_BG_COLOR) {
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
        const diffX = input[1];
        const diffY = input[2];
        const player = getPlayer(gameId, playerId);
        if (player) {
            const x = player.x - diffX;
            const y = player.y - diffY;
            changePlayer(gameId, playerId, { ts, x, y });
            _playerChange();
            const pieceIdx = getFirstOwnedPieceIdx(gameId, playerId);
            if (pieceIdx >= 0) {
                // check if pos is on the piece, otherwise dont move
                // (mouse could be out of table, but piece stays on it)
                const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
                const diff = { x: -diffX, y: -diffY };
                if (movePiecesDiff(gameId, pieceIdxs, diff)) {
                    _pieceChanges(pieceIdxs);
                }
            }
        }
    }
    else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
        const x = input[1];
        const y = input[2];
        const pos = { x, y };
        changePlayer(gameId, playerId, { d: 1, ts });
        _playerChange();
        const tileIdxAtPos = freePieceIdxByPos(gameId, pos);
        if (tileIdxAtPos >= 0) {
            const maxZ = getMaxZIndex(gameId) + 1;
            changeData(gameId, { maxZ });
            _dataChange();
            const tileIdxs = getGroupedPieceIdxs(gameId, tileIdxAtPos);
            setPiecesZIndex(gameId, tileIdxs, getMaxZIndex(gameId));
            setPiecesOwner(gameId, tileIdxs, playerId);
            _pieceChanges(tileIdxs);
        }
    }
    else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
        const x = input[1];
        const y = input[2];
        const down = input[5];
        if (!down) {
            // player is just moving the hand
            changePlayer(gameId, playerId, { x, y, ts });
            _playerChange();
        }
        else {
            const pieceIdx = getFirstOwnedPieceIdx(gameId, playerId);
            if (pieceIdx < 0) {
                // player is just moving map, so no change in position!
                changePlayer(gameId, playerId, { ts });
                _playerChange();
            }
            else {
                const x = input[1];
                const y = input[2];
                const diffX = input[3];
                const diffY = input[4];
                // player is moving a piece (and hand)
                changePlayer(gameId, playerId, { x, y, ts });
                _playerChange();
                // check if pos is on the piece, otherwise dont move
                // (mouse could be out of table, but piece stays on it)
                const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
                const diff = { x: diffX, y: diffY };
                if (movePiecesDiff(gameId, pieceIdxs, diff)) {
                    _pieceChanges(pieceIdxs);
                }
            }
        }
    }
    else if (type === Protocol.INPUT_EV_MOUSE_UP) {
        const d = 0; // mouse down = false
        const pieceIdx = getFirstOwnedPieceIdx(gameId, playerId);
        if (pieceIdx >= 0) {
            // drop the piece(s)
            const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
            setPiecesOwner(gameId, pieceIdxs, 0);
            _pieceChanges(pieceIdxs);
            // Check if the piece was dropped near the final location
            const piecePos = getPiecePos(gameId, pieceIdx);
            const finalPiecePos = getFinalPiecePos(gameId, pieceIdx);
            if (maySnapToFinal(gameId, pieceIdxs)
                && Geometry.pointDistance(finalPiecePos, piecePos) < puzzle.info.snapDistance) {
                const diff = Geometry.pointSub(finalPiecePos, piecePos);
                // Snap the piece to the final destination
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
                anySnapped = true;
            }
            else {
                // Snap to other pieces
                const check = (gameId, pieceIdx, otherPieceIdx, off) => {
                    const info = GAMES[gameId].puzzle.info;
                    if (otherPieceIdx < 0) {
                        return false;
                    }
                    if (areGrouped(gameId, pieceIdx, otherPieceIdx)) {
                        return false;
                    }
                    const piecePos = getPiecePos(gameId, pieceIdx);
                    const dstPos = Geometry.pointAdd(getPiecePos(gameId, otherPieceIdx), { x: off[0] * info.tileSize, y: off[1] * info.tileSize });
                    if (Geometry.pointDistance(piecePos, dstPos) < info.snapDistance) {
                        const diff = Geometry.pointSub(dstPos, piecePos);
                        let pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
                        movePiecesDiff(gameId, pieceIdxs, diff);
                        groupPieces(gameId, pieceIdx, otherPieceIdx);
                        pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx);
                        if (isFinishedPiece(gameId, otherPieceIdx)) {
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
                    const othersIdxs = getSurroundingPiecesByIdx(gameId, pieceIdxTmp);
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
                if (snapped) {
                    anySnapped = true;
                }
            }
        }
        else {
            changePlayer(gameId, playerId, { d, ts });
            _playerChange();
        }
    }
    else if (type === Protocol.INPUT_EV_ZOOM_IN) {
        const x = input[1];
        const y = input[2];
        changePlayer(gameId, playerId, { x, y, ts });
        _playerChange();
    }
    else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
        const x = input[1];
        const y = input[2];
        changePlayer(gameId, playerId, { x, y, ts });
        _playerChange();
    }
    else {
        changePlayer(gameId, playerId, { ts });
        _playerChange();
    }
    if (anySnapped) {
        changes.push([
            Protocol.PLAYER_SNAP,
            playerId,
        ]);
    }
    return changes;
}
// functions that operate on given game instance instead of global one
// -------------------------------------------------------------------
function Game_getStartTs(game) {
    return game.puzzle.data.started;
}
function Game_getFinishTs(game) {
    return game.puzzle.data.finished;
}
function Game_getFinishedPiecesCount(game) {
    let count = 0;
    for (const t of game.puzzle.tiles) {
        if (Util.decodePiece(t).owner === -1) {
            count++;
        }
    }
    return count;
}
function Game_getPieceCount(game) {
    return game.puzzle.tiles.length;
}
function Game_getAllPlayers(game) {
    return game.players.map(Util.decodePlayer);
}
function Game_getActivePlayers(game, ts) {
    const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC;
    return Game_getAllPlayers(game).filter((p) => p.ts >= minTs);
}
function Game_getIdlePlayers(game, ts) {
    const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC;
    return Game_getAllPlayers(game).filter((p) => p.ts < minTs && p.points > 0);
}
function Game_getImageUrl(game) {
    const imageUrl = game.puzzle.info.image?.url || game.puzzle.info.imageUrl;
    if (!imageUrl) {
        throw new Error('[2021-07-11] no image url set');
    }
    return imageUrl;
}
function Game_isFinished(game) {
    return Game_getFinishedPiecesCount(game) === Game_getPieceCount(game);
}
var GameCommon = {
    setGame,
    unsetGame,
    loaded,
    playerExists,
    getActivePlayers,
    getIdlePlayers,
    addPlayer: addPlayer$1,
    getFinishedPiecesCount,
    getPieceCount,
    getImageUrl,
    get: get$1,
    getGroupedPieceCount,
    getPlayerBgColor,
    getPlayerColor,
    getPlayerName,
    getPlayerIndexById,
    getPlayerIdByIndex,
    changePlayer,
    setPlayer,
    setPiece,
    setPuzzleData,
    getBounds,
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
    /// operate directly on the game object given
    Game_getStartTs,
    Game_getFinishTs,
    Game_getFinishedPiecesCount,
    Game_getPieceCount,
    Game_getActivePlayers,
    Game_getImageUrl,
    Game_isFinished,
};

const log$5 = logger('Config.ts');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_DIR = `${__dirname}/../..`;
const DATA_DIR = `${BASE_DIR}/data`;
const UPLOAD_DIR = `${BASE_DIR}/data/uploads`;
const UPLOAD_URL = `/uploads`;
const PUBLIC_DIR = `${BASE_DIR}/build/public/`;
const DB_PATCHES_DIR = `${BASE_DIR}/src/dbpatches`;
const init = () => {
    const configFile = process.env.APP_CONFIG || '';
    if (configFile === '') {
        log$5.error('APP_CONFIG environment variable not set or empty');
        process.exit(2);
    }
    const config = JSON.parse(String(readFileSync(configFile)));
    config.dir = { DATA_DIR, UPLOAD_DIR, UPLOAD_URL, PUBLIC_DIR, DB_PATCHES_DIR };
    return config;
};
const config = init();

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
const filename = (gameId, offset) => `${config.dir.DATA_DIR}/log_${gameId}-${offset}.log`;
const idxname = (gameId) => `${config.dir.DATA_DIR}/log_${gameId}.idx.log`;
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
const exists$1 = (gameId) => {
    const idxfile = idxname(gameId);
    return fs.existsSync(idxfile);
};
function hasReplay(game) {
    if (!exists$1(game.id)) {
        return false;
    }
    if (game.gameVersion < 2) {
        // replays before gameVersion 2 are incompatible with current code
        return false;
    }
    // from 2 onwards we try to stay compatible by keeping behavior same in
    // old functions and instead just add new functions for new versions
    return true;
}
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
    const lines = fs.readFileSync(file, 'utf-8').split("\n");
    const log = lines.filter(line => !!line).map(line => {
        return JSON.parse(`[${line}]`);
    });
    if (offset === 0 && log.length > 0) {
        log[0][5] = DefaultScoreMode(log[0][5]);
        log[0][6] = DefaultShapeMode(log[0][6]);
        log[0][7] = DefaultSnapMode(log[0][7]);
        log[0][8] = log[0][8] || null; // creatorUserId
        log[0][9] = log[0][9] || 0; // private
    }
    return log;
};
var GameLog = {
    shouldLog,
    create,
    exists: exists$1,
    hasReplay,
    log: _log,
    get,
    filename,
    idxname,
};

const log$4 = logger('Images.ts');
const resizeImage = async (filename) => {
    try {
        const imagePath = `${config.dir.UPLOAD_DIR}/${filename}`;
        const imageOutPath = `${config.dir.UPLOAD_DIR}/r/${filename}`;
        const orientation = await getExifOrientation(imagePath);
        let sharpImg = sharp(imagePath, { failOnError: false });
        // when image is rotated to the left or right, switch width/height
        // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
        if (orientation === 6) {
            sharpImg = sharpImg.rotate(90);
        }
        else if (orientation === 3) {
            sharpImg = sharpImg.rotate(180);
        }
        else if (orientation === 8) {
            sharpImg = sharpImg.rotate(270);
        }
        const sizes = [
            [150, 100, 'contain'],
            [375, 210, 'contain'],
            [375, null, 'cover'],
        ];
        for (const [w, h, fit] of sizes) {
            const filename = `${imageOutPath}-${w}x${h || 0}.webp`;
            if (!fs.existsSync(filename)) {
                log$4.info(w, h, filename);
                await sharpImg.resize(w, h, { fit }).toFile(filename);
            }
        }
    }
    catch (e) {
        log$4.error('error when resizing image', filename, e);
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
const getAllTags = async (db) => {
    const query = `
select c.id, c.slug, c.title, count(*) as total from categories c
inner join image_x_category ixc on c.id = ixc.category_id
inner join images i on i.id = ixc.image_id
group by c.id order by total desc;`;
    return (await db._getMany(query)).map(row => ({
        id: parseInt(row.id, 10) || 0,
        slug: row.slug,
        title: row.title,
        total: parseInt(row.total, 10) || 0,
    }));
};
const getTags = async (db, imageId) => {
    const query = `
select c.id, c.slug, c.title from categories c
inner join image_x_category ixc on c.id = ixc.category_id
where ixc.image_id = $1`;
    return (await db._getMany(query, [imageId])).map(row => ({
        id: parseInt(row.id, 10) || 0,
        slug: row.slug,
        title: row.title,
        total: 0,
    }));
};
const imageFromDb = async (db, imageId) => {
    const imageRow = await db.get('images', { id: imageId });
    if (!imageRow) {
        return null;
    }
    return {
        id: imageRow.id,
        uploaderUserId: imageRow.uploader_user_id,
        filename: imageRow.filename,
        url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(imageRow.filename)}`,
        title: imageRow.title,
        tags: await getTags(db, imageRow.id),
        created: imageRow.created.getTime(),
        width: imageRow.width,
        height: imageRow.height,
    };
};
const getCategoryRowsBySlugs = async (db, slugs) => {
    const c = await db.getMany('categories', { slug: { '$in': slugs } });
    return c;
};
const allImagesFromDb = async (db, tagSlugs, orderBy, isPrivate) => {
    const orderByMap = {
        alpha_asc: [{ filename: 1 }],
        alpha_desc: [{ filename: -1 }],
        date_asc: [{ created: 1 }],
        date_desc: [{ created: -1 }],
    };
    // TODO: .... clean up
    const wheresRaw = {};
    wheresRaw['private'] = isPrivate ? 1 : 0;
    if (tagSlugs.length > 0) {
        const c = await getCategoryRowsBySlugs(db, tagSlugs);
        if (!c) {
            return [];
        }
        const where = db._buildWhere({
            'category_id': { '$in': c.map(x => x.id) }
        });
        const ids = (await db._getMany(`
select i.id from image_x_category ixc
inner join images i on i.id = ixc.image_id ${where.sql};
`, where.values)).map(img => img.id);
        if (ids.length === 0) {
            return [];
        }
        wheresRaw['id'] = { '$in': ids };
    }
    const imageCounts = await db._getMany(`
select count(*) as count, image_id from games where private = $1 group by image_id
`, [isPrivate ? 1 : 0]);
    const imageCountMap = new Map();
    for (const row of imageCounts) {
        imageCountMap.set(row.image_id, row.count);
    }
    const tmpImages = await db.getMany('images', wheresRaw, orderByMap[orderBy]);
    const images = [];
    for (const i of tmpImages) {
        images.push({
            id: i.id,
            uploaderUserId: i.uploader_user_id,
            filename: i.filename,
            url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
            title: i.title,
            tags: await getTags(db, i.id),
            created: i.created.getTime(),
            width: i.width,
            height: i.height,
            private: !!i.private,
            gameCount: imageCountMap.get(i.id) || 0,
        });
    }
    if (orderBy === 'game_count_asc') {
        images.sort((a, b) => a.gameCount === b.gameCount ? 0 : (a.gameCount > b.gameCount ? -1 : 1));
    }
    else if (orderBy === 'game_count_desc') {
        images.sort((a, b) => a.gameCount === b.gameCount ? 0 : (a.gameCount > b.gameCount ? 1 : -1));
    }
    return images;
};
async function getDimensions(imagePath) {
    const dimensions = await probe(fs.createReadStream(imagePath));
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
const setTags = async (db, imageId, tags) => {
    await db.delete('image_x_category', { image_id: imageId });
    for (const tag of tags) {
        const slug = Util.slug(tag);
        const id = await db.upsert('categories', { slug, title: tag }, { slug }, 'id');
        if (id) {
            await db.insert('image_x_category', {
                image_id: imageId,
                category_id: id,
            });
        }
    }
};
var Images = {
    imageFromDb,
    allImagesFromDb,
    getAllTags,
    resizeImage,
    getDimensions,
    setTags,
};

// cut size of each puzzle piece in the
// final resized version of the puzzle image
const PIECE_SIZE = 64;
async function createPuzzle(rng, targetPieceCount, image, ts, shapeMode, gameVersion) {
    const imagePath = `${config.dir.UPLOAD_DIR}/${image.filename}`;
    const imageUrl = image.url;
    // determine puzzle information from the image dimensions
    const dim = await Images.getDimensions(imagePath);
    if (!dim.w || !dim.h) {
        throw `[ 2021-05-16 invalid dimension for path ${imagePath} ]`;
    }
    const info = determinePuzzleInfo(dim, targetPieceCount);
    const rawPieces = new Array(info.pieceCount);
    for (let i = 0; i < rawPieces.length; i++) {
        rawPieces[i] = { idx: i };
    }
    const shapes = determinePuzzlePieceShapes(rng, info, shapeMode);
    let positions = new Array(info.pieceCount);
    for (const piece of rawPieces) {
        const coord = Util.coordByPieceIdx(info, piece.idx);
        positions[piece.idx] = {
            // TODO: cant we just use info.pieceDrawSize?
            // instead of info.pieceSize, we multiply it by 1.5
            // to spread the pieces a bit
            x: coord.x * info.pieceSize * 1.5,
            y: coord.y * info.pieceSize * 1.5,
        };
    }
    const tableDim = determineTableDim(info, gameVersion);
    const off = info.pieceSize * 1.5;
    const last = {
        x: (tableDim.w - info.width) / 2 - (1 * off),
        y: (tableDim.h - info.height) / 2 - (2 * off),
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
            // who owns the piece
            // 0 = free for taking
            // -1 = finished
            // other values: id of player who has the piece
            owner: 0,
            // physical current position of the piece (x/y in pixels)
            // this position is the initial position only and is the
            // value that changes when moving a piece
            pos: positions[piece.idx],
        });
    });
    // Complete puzzle object
    return {
        // pieces array
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
                width: tableDim.w,
                height: tableDim.h,
            },
            // information that was used to create the puzzle
            targetTiles: targetPieceCount,
            imageUrl,
            image: image,
            width: info.width,
            height: info.height,
            tileSize: info.pieceSize,
            tileDrawSize: info.pieceDrawSize,
            tileMarginWidth: info.pieceMarginWidth,
            // offset in x and y when drawing tiles, so that they appear to be at pos
            tileDrawOffset: (info.pieceDrawSize - info.pieceSize) / -2,
            // max distance between tile and destination that
            // makes the tile snap to destination
            snapDistance: info.pieceSize / 2,
            tiles: info.pieceCount,
            tilesX: info.pieceCountHorizontal,
            tilesY: info.pieceCountVertical,
            // ( index => {x, y} )
            // this is not the physical coordinate, but
            // the piece_coordinate
            // this can be used to determine where the
            // final destination of a piece is
            shapes: shapes, // piece shapes
        },
    };
}
function determineTableDim(info, gameVersion) {
    if (gameVersion <= 3) {
        return { w: info.width * 3, h: info.height * 3 };
    }
    const tableSize = Math.max(info.width, info.height) * 6;
    return { w: tableSize, h: tableSize };
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
function determinePuzzlePieceShapes(rng, info, shapeMode) {
    const tabs = determineTabs(shapeMode);
    const shapes = new Array(info.pieceCount);
    for (let i = 0; i < info.pieceCount; i++) {
        const coord = Util.coordByPieceIdx(info, i);
        shapes[i] = {
            top: coord.y === 0 ? 0 : shapes[i - info.pieceCountHorizontal].bottom * -1,
            right: coord.x === info.pieceCountHorizontal - 1 ? 0 : rng.choice(tabs),
            left: coord.x === 0 ? 0 : shapes[i - 1].right * -1,
            bottom: coord.y === info.pieceCountVertical - 1 ? 0 : rng.choice(tabs),
        };
    }
    return shapes.map(Util.encodeShape);
}
const determinePiecesXY = (dim, targetPiecesCount) => {
    const w_ = dim.w < dim.h ? (dim.w * dim.h) : (dim.w * dim.w);
    const h_ = dim.w < dim.h ? (dim.h * dim.h) : (dim.w * dim.h);
    let size = 0;
    let pieces = 0;
    do {
        size++;
        pieces = Math.floor(w_ / size) * Math.floor(h_ / size);
    } while (pieces >= targetPiecesCount);
    size--;
    return {
        countHorizontal: Math.round(w_ / size),
        countVertical: Math.round(h_ / size),
    };
};
const determinePuzzleInfo = (dim, targetPieceCount) => {
    const { countHorizontal, countVertical } = determinePiecesXY(dim, targetPieceCount);
    const pieceCount = countHorizontal * countVertical;
    const pieceSize = PIECE_SIZE;
    const width = countHorizontal * pieceSize;
    const height = countVertical * pieceSize;
    const pieceMarginWidth = pieceSize * .5;
    const pieceDrawSize = Math.round(pieceSize + pieceMarginWidth * 2);
    return {
        width,
        height,
        pieceSize: pieceSize,
        pieceMarginWidth: pieceMarginWidth,
        pieceDrawSize: pieceDrawSize,
        pieceCount: pieceCount,
        pieceCountHorizontal: countHorizontal,
        pieceCountVertical: countVertical,
    };
};

const log$3 = logger('GameStorage.js');
const dirtyGames = {};
function setDirty(gameId) {
    dirtyGames[gameId] = true;
}
function setClean(gameId) {
    if (gameId in dirtyGames) {
        delete dirtyGames[gameId];
    }
}
function gameRowToGameObject(gameRow) {
    let game;
    try {
        game = JSON.parse(gameRow.data);
    }
    catch {
        return null;
    }
    if (typeof game.puzzle.data.started === 'undefined') {
        game.puzzle.data.started = gameRow.created.getTime();
    }
    if (typeof game.puzzle.data.finished === 'undefined') {
        game.puzzle.data.finished = gameRow.finished ? gameRow.finished.getTime() : 0;
    }
    if (!Array.isArray(game.players)) {
        game.players = Object.values(game.players);
    }
    const gameObject = storeDataToGame(game, gameRow.creator_user_id, !!gameRow.private);
    gameObject.hasReplay = GameLog.hasReplay(gameObject);
    return gameObject;
}
async function getGameRowById(db, gameId) {
    const gameRow = await db.get('games', { id: gameId });
    return gameRow || null;
}
async function getPublicGameRows(db) {
    return await db.getMany('games', { private: 0 });
}
async function loadGame(db, gameId) {
    log$3.info(`[INFO] loading game: ${gameId}`);
    const gameRow = await getGameRowById(db, gameId);
    if (!gameRow) {
        log$3.info(`[INFO] game not found: ${gameId}`);
        return null;
    }
    const gameObject = gameRowToGameObject(gameRow);
    if (!gameObject) {
        log$3.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
        return null;
    }
    return gameObject;
}
async function getAllPublicGames(db) {
    const gameRows = await getPublicGameRows(db);
    const games = [];
    for (const gameRow of gameRows) {
        const gameObject = gameRowToGameObject(gameRow);
        if (!gameObject) {
            log$3.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
            continue;
        }
        games.push(gameObject);
    }
    return games;
}
async function exists(db, gameId) {
    const gameRow = await getGameRowById(db, gameId);
    return !!gameRow;
}
function dirtyGameIds() {
    return Object.keys(dirtyGames);
}
async function persistGame(db, game) {
    setClean(game.id);
    await db.upsert('games', {
        id: game.id,
        creator_user_id: game.creatorUserId,
        image_id: game.puzzle.info.image?.id,
        created: new Date(game.puzzle.data.started),
        finished: game.puzzle.data.finished ? new Date(game.puzzle.data.finished) : null,
        data: JSON.stringify(gameToStoreData(game)),
        private: game.private ? 1 : 0,
    }, {
        id: game.id,
    });
    log$3.info(`[INFO] persisted game ${game.id}`);
}
function storeDataToGame(storeData, creatorUserId, isPrivate) {
    return {
        id: storeData.id,
        gameVersion: storeData.gameVersion || 1,
        creatorUserId,
        rng: {
            type: storeData.rng ? storeData.rng.type : '_fake_',
            obj: storeData.rng ? Rng.unserialize(storeData.rng.obj) : new Rng(0),
        },
        puzzle: storeData.puzzle,
        players: storeData.players,
        scoreMode: DefaultScoreMode(storeData.scoreMode),
        shapeMode: DefaultShapeMode(storeData.shapeMode),
        snapMode: DefaultSnapMode(storeData.snapMode),
        hasReplay: !!storeData.hasReplay,
        private: isPrivate,
    };
}
function gameToStoreData(game) {
    return {
        id: game.id,
        gameVersion: game.gameVersion,
        rng: {
            type: game.rng.type,
            obj: Rng.serialize(game.rng.obj),
        },
        puzzle: game.puzzle,
        players: game.players,
        scoreMode: game.scoreMode,
        shapeMode: game.shapeMode,
        snapMode: game.snapMode,
        hasReplay: game.hasReplay,
    };
}
var GameStorage = {
    persistGame,
    loadGame,
    getAllPublicGames,
    exists,
    setDirty,
    dirtyGameIds,
};

async function createGameObject(gameId, gameVersion, targetPieceCount, image, ts, scoreMode, shapeMode, snapMode, creatorUserId, hasReplay, isPrivate) {
    const seed = Util.hash(gameId + ' ' + ts);
    const rng = new Rng(seed);
    return {
        id: gameId,
        gameVersion: gameVersion,
        creatorUserId,
        rng: { type: 'Rng', obj: rng },
        puzzle: await createPuzzle(rng, targetPieceCount, image, ts, shapeMode, gameVersion),
        players: [],
        scoreMode,
        shapeMode,
        snapMode,
        hasReplay,
        private: isPrivate,
    };
}
async function createNewGame(db, gameSettings, ts, creatorUserId) {
    let gameId;
    do {
        gameId = Util.uniqId();
    } while (await GameStorage.exists(db, gameId));
    const gameObject = await createGameObject(gameId, Protocol.GAME_VERSION, gameSettings.tiles, gameSettings.image, ts, gameSettings.scoreMode, gameSettings.shapeMode, gameSettings.snapMode, creatorUserId, true, // hasReplay
    gameSettings.private);
    GameLog.create(gameId, ts);
    GameLog.log(gameObject.id, Protocol.LOG_HEADER, gameObject.gameVersion, gameSettings.tiles, gameSettings.image, ts, gameObject.scoreMode, gameObject.shapeMode, gameObject.snapMode, gameObject.creatorUserId, gameObject.private ? 1 : 0);
    GameCommon.setGame(gameObject.id, gameObject);
    GameStorage.setDirty(gameObject.id);
    return gameObject.id;
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
    createNewGame,
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

// @ts-ignore
const { Client } = pg.default;
const log$1 = logger('Db.ts');
const mutex = new Mutex();
class Db {
    constructor(connectStr, patchesDir) {
        this.patchesDir = patchesDir;
        this.dbh = new Client(connectStr);
    }
    async connect() {
        await this.dbh.connect();
    }
    async close() {
        await this.dbh.end();
    }
    async patch(verbose = true) {
        await this.run('CREATE TABLE IF NOT EXISTS public.db_patches ( id TEXT PRIMARY KEY);', []);
        const files = fs.readdirSync(this.patchesDir);
        const patches = (await this.getMany('public.db_patches')).map(row => row.id);
        for (const f of files) {
            if (patches.includes(f)) {
                if (verbose) {
                    log$1.info(`??? skipping already applied db patch: ${f}`);
                }
                continue;
            }
            const contents = fs.readFileSync(`${this.patchesDir}/${f}`, 'utf-8');
            const all = contents.split(';').map(s => s.trim()).filter(s => !!s);
            try {
                try {
                    await this.run('BEGIN');
                    for (const q of all) {
                        await this.run(q);
                    }
                    await this.run('COMMIT');
                }
                catch (e) {
                    await this.run('ROLLBACK');
                    throw e;
                }
                await this.insert('public.db_patches', { id: f });
                log$1.info(`??? applied db patch: ${f}`);
            }
            catch (e) {
                log$1.error(`??? unable to apply patch: ${f} ${e}`);
                return;
            }
        }
    }
    _buildWhere(where, $i = 1) {
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
                        wheres.push(k + ' NOT IN (' + where[k][prop].map(() => `$${$i++}`) + ')');
                        values.push(...where[k][prop]);
                    }
                    continue;
                }
                prop = '$in';
                if (where[k][prop]) {
                    if (where[k][prop].length > 0) {
                        wheres.push(k + ' IN (' + where[k][prop].map(() => `$${$i++}`) + ')');
                        values.push(...where[k][prop]);
                    }
                    continue;
                }
                prop = "$gte";
                if (where[k][prop]) {
                    wheres.push(k + ` >= $${$i++}`);
                    values.push(where[k][prop]);
                    continue;
                }
                prop = "$lte";
                if (where[k][prop]) {
                    wheres.push(k + ` <= $${$i++}`);
                    values.push(where[k][prop]);
                    continue;
                }
                prop = "$lte";
                if (where[k][prop]) {
                    wheres.push(k + ` <= $${$i++}`);
                    values.push(where[k][prop]);
                    continue;
                }
                prop = '$gt';
                if (where[k][prop]) {
                    wheres.push(k + ` > $${$i++}`);
                    values.push(where[k][prop]);
                    continue;
                }
                prop = '$lt';
                if (where[k][prop]) {
                    wheres.push(k + ` < $${$i++}`);
                    values.push(where[k][prop]);
                    continue;
                }
                prop = '$ne';
                if (where[k][prop]) {
                    wheres.push(k + ` != $${$i++}`);
                    values.push(where[k][prop]);
                    continue;
                }
                // TODO: implement rest of mongo like query args ($eq, $lte, $in...)
                throw new Error('not implemented: ' + JSON.stringify(where[k]));
            }
            wheres.push(k + ` = $${$i++}`);
            values.push(where[k]);
        }
        return {
            sql: wheres.length > 0 ? ' WHERE ' + wheres.join(' AND ') : '',
            values,
            $i,
        };
    }
    _buildOrderBy(orderBy) {
        const sorts = [];
        for (const s of orderBy) {
            const k = Object.keys(s)[0];
            sorts.push(k + ' ' + (s[k] > 0 ? 'ASC' : 'DESC'));
        }
        return sorts.length > 0 ? ' ORDER BY ' + sorts.join(', ') : '';
    }
    async _get(query, params = []) {
        try {
            return (await this.dbh.query(query, params)).rows[0] || null;
        }
        catch (e) {
            log$1.info('_get', query, params);
            console.error(e);
            throw e;
        }
    }
    async run(query, params = []) {
        try {
            return await this.dbh.query(query, params);
        }
        catch (e) {
            log$1.info('run', query, params);
            console.error(e);
            throw e;
        }
    }
    async _getMany(query, params = []) {
        try {
            return (await this.dbh.query(query, params)).rows || [];
        }
        catch (e) {
            log$1.info('_getMany', query, params);
            console.error(e);
            throw e;
        }
    }
    async get(table, whereRaw = {}, orderBy = []) {
        const where = this._buildWhere(whereRaw);
        const orderBySql = this._buildOrderBy(orderBy);
        const sql = 'SELECT * FROM ' + table + where.sql + orderBySql;
        return await this._get(sql, where.values);
    }
    async getMany(table, whereRaw = {}, orderBy = []) {
        const where = this._buildWhere(whereRaw);
        const orderBySql = this._buildOrderBy(orderBy);
        const sql = 'SELECT * FROM ' + table + where.sql + orderBySql;
        return await this._getMany(sql, where.values);
    }
    async delete(table, whereRaw = {}) {
        const where = this._buildWhere(whereRaw);
        const sql = 'DELETE FROM ' + table + where.sql;
        return await this.run(sql, where.values);
    }
    async exists(table, whereRaw) {
        return !!await this.get(table, whereRaw);
    }
    async upsert(table, data, check, idcol = null) {
        return mutex.runExclusive(async () => {
            if (!await this.exists(table, check)) {
                return await this.insert(table, data, idcol);
            }
            await this.update(table, data, check);
            if (idcol === null) {
                return 0; // dont care about id
            }
            return (await this.get(table, check))[idcol]; // get id manually
        });
    }
    async insert(table, data, idcol = null) {
        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        let $i = 1;
        let sql = 'INSERT INTO ' + table
            + ' (' + keys.join(',') + ')'
            + ' VALUES (' + keys.map(() => `$${$i++}`).join(',') + ')';
        if (idcol) {
            sql += ` RETURNING ${idcol}`;
            return (await this.run(sql, values)).rows[0][idcol];
        }
        await this.run(sql, values);
        return 0;
    }
    async update(table, data, whereRaw = {}) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            return;
        }
        let $i = 1;
        const values = keys.map(k => data[k]);
        const setSql = ' SET ' + keys.map((k) => `${k} = $${$i++}`).join(',');
        const where = this._buildWhere(whereRaw, $i);
        const sql = 'UPDATE ' + table + setSql + where.sql;
        await this.run(sql, [...values, ...where.values]);
    }
}

const TABLE = 'users';
const HEADER_CLIENT_ID = 'client-id';
const HEADER_CLIENT_SECRET = 'client-secret';
const getOrCreateUser = async (db, req) => {
    let user = await getUser(db, req);
    if (!user) {
        await db.insert(TABLE, {
            'client_id': req.headers[HEADER_CLIENT_ID],
            'client_secret': req.headers[HEADER_CLIENT_SECRET],
            'created': new Date(),
        });
        user = await getUser(db, req);
    }
    return user;
};
const getUser = async (db, req) => {
    const user = await db.get(TABLE, {
        'client_id': req.headers[HEADER_CLIENT_ID],
        'client_secret': req.headers[HEADER_CLIENT_SECRET],
    });
    if (user) {
        user.id = parseInt(user.id, 10);
    }
    return user;
};
var Users = {
    getOrCreateUser,
    getUser,
};

const passwordHash = (plainPass, salt) => {
    const hash = crypto.createHmac('sha512', config.secret);
    hash.update(`${salt}${plainPass}`);
    return hash.digest('hex');
};
// do something CRYPTO secure???
const generateToken = () => {
    return randomString(32);
};
const randomString = (length) => {
    const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
    const b = [];
    for (let i = 0; i < length; i++) {
        const j = parseInt((Math.random() * (a.length - 1)).toFixed(0), 10);
        b[i] = a[j];
    }
    return b.join('');
};

const log = logger('web_routes/api/index.ts');
function createRouter$1(db) {
    const storage = multer.diskStorage({
        destination: config.dir.UPLOAD_DIR,
        filename: function (req, file, cb) {
            cb(null, `${Util.uniqId()}-${file.originalname}`);
        }
    });
    const upload = multer({ storage }).single('file');
    const router = express.Router();
    router.get('/me', async (req, res) => {
        if (req.user) {
            res.send({
                id: req.user.id,
                clientId: req.user.client_id,
                clientSecret: req.user.client_secret,
                created: req.user.created,
            });
            return;
        }
        res.status(401).send({ reason: 'not logged in' });
        return;
    });
    router.post('/auth', express.json(), async (req, res) => {
        const loginPlain = req.body.login;
        const passPlain = req.body.pass;
        const user = await db.get('users', { login: loginPlain });
        if (!user) {
            res.status(401).send({ reason: 'bad credentials' });
            return;
        }
        const salt = user.salt;
        const passHashed = passwordHash(passPlain, salt);
        if (user.pass !== passHashed) {
            res.status(401).send({ reason: 'bad credentials' });
            return;
        }
        const token = generateToken();
        await db.insert('tokens', { user_id: user.id, token, type: 'auth' });
        res.cookie('x-token', token, { maxAge: 356 * Time.DAY, httpOnly: true });
        res.send({ success: true });
    });
    router.post('/logout', async (req, res) => {
        if (!req.token) {
            res.status(401).send({});
            return;
        }
        await db.delete('tokens', { token: req.token });
        res.clearCookie("x-token");
        res.send({ success: true });
    });
    router.get('/conf', (req, res) => {
        res.send({
            WS_ADDRESS: config.ws.connectstring,
        });
    });
    router.get('/replay-data', async (req, res) => {
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
            game = await Game.createGameObject(gameId, log[0][1], // gameVersion
            log[0][2], // targetPieceCount
            log[0][3], // must be ImageInfo
            log[0][4], // ts (of game creation)
            log[0][5], // scoreMode
            log[0][6], // shapeMode
            log[0][7], // snapMode
            log[0][8], // creatorUserId
            true, // hasReplay
            !!log[0][9]);
        }
        res.send({ log, game: game ? Util.encodeGame(game) : null });
    });
    router.get('/newgame-data', async (req, res) => {
        const q = req.query;
        const tagSlugs = q.tags ? q.tags.split(',') : [];
        res.send({
            images: await Images.allImagesFromDb(db, tagSlugs, q.sort, false),
            tags: await Images.getAllTags(db),
        });
    });
    router.get('/index-data', async (req, res) => {
        const ts = Time.timestamp();
        const rows = await GameStorage.getAllPublicGames(db);
        const games = [
            ...rows.sort((a, b) => {
                const finished = GameCommon.Game_isFinished(a);
                // when both have same finished state, sort by started
                if (finished === GameCommon.Game_isFinished(b)) {
                    if (finished) {
                        return b.puzzle.data.finished - a.puzzle.data.finished;
                    }
                    return b.puzzle.data.started - a.puzzle.data.started;
                }
                // otherwise, sort: unfinished, finished
                return finished ? 1 : -1;
            }).map((game) => ({
                id: game.id,
                hasReplay: GameLog.hasReplay(game),
                started: GameCommon.Game_getStartTs(game),
                finished: GameCommon.Game_getFinishTs(game),
                piecesFinished: GameCommon.Game_getFinishedPiecesCount(game),
                piecesTotal: GameCommon.Game_getPieceCount(game),
                players: GameCommon.Game_getActivePlayers(game, ts).length,
                imageUrl: GameCommon.Game_getImageUrl(game),
            })),
        ];
        res.send({
            gamesRunning: games.filter(g => !g.finished),
            gamesFinished: games.filter(g => !!g.finished),
        });
    });
    router.post('/save-image', express.json(), async (req, res) => {
        const user = await Users.getUser(db, req);
        if (!user || !user.id) {
            res.status(403).send({ ok: false, error: 'forbidden' });
            return;
        }
        const data = req.body;
        const image = await db.get('images', { id: data.id });
        if (parseInt(image.uploader_user_id, 10) !== user.id) {
            res.status(403).send({ ok: false, error: 'forbidden' });
            return;
        }
        await db.update('images', {
            title: data.title,
        }, {
            id: data.id,
        });
        await Images.setTags(db, data.id, data.tags || []);
        res.send({ ok: true });
    });
    router.get('/proxy', (req, res) => {
        log.info('proxy request for url:', req.query.url);
        request(req.query.url).pipe(res);
    });
    router.post('/upload', (req, res) => {
        upload(req, res, async (err) => {
            if (err) {
                log.log('/api/upload/', 'error', err);
                res.status(400).send("Something went wrong!");
                return;
            }
            log.info('req.file.filename', req.file.filename);
            try {
                await Images.resizeImage(req.file.filename);
            }
            catch (err) {
                log.log('/api/upload/', 'resize error', err);
                res.status(400).send("Something went wrong!");
                return;
            }
            const user = await Users.getOrCreateUser(db, req);
            const dim = await Images.getDimensions(`${config.dir.UPLOAD_DIR}/${req.file.filename}`);
            // post form, so booleans are submitted as 'true' | 'false'
            const isPrivate = req.body.private === 'false' ? 0 : 1;
            const imageId = await db.insert('images', {
                uploader_user_id: user.id,
                filename: req.file.filename,
                filename_original: req.file.originalname,
                title: req.body.title || '',
                created: new Date(),
                width: dim.w,
                height: dim.h,
                private: isPrivate,
            }, 'id');
            if (req.body.tags) {
                const tags = req.body.tags.split(',').filter((tag) => !!tag);
                await Images.setTags(db, imageId, tags);
            }
            res.send(await Images.imageFromDb(db, imageId));
        });
    });
    router.post('/newgame', express.json(), async (req, res) => {
        const user = await Users.getOrCreateUser(db, req);
        const gameId = await Game.createNewGame(db, req.body, Time.timestamp(), user.id);
        res.send({ id: gameId });
    });
    return router;
}

function createRouter(db) {
    const router = express.Router();
    const requireLoginApi = async (req, res, next) => {
        if (!req.token) {
            res.status(401).send({});
            return;
        }
        // TODO: check if user is admin
        next();
    };
    router.use(requireLoginApi);
    router.get('/games', async (req, res) => {
        const items = await db.getMany('games');
        res.send(items);
    });
    router.delete('/games/:id', async (req, res) => {
        const id = req.params.id;
        await db.delete('games', { id });
        res.send({ ok: true });
    });
    router.get('/images', async (req, res) => {
        const items = await db.getMany('images');
        res.send(items);
    });
    router.delete('/images/:id', async (req, res) => {
        const id = req.params.id;
        await db.delete('images', { id });
        res.send({ ok: true });
    });
    router.get('/users', async (req, res) => {
        const items = await db.getMany('users');
        res.send(items.map(item => {
            delete item.client_id;
            delete item.client_secret;
            delete item.pass;
            delete item.salt;
            return item;
        }));
    });
    router.get('/groups', async (req, res) => {
        const items = await db.getMany('user_groups');
        res.send(items);
    });
    return router;
}

const run = async () => {
    const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR);
    await db.connect();
    await db.patch();
    const log = logger('main.js');
    const port = config.http.port;
    const hostname = config.http.hostname;
    const app = express();
    app.use(cookieParser());
    app.use(compression());
    // add user info to all requests
    app.use(async (req, _res, next) => {
        const token = req.cookies['x-token'] || null;
        const tokenInfo = await db.get('tokens', { token, type: 'auth' });
        if (!tokenInfo) {
            req.token = null;
            req.user = null;
            next();
            return;
        }
        const user = await db.get('users', { id: tokenInfo.user_id });
        if (!user) {
            req.token = null;
            req.user = null;
            next();
            return;
        }
        req.token = tokenInfo.token;
        req.user = user;
        next();
    });
    app.use('/admin/api', createRouter(db));
    app.use('/api', createRouter$1(db));
    app.use('/uploads/', express.static(config.dir.UPLOAD_DIR));
    app.use('/', express.static(config.dir.PUBLIC_DIR));
    const wss = new WebSocketServer(config.ws);
    const notify = (data, sockets) => {
        for (const socket of sockets) {
            wss.notifyOne(data, socket);
        }
    };
    const persistGame = async (gameId) => {
        const game = GameCommon.get(gameId);
        if (!game) {
            log.error(`[ERROR] unable to persist non existing game ${gameId}`);
            return;
        }
        await GameStorage.persistGame(db, game);
    };
    const persistGames = async () => {
        for (const gameId of GameStorage.dirtyGameIds()) {
            await persistGame(gameId);
        }
    };
    wss.on('close', async ({ socket }) => {
        try {
            const proto = socket.protocol.split('|');
            const clientId = proto[0];
            const gameId = proto[1];
            GameSockets.removeSocket(gameId, socket);
            const ts = Time.timestamp();
            const clientSeq = -1; // client lost connection, so clientSeq doesn't matter
            const clientEvtData = [Protocol.INPUT_EV_CONNECTION_CLOSE];
            const changes = Game.handleInput(gameId, clientId, clientEvtData, ts);
            const sockets = GameSockets.getSockets(gameId);
            if (sockets.length) {
                notify([Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes], sockets);
            }
            else {
                persistGame(gameId);
                log.info(`[INFO] unloading game: ${gameId}`);
                GameCommon.unsetGame(gameId);
            }
        }
        catch (e) {
            log.error(e);
        }
    });
    wss.on('message', async ({ socket, data }) => {
        if (!data) {
            // no data (maybe ping :3)
            return;
        }
        try {
            const proto = socket.protocol.split('|');
            const clientId = proto[0];
            const gameId = proto[1];
            const msg = JSON.parse(data);
            const msgType = msg[0];
            switch (msgType) {
                case Protocol.EV_CLIENT_INIT:
                    {
                        if (!GameCommon.loaded(gameId)) {
                            const gameObject = await GameStorage.loadGame(db, gameId);
                            if (!gameObject) {
                                throw `[game ${gameId} does not exist... ]`;
                            }
                            GameCommon.setGame(gameObject.id, gameObject);
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
                        if (!GameCommon.loaded(gameId)) {
                            const gameObject = await GameStorage.loadGame(db, gameId);
                            if (!gameObject) {
                                throw `[game ${gameId} does not exist... ]`;
                            }
                            GameCommon.setGame(gameObject.id, gameObject);
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
            log.error('data:', data);
        }
    });
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
    let persistInterval = null;
    const doPersist = async () => {
        log.log('Persisting games...');
        await persistGames();
        memoryUsageHuman();
        persistInterval = setTimeout(doPersist, config.persistence.interval);
    };
    persistInterval = setTimeout(doPersist, config.persistence.interval);
    const gracefulShutdown = async (signal) => {
        log.log(`${signal} received...`);
        log.log('clearing persist interval...');
        clearInterval(persistInterval);
        log.log('Persisting games...');
        await persistGames();
        log.log('shutting down webserver...');
        server.close();
        log.log('shutting down websocketserver...');
        wss.close();
        log.log('shutting down...');
        process.exit();
    };
    // used by nodemon
    process.once('SIGUSR2', async () => {
        await gracefulShutdown('SIGUSR2');
    });
    process.once('SIGINT', async () => {
        await gracefulShutdown('SIGINT');
    });
    process.once('SIGTERM', async () => {
        await gracefulShutdown('SIGTERM');
    });
};
run();
