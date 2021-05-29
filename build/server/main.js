import WebSocket from 'ws';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import readline from 'readline';
import stream from 'stream';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sizeOf from 'image-size';
import exif from 'exif';
import sharp from 'sharp';
import bodyParser from 'body-parser';
import v8 from 'v8';
import bsqlite from 'better-sqlite3';

class Rng {
    constructor(seed) {
        this.rand_high = seed || 0xDEADC0DE;
        this.rand_low = seed ^ 0x49616E42;
    }
    random(min, max) {
        this.rand_high = ((this.rand_high << 16) + (this.rand_high >> 16) + this.rand_low) & 0xffffffff;
        this.rand_low = (this.rand_low + this.rand_high) & 0xffffffff;
        var n = (this.rand_high >>> 0) / 0xffffffff;
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
const uniqId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
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
function encodeTile(data) {
    return [data.idx, data.pos.x, data.pos.y, data.z, data.owner, data.group];
}
function decodeTile(data) {
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
    if (Array.isArray(data)) {
        return data;
    }
    return [
        data.id,
        data.rng.type,
        Rng.serialize(data.rng.obj),
        data.puzzle,
        data.players,
        data.evtInfos,
        data.scoreMode,
    ];
}
function decodeGame(data) {
    if (!Array.isArray(data)) {
        return data;
    }
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
    };
}
function coordByTileIdx(info, tileIdx) {
    const wTiles = info.width / info.tileSize;
    return {
        x: tileIdx % wTiles,
        y: Math.floor(tileIdx / wTiles),
    };
}
const hash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        let chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};
function asQueryArgs(data) {
    const q = [];
    for (let k in data) {
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
    encodeTile,
    decodeTile,
    encodePlayer,
    decodePlayer,
    encodeGame,
    decodeGame,
    coordByTileIdx,
    asQueryArgs,
};

const log$4 = logger('WebSocketServer.js');
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
                log$4.log('bad request url: ', request.url);
                socket.close();
                return;
            }
            socket.on('message', (data) => {
                log$4.log(`ws`, socket.protocol, data);
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
const EV_SERVER_REPLAY_DATA = 5;
const EV_CLIENT_EVENT = 2;
const EV_CLIENT_INIT = 3;
const EV_CLIENT_REPLAY_DATA = 6;
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
const CHANGE_DATA = 1;
const CHANGE_TILE = 2;
const CHANGE_PLAYER = 3;
var Protocol = {
    EV_SERVER_EVENT,
    EV_SERVER_INIT,
    EV_SERVER_REPLAY_DATA,
    EV_CLIENT_EVENT,
    EV_CLIENT_INIT,
    EV_CLIENT_REPLAY_DATA,
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
    for (let player of GAMES[gameId].players) {
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
function setTile(gameId, tileIdx, tile) {
    GAMES[gameId].puzzle.tiles[tileIdx] = Util.encodeTile(tile);
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
    return GAMES[gameId];
}
function getTileCount(gameId) {
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
function isFinished(gameId) {
    return getFinishedTileCount(gameId) === getTileCount(gameId);
}
function getFinishedTileCount(gameId) {
    let count = 0;
    for (let t of GAMES[gameId].puzzle.tiles) {
        if (Util.decodeTile(t).owner === -1) {
            count++;
        }
    }
    return count;
}
function getTilesSortedByZIndex(gameId) {
    const tiles = GAMES[gameId].puzzle.tiles.map(Util.decodeTile);
    return tiles.sort((t1, t2) => t1.z - t2.z);
}
function changePlayer(gameId, playerId, change) {
    const player = getPlayer(gameId, playerId);
    if (player === null) {
        return;
    }
    for (let k of Object.keys(change)) {
        // @ts-ignore
        player[k] = change[k];
    }
    setPlayer(gameId, playerId, player);
}
function changeData(gameId, change) {
    for (let k of Object.keys(change)) {
        // @ts-ignore
        GAMES[gameId].puzzle.data[k] = change[k];
    }
}
function changeTile(gameId, tileIdx, change) {
    for (let k of Object.keys(change)) {
        const tile = Util.decodeTile(GAMES[gameId].puzzle.tiles[tileIdx]);
        // @ts-ignore
        tile[k] = change[k];
        GAMES[gameId].puzzle.tiles[tileIdx] = Util.encodeTile(tile);
    }
}
const getTile = (gameId, tileIdx) => {
    return Util.decodeTile(GAMES[gameId].puzzle.tiles[tileIdx]);
};
const getTileGroup = (gameId, tileIdx) => {
    const tile = getTile(gameId, tileIdx);
    return tile.group;
};
const getFinalTilePos = (gameId, tileIdx) => {
    const info = GAMES[gameId].puzzle.info;
    const boardPos = {
        x: (info.table.width - info.width) / 2,
        y: (info.table.height - info.height) / 2
    };
    const srcPos = srcPosByTileIdx(gameId, tileIdx);
    return Geometry.pointAdd(boardPos, srcPos);
};
const getTilePos = (gameId, tileIdx) => {
    const tile = getTile(gameId, tileIdx);
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
const getTileBounds = (gameId, tileIdx) => {
    const s = getTileSize(gameId);
    const tile = getTile(gameId, tileIdx);
    return {
        x: tile.pos.x,
        y: tile.pos.y,
        w: s,
        h: s,
    };
};
const getTileZIndex = (gameId, tileIdx) => {
    const tile = getTile(gameId, tileIdx);
    return tile.z;
};
const getFirstOwnedTileIdx = (gameId, playerId) => {
    for (let t of GAMES[gameId].puzzle.tiles) {
        const tile = Util.decodeTile(t);
        if (tile.owner === playerId) {
            return tile.idx;
        }
    }
    return -1;
};
const getFirstOwnedTile = (gameId, playerId) => {
    const idx = getFirstOwnedTileIdx(gameId, playerId);
    return idx < 0 ? null : GAMES[gameId].puzzle.tiles[idx];
};
const getTileDrawOffset = (gameId) => {
    return GAMES[gameId].puzzle.info.tileDrawOffset;
};
const getTileDrawSize = (gameId) => {
    return GAMES[gameId].puzzle.info.tileDrawSize;
};
const getTileSize = (gameId) => {
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
const getMaxZIndexByTileIdxs = (gameId, tileIdxs) => {
    let maxZ = 0;
    for (let tileIdx of tileIdxs) {
        let tileZIndex = getTileZIndex(gameId, tileIdx);
        if (tileZIndex > maxZ) {
            maxZ = tileZIndex;
        }
    }
    return maxZ;
};
function srcPosByTileIdx(gameId, tileIdx) {
    const info = GAMES[gameId].puzzle.info;
    const c = Util.coordByTileIdx(info, tileIdx);
    const cx = c.x * info.tileSize;
    const cy = c.y * info.tileSize;
    return { x: cx, y: cy };
}
function getSurroundingTilesByIdx(gameId, tileIdx) {
    const info = GAMES[gameId].puzzle.info;
    const c = Util.coordByTileIdx(info, tileIdx);
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
const setTilesZIndex = (gameId, tileIdxs, zIndex) => {
    for (let tilesIdx of tileIdxs) {
        changeTile(gameId, tilesIdx, { z: zIndex });
    }
};
const moveTileDiff = (gameId, tileIdx, diff) => {
    const oldPos = getTilePos(gameId, tileIdx);
    const pos = Geometry.pointAdd(oldPos, diff);
    changeTile(gameId, tileIdx, { pos });
};
const moveTilesDiff = (gameId, tileIdxs, diff) => {
    const tileDrawSize = getTileDrawSize(gameId);
    const bounds = getBounds(gameId);
    const cappedDiff = diff;
    for (let tileIdx of tileIdxs) {
        const t = getTile(gameId, tileIdx);
        if (t.pos.x + diff.x < bounds.x) {
            cappedDiff.x = Math.max(bounds.x - t.pos.x, cappedDiff.x);
        }
        else if (t.pos.x + tileDrawSize + diff.x > bounds.x + bounds.w) {
            cappedDiff.x = Math.min(bounds.x + bounds.w - t.pos.x + tileDrawSize, cappedDiff.x);
        }
        if (t.pos.y + diff.y < bounds.y) {
            cappedDiff.y = Math.max(bounds.y - t.pos.y, cappedDiff.y);
        }
        else if (t.pos.y + tileDrawSize + diff.y > bounds.y + bounds.h) {
            cappedDiff.y = Math.min(bounds.y + bounds.h - t.pos.y + tileDrawSize, cappedDiff.y);
        }
    }
    for (let tileIdx of tileIdxs) {
        moveTileDiff(gameId, tileIdx, cappedDiff);
    }
};
const finishTiles = (gameId, tileIdxs) => {
    for (let tileIdx of tileIdxs) {
        changeTile(gameId, tileIdx, { owner: -1, z: 1 });
    }
};
const setTilesOwner = (gameId, tileIdxs, owner) => {
    for (let tileIdx of tileIdxs) {
        changeTile(gameId, tileIdx, { owner });
    }
};
// get all grouped tiles for a tile
function getGroupedTileIdxs(gameId, tileIdx) {
    const tiles = GAMES[gameId].puzzle.tiles;
    const tile = Util.decodeTile(tiles[tileIdx]);
    const grouped = [];
    if (tile.group) {
        for (let other of tiles) {
            const otherTile = Util.decodeTile(other);
            if (otherTile.group === tile.group) {
                grouped.push(otherTile.idx);
            }
        }
    }
    else {
        grouped.push(tile.idx);
    }
    return grouped;
}
// Returns the index of the puzzle tile with the highest z index
// that is not finished yet and that matches the position
const freeTileIdxByPos = (gameId, pos) => {
    let info = GAMES[gameId].puzzle.info;
    let tiles = GAMES[gameId].puzzle.tiles;
    let maxZ = -1;
    let tileIdx = -1;
    for (let idx = 0; idx < tiles.length; idx++) {
        const tile = Util.decodeTile(tiles[idx]);
        if (tile.owner !== 0) {
            continue;
        }
        const collisionRect = {
            x: tile.pos.x,
            y: tile.pos.y,
            w: info.tileSize,
            h: info.tileSize,
        };
        if (Geometry.pointInBounds(pos, collisionRect)) {
            if (maxZ === -1 || tile.z > maxZ) {
                maxZ = tile.z;
                tileIdx = idx;
            }
        }
    }
    return tileIdx;
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
    const g1 = getTileGroup(gameId, tileIdx1);
    const g2 = getTileGroup(gameId, tileIdx2);
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
function handleInput$1(gameId, playerId, input, ts) {
    const puzzle = GAMES[gameId].puzzle;
    const evtInfo = getEvtInfo(gameId, playerId);
    const changes = [];
    const _dataChange = () => {
        changes.push([Protocol.CHANGE_DATA, puzzle.data]);
    };
    const _tileChange = (tileIdx) => {
        changes.push([
            Protocol.CHANGE_TILE,
            Util.encodeTile(getTile(gameId, tileIdx)),
        ]);
    };
    const _tileChanges = (tileIdxs) => {
        for (const tileIdx of tileIdxs) {
            _tileChange(tileIdx);
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
    const groupTiles = (gameId, tileIdx1, tileIdx2) => {
        const tiles = GAMES[gameId].puzzle.tiles;
        const group1 = getTileGroup(gameId, tileIdx1);
        const group2 = getTileGroup(gameId, tileIdx2);
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
        changeTile(gameId, tileIdx1, { group });
        _tileChange(tileIdx1);
        changeTile(gameId, tileIdx2, { group });
        _tileChange(tileIdx2);
        // TODO: strange
        if (searchGroups.length > 0) {
            for (const t of tiles) {
                const tile = Util.decodeTile(t);
                if (searchGroups.includes(tile.group)) {
                    changeTile(gameId, tile.idx, { group });
                    _tileChange(tile.idx);
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
    else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
        const x = input[1];
        const y = input[2];
        const pos = { x, y };
        changePlayer(gameId, playerId, { d: 1, ts });
        _playerChange();
        evtInfo._last_mouse_down = pos;
        const tileIdxAtPos = freeTileIdxByPos(gameId, pos);
        if (tileIdxAtPos >= 0) {
            let maxZ = getMaxZIndex(gameId) + 1;
            changeData(gameId, { maxZ });
            _dataChange();
            const tileIdxs = getGroupedTileIdxs(gameId, tileIdxAtPos);
            setTilesZIndex(gameId, tileIdxs, getMaxZIndex(gameId));
            setTilesOwner(gameId, tileIdxs, playerId);
            _tileChanges(tileIdxs);
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
            let tileIdx = getFirstOwnedTileIdx(gameId, playerId);
            if (tileIdx >= 0) {
                // player is moving a tile (and hand)
                changePlayer(gameId, playerId, { x, y, ts });
                _playerChange();
                // check if pos is on the tile, otherwise dont move
                // (mouse could be out of table, but tile stays on it)
                const tileIdxs = getGroupedTileIdxs(gameId, tileIdx);
                let anyOk = Geometry.pointInBounds(pos, getBounds(gameId))
                    && Geometry.pointInBounds(evtInfo._last_mouse_down, getBounds(gameId));
                for (let idx of tileIdxs) {
                    const bounds = getTileBounds(gameId, idx);
                    if (Geometry.pointInBounds(pos, bounds)) {
                        anyOk = true;
                        break;
                    }
                }
                if (anyOk) {
                    const diffX = x - evtInfo._last_mouse_down.x;
                    const diffY = y - evtInfo._last_mouse_down.y;
                    const diff = { x: diffX, y: diffY };
                    moveTilesDiff(gameId, tileIdxs, diff);
                    _tileChanges(tileIdxs);
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
        let tileIdx = getFirstOwnedTileIdx(gameId, playerId);
        if (tileIdx >= 0) {
            // drop the tile(s)
            let tileIdxs = getGroupedTileIdxs(gameId, tileIdx);
            setTilesOwner(gameId, tileIdxs, 0);
            _tileChanges(tileIdxs);
            // Check if the tile was dropped near the final location
            let tilePos = getTilePos(gameId, tileIdx);
            let finalPos = getFinalTilePos(gameId, tileIdx);
            if (Geometry.pointDistance(finalPos, tilePos) < puzzle.info.snapDistance) {
                let diff = Geometry.pointSub(finalPos, tilePos);
                // Snap the tile to the final destination
                moveTilesDiff(gameId, tileIdxs, diff);
                finishTiles(gameId, tileIdxs);
                _tileChanges(tileIdxs);
                let points = getPlayerPoints(gameId, playerId);
                if (getScoreMode(gameId) === ScoreMode.FINAL) {
                    points += tileIdxs.length;
                }
                else if (getScoreMode(gameId) === ScoreMode.ANY) {
                    points += 1;
                }
                else ;
                changePlayer(gameId, playerId, { d, ts, points });
                _playerChange();
                // check if the puzzle is finished
                if (getFinishedTileCount(gameId) === getTileCount(gameId)) {
                    changeData(gameId, { finished: ts });
                    _dataChange();
                }
            }
            else {
                // Snap to other tiles
                const check = (gameId, tileIdx, otherTileIdx, off) => {
                    let info = GAMES[gameId].puzzle.info;
                    if (otherTileIdx < 0) {
                        return false;
                    }
                    if (areGrouped(gameId, tileIdx, otherTileIdx)) {
                        return false;
                    }
                    const tilePos = getTilePos(gameId, tileIdx);
                    const dstPos = Geometry.pointAdd(getTilePos(gameId, otherTileIdx), { x: off[0] * info.tileSize, y: off[1] * info.tileSize });
                    if (Geometry.pointDistance(tilePos, dstPos) < info.snapDistance) {
                        let diff = Geometry.pointSub(dstPos, tilePos);
                        let tileIdxs = getGroupedTileIdxs(gameId, tileIdx);
                        moveTilesDiff(gameId, tileIdxs, diff);
                        groupTiles(gameId, tileIdx, otherTileIdx);
                        tileIdxs = getGroupedTileIdxs(gameId, tileIdx);
                        const zIndex = getMaxZIndexByTileIdxs(gameId, tileIdxs);
                        setTilesZIndex(gameId, tileIdxs, zIndex);
                        _tileChanges(tileIdxs);
                        return true;
                    }
                    return false;
                };
                let snapped = false;
                for (let tileIdxTmp of getGroupedTileIdxs(gameId, tileIdx)) {
                    let othersIdxs = getSurroundingTilesByIdx(gameId, tileIdxTmp);
                    if (check(gameId, tileIdxTmp, othersIdxs[0], [0, 1]) // top
                        || check(gameId, tileIdxTmp, othersIdxs[1], [-1, 0]) // right
                        || check(gameId, tileIdxTmp, othersIdxs[2], [0, -1]) // bottom
                        || check(gameId, tileIdxTmp, othersIdxs[3], [1, 0]) // left
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
    __createPlayerObject,
    setGame,
    exists: exists$1,
    playerExists,
    getActivePlayers,
    getIdlePlayers,
    addPlayer: addPlayer$1,
    getFinishedTileCount,
    getTileCount,
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
    setTile,
    setPuzzleData,
    getTableWidth,
    getTableHeight,
    getPuzzle,
    getRng,
    getPuzzleWidth,
    getPuzzleHeight,
    getTilesSortedByZIndex,
    getFirstOwnedTile,
    getTileDrawOffset,
    getTileDrawSize,
    getFinalTilePos,
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

const filename = (gameId) => `${DATA_DIR}/log_${gameId}.log`;
const create = (gameId) => {
    const file = filename(gameId);
    if (!fs.existsSync(file)) {
        fs.appendFileSync(file, '');
    }
};
const exists = (gameId) => {
    const file = filename(gameId);
    return fs.existsSync(file);
};
const _log = (gameId, ...args) => {
    const file = filename(gameId);
    if (!fs.existsSync(file)) {
        return;
    }
    const str = JSON.stringify(args);
    fs.appendFileSync(file, str + "\n");
};
const get = async (gameId, offset = 0, size = 10000) => {
    const file = filename(gameId);
    if (!fs.existsSync(file)) {
        return [];
    }
    return new Promise((resolve) => {
        const instream = fs.createReadStream(file);
        const outstream = new stream.Writable();
        const rl = readline.createInterface(instream, outstream);
        const lines = [];
        let i = -1;
        rl.on('line', (line) => {
            if (!line) {
                // skip empty
                return;
            }
            i++;
            if (offset > i) {
                return;
            }
            if (offset + size <= i) {
                rl.close();
                return;
            }
            lines.push(JSON.parse(line));
        });
        rl.on('close', () => {
            resolve(lines);
        });
    });
};
var GameLog = {
    create,
    exists,
    log: _log,
    get,
};

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
    for (let [w, h] of sizes) {
        console.log(w, h, imagePath);
        await sharpImg.resize(w, h, { fit: 'contain' }).toFile(`${imageOutPath}-${w}x${h}.webp`);
    }
};
async function getExifOrientation(imagePath) {
    return new Promise((resolve, reject) => {
        new exif.ExifImage({ image: imagePath }, function (error, exifData) {
            if (error) {
                resolve(0);
            }
            else {
                resolve(exifData.image.Orientation);
            }
        });
    });
}
const getTags = (db, imageId) => {
    const query = `
select * from categories c
inner join image_x_category ixc on c.id = ixc.category_id
where ixc.image_id = ?`;
    return db._getMany(query, [imageId]);
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
    };
};
const allImagesFromDb = (db, tagSlugs, sort) => {
    const sortMap = {
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
    const images = db.getMany('images', wheresRaw, sortMap[sort]);
    return images.map(i => ({
        id: i.id,
        filename: i.filename,
        file: `${UPLOAD_DIR}/${i.filename}`,
        url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
        title: i.title,
        tags: getTags(db, i.id),
        created: i.created * 1000,
    }));
};
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
    let dimensions = sizeOf(imagePath);
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
    resizeImage,
    getDimensions,
};

// cut size of each puzzle tile in the
// final resized version of the puzzle image
const TILE_SIZE = 64;
async function createPuzzle(rng, targetTiles, image, ts) {
    const imagePath = image.file;
    const imageUrl = image.url;
    // determine puzzle information from the image dimensions
    const dim = await Images.getDimensions(imagePath);
    if (!dim.w || !dim.h) {
        throw `[ 2021-05-16 invalid dimension for path ${imagePath} ]`;
    }
    const info = determinePuzzleInfo(dim.w, dim.h, targetTiles);
    let tiles = new Array(info.tiles);
    for (let i = 0; i < tiles.length; i++) {
        tiles[i] = { idx: i };
    }
    const shapes = determinePuzzleTileShapes(rng, info);
    let positions = new Array(info.tiles);
    for (let tile of tiles) {
        const coord = Util.coordByTileIdx(info, tile.idx);
        positions[tile.idx] = {
            // instead of info.tileSize, we use info.tileDrawSize
            // to spread the tiles a bit
            x: coord.x * info.tileSize * 1.5,
            y: coord.y * info.tileSize * 1.5,
        };
    }
    const tableWidth = info.width * 3;
    const tableHeight = info.height * 3;
    const off = info.tileSize * 1.5;
    let last = {
        x: info.width - (1 * off),
        y: info.height - (2 * off),
    };
    let countX = Math.ceil(info.width / off) + 2;
    let countY = Math.ceil(info.height / off) + 2;
    let diffX = off;
    let diffY = 0;
    let index = 0;
    for (let pos of positions) {
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
    const pieces = tiles.map(tile => {
        return Util.encodeTile({
            idx: tile.idx,
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
            pos: positions[tile.idx],
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
function determinePuzzleTileShapes(rng, info) {
    const tabs = [-1, 1];
    const shapes = new Array(info.tiles);
    for (let i = 0; i < info.tiles; i++) {
        let coord = Util.coordByTileIdx(info, i);
        shapes[i] = {
            top: coord.y === 0 ? 0 : shapes[i - info.tilesX].bottom * -1,
            right: coord.x === info.tilesX - 1 ? 0 : rng.choice(tabs),
            left: coord.x === 0 ? 0 : shapes[i - 1].right * -1,
            bottom: coord.y === info.tilesY - 1 ? 0 : rng.choice(tabs),
        };
    }
    return shapes.map(Util.encodeShape);
}
const determineTilesXY = (w, h, targetTiles) => {
    const w_ = w < h ? (w * h) : (w * w);
    const h_ = w < h ? (h * h) : (w * h);
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
const determinePuzzleInfo = (w, h, targetTiles) => {
    const { tilesX, tilesY } = determineTilesXY(w, h, targetTiles);
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
const DIRTY_GAMES = {};
function setDirty(gameId) {
    DIRTY_GAMES[gameId] = true;
}
function setClean(gameId) {
    delete DIRTY_GAMES[gameId];
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
            .map(Util.decodeTile)
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
    };
    GameCommon.setGame(gameObject.id, gameObject);
}
function persistGames() {
    for (const gameId of Object.keys(DIRTY_GAMES)) {
        persistGame(gameId);
    }
}
function persistGame(gameId) {
    const game = GameCommon.get(gameId);
    if (game.id in DIRTY_GAMES) {
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

async function createGameObject(gameId, targetTiles, image, ts, scoreMode) {
    const seed = Util.hash(gameId + ' ' + ts);
    const rng = new Rng(seed);
    return {
        id: gameId,
        rng: { type: 'Rng', obj: rng },
        puzzle: await createPuzzle(rng, targetTiles, image, ts),
        players: [],
        evtInfos: {},
        scoreMode,
    };
}
async function createGame(gameId, targetTiles, image, ts, scoreMode) {
    const gameObject = await createGameObject(gameId, targetTiles, image, ts, scoreMode);
    GameLog.create(gameId);
    GameLog.log(gameId, Protocol.LOG_HEADER, 1, targetTiles, image, ts, scoreMode);
    GameCommon.setGame(gameObject.id, gameObject);
    GameStorage.setDirty(gameId);
}
function addPlayer(gameId, playerId, ts) {
    const idx = GameCommon.getPlayerIndexById(gameId, playerId);
    const diff = ts - GameCommon.getStartTs(gameId);
    if (idx === -1) {
        GameLog.log(gameId, Protocol.LOG_ADD_PLAYER, playerId, diff);
    }
    else {
        GameLog.log(gameId, Protocol.LOG_UPDATE_PLAYER, idx, diff);
    }
    GameCommon.addPlayer(gameId, playerId, ts);
    GameStorage.setDirty(gameId);
}
function handleInput(gameId, playerId, input, ts) {
    const idx = GameCommon.getPlayerIndexById(gameId, playerId);
    const diff = ts - GameCommon.getStartTs(gameId);
    GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, diff);
    const ret = GameCommon.handleInput(gameId, playerId, input, ts);
    GameStorage.setDirty(gameId);
    return ret;
}
var Game = {
    createGameObject,
    createGame,
    addPlayer,
    handleInput,
    getAllGames: GameCommon.getAllGames,
    getActivePlayers: GameCommon.getActivePlayers,
    getFinishedTileCount: GameCommon.getFinishedTileCount,
    getImageUrl: GameCommon.getImageUrl,
    getTileCount: GameCommon.getTileCount,
    exists: GameCommon.exists,
    playerExists: GameCommon.playerExists,
    get: GameCommon.get,
    getStartTs: GameCommon.getStartTs,
    getFinishTs: GameCommon.getFinishTs,
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
                        wheres.push(k + ' NOT IN (' + where[k][prop].map((_) => '?') + ')');
                        values.push(...where[k][prop]);
                    }
                    continue;
                }
                prop = '$in';
                if (where[k][prop]) {
                    if (where[k][prop].length > 0) {
                        wheres.push(k + ' IN (' + where[k][prop].map((_) => '?') + ')');
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
            + ' VALUES (' + keys.map(k => '?').join(',') + ')';
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
app.get('/api/newgame-data', (req, res) => {
    const q = req.query;
    const tagSlugs = q.tags ? q.tags.split(',') : [];
    res.send({
        images: Images.allImagesFromDb(db, tagSlugs, q.sort),
        tags: db.getMany('categories', {}, [{ title: 1 }]),
    });
});
app.get('/api/index-data', (req, res) => {
    const ts = Time.timestamp();
    const games = [
        ...Game.getAllGames().map((game) => ({
            id: game.id,
            hasReplay: GameLog.exists(game.id),
            started: Game.getStartTs(game.id),
            finished: Game.getFinishTs(game.id),
            tilesFinished: Game.getFinishedTileCount(game.id),
            tilesTotal: Game.getTileCount(game.id),
            players: Game.getActivePlayers(game.id, ts).length,
            imageUrl: Game.getImageUrl(game.id),
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
app.post('/api/save-image', bodyParser.json(), (req, res) => {
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
        const imageId = db.insert('images', {
            filename: req.file.filename,
            filename_original: req.file.originalname,
            title: req.body.title || '',
            created: Time.timestamp(),
        });
        if (req.body.tags) {
            setImageTags(db, imageId, req.body.tags);
        }
        res.send(Images.imageFromDb(db, imageId));
    });
});
app.post('/newgame', bodyParser.json(), async (req, res) => {
    const gameSettings = req.body;
    log.log(gameSettings);
    const gameId = Util.uniqId();
    if (!Game.exists(gameId)) {
        const ts = Time.timestamp();
        await Game.createGame(gameId, gameSettings.tiles, gameSettings.image, ts, gameSettings.scoreMode);
    }
    res.send({ id: gameId });
});
app.use('/uploads/', express.static(UPLOAD_DIR));
app.use('/', express.static(PUBLIC_DIR));
const wss = new WebSocketServer(config.ws);
const notify = (data, sockets) => {
    // TODO: throttle?
    for (let socket of sockets) {
        wss.notifyOne(data, socket);
    }
};
wss.on('close', async ({ socket }) => {
    try {
        const proto = socket.protocol.split('|');
        const clientId = proto[0];
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
        const msg = JSON.parse(data);
        const msgType = msg[0];
        switch (msgType) {
            case Protocol.EV_CLIENT_REPLAY_DATA:
                {
                    if (!GameLog.exists(gameId)) {
                        throw `[gamelog ${gameId} does not exist... ]`;
                    }
                    const offset = msg[1];
                    const size = msg[2];
                    const log = await GameLog.get(gameId, offset, size);
                    let game = null;
                    if (offset === 0) {
                        // also need the game
                        game = await Game.createGameObject(gameId, log[0][2], log[0][3], log[0][4], log[0][5] || ScoreMode.FINAL);
                    }
                    notify([Protocol.EV_SERVER_REPLAY_DATA, log, game ? Util.encodeGame(game) : null], [socket]);
                }
                break;
            case Protocol.EV_CLIENT_INIT:
                {
                    if (!Game.exists(gameId)) {
                        throw `[game ${gameId} does not exist... ]`;
                    }
                    const ts = Time.timestamp();
                    Game.addPlayer(gameId, clientId, ts);
                    GameSockets.addSocket(gameId, socket);
                    const game = Game.get(gameId);
                    notify([Protocol.EV_SERVER_INIT, Util.encodeGame(game)], [socket]);
                }
                break;
            case Protocol.EV_CLIENT_EVENT:
                {
                    if (!Game.exists(gameId)) {
                        throw `[game ${gameId} does not exist... ]`;
                    }
                    const clientSeq = msg[1];
                    const clientEvtData = msg[2];
                    const ts = Time.timestamp();
                    let sendGame = false;
                    if (!Game.playerExists(gameId, clientId)) {
                        Game.addPlayer(gameId, clientId, ts);
                        sendGame = true;
                    }
                    if (!GameSockets.socketExists(gameId, socket)) {
                        GameSockets.addSocket(gameId, socket);
                        sendGame = true;
                    }
                    if (sendGame) {
                        const game = Game.get(gameId);
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
    let totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2);
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
process.once('SIGUSR2', function () {
    gracefulShutdown('SIGUSR2');
});
process.once('SIGINT', function (code) {
    gracefulShutdown('SIGINT');
});
process.once('SIGTERM', function (code) {
    gracefulShutdown('SIGTERM');
});
