import v8 from 'v8';
import fs, { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { Mutex } from 'async-mutex';
import * as pg from 'pg';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import jwt from 'jsonwebtoken';
import { WebSocketServer as WebSocketServer$1 } from 'ws';
import express from 'express';
import compression from 'compression';
import multer from 'multer';
import request from 'request';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import probe from 'probe-image-size';
import exif from 'exif';
import sharp from 'sharp';

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
    return pad.substring(0, pad.length - str.length) + str;
};
const NOOP = () => { return; };
const logger = (...pre) => {
    const log = (m) => (...args) => {
        const d = new Date();
        const date = dateformat('hh:mm:ss', d);
        console[m](`${date}`, ...pre, ...args);
    };
    return {
        log: log('log'),
        error: log('error'),
        info: log('info'),
        disable: function () {
            this.info = NOOP;
            this.error = NOOP;
            this.info = NOOP;
        },
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
    return data.crop ? [
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
        data.crop,
    ] : [
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
const isEncodedGameLegacy = (data) => {
    return data.length <= 12;
};
function decodeGame(data) {
    if (isEncodedGameLegacy(data)) {
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
        crop: data[12],
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
const dateformat = (format, date) => {
    return format.replace(/(YYYY|MM|DD|hh|mm|ss|Month(?:\.(?:de|en))?)/g, (m0, m1) => {
        switch (m1) {
            case 'YYYY': return pad(date.getFullYear(), '0000');
            case 'MM': return pad(date.getMonth() + 1, '00');
            case 'DD': return pad(date.getDate(), '00');
            case 'hh': return pad(date.getHours(), '00');
            case 'mm': return pad(date.getMinutes(), '00');
            case 'ss': return pad(date.getSeconds(), '00');
            default: return m0;
        }
    });
};
var Util = {
    hash,
    slug,
    pad,
    dateformat,
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

const log$8 = logger('Config.ts');
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = dirname(__filename$1);
const BASE_DIR = `${__dirname$1}/../..`;
const DATA_DIR = `${BASE_DIR}/data`;
const UPLOAD_DIR = `${BASE_DIR}/data/uploads`;
const CROP_DIR = `${BASE_DIR}/data/uploads/c`;
const RESIZE_DIR = `${BASE_DIR}/data/uploads/r`;
const UPLOAD_URL = `/uploads`;
const PUBLIC_DIR = `${BASE_DIR}/build/public`;
const DB_PATCHES_DIR = `${BASE_DIR}/src/dbpatches`;
const init = () => {
    const configFile = process.env.APP_CONFIG || 'config.json';
    if (configFile === '') {
        log$8.error('APP_CONFIG environment variable not set or empty');
        process.exit(2);
    }
    const config = JSON.parse(String(readFileSync(configFile)));
    config.dir = { DATA_DIR, UPLOAD_DIR, UPLOAD_URL, CROP_DIR, RESIZE_DIR, PUBLIC_DIR, DB_PATCHES_DIR };
    return config;
};
const config = init();

// @ts-ignore
const { Client } = pg.default;
const log$7 = logger('Db.ts');
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
                    log$7.info(`➡ skipping already applied db patch: ${f}`);
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
                log$7.info(`✓ applied db patch: ${f}`);
            }
            catch (e) {
                log$7.error(`✖ unable to apply patch: ${f} ${e}`);
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
                for (const prop of Object.keys(where[k])) {
                    if (prop === '$nin') {
                        if (where[k][prop].length > 0) {
                            wheres.push(k + ' NOT IN (' + where[k][prop].map(() => `$${$i++}`) + ')');
                            values.push(...where[k][prop]);
                        }
                        else {
                            wheres.push('TRUE');
                        }
                        continue;
                    }
                    if (prop === '$in') {
                        if (where[k][prop].length > 0) {
                            wheres.push(k + ' IN (' + where[k][prop].map(() => `$${$i++}`) + ')');
                            values.push(...where[k][prop]);
                        }
                        else {
                            wheres.push('FALSE');
                        }
                        continue;
                    }
                    if (prop === '$gte') {
                        wheres.push(k + ` >= $${$i++}`);
                        values.push(where[k][prop]);
                        continue;
                    }
                    if (prop === '$lte') {
                        wheres.push(k + ` <= $${$i++}`);
                        values.push(where[k][prop]);
                        continue;
                    }
                    if (prop === '$gt') {
                        wheres.push(k + ` > $${$i++}`);
                        values.push(where[k][prop]);
                        continue;
                    }
                    if (prop === '$lt') {
                        wheres.push(k + ` < $${$i++}`);
                        values.push(where[k][prop]);
                        continue;
                    }
                    if (prop === '$ne') {
                        if (where[k][prop] === null) {
                            wheres.push(k + ` IS NOT NULL`);
                        }
                        else {
                            wheres.push(k + ` != $${$i++}`);
                            values.push(where[k][prop]);
                        }
                        continue;
                    }
                    // TODO: implement rest of mongo like query args ($eq, $lte, $in...)
                    throw new Error('not implemented: ' + prop + ' ' + JSON.stringify(where[k]));
                }
                continue;
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
    _buildLimit(limit) {
        const parts = [];
        // make sure we have integers, so we can safely inline the
        // values into the sql
        const limitVal = parseInt(`${limit.limit}`, 10);
        const offsetVal = parseInt(`${limit.offset}`, 10);
        if (limitVal >= 0) {
            parts.push(` LIMIT ${limitVal}`);
        }
        if (offsetVal >= 0) {
            parts.push(` OFFSET ${offsetVal}`);
        }
        return parts.join('');
    }
    async _get(query, params = []) {
        try {
            return (await this.dbh.query(query, params)).rows[0] || null;
        }
        catch (e) {
            log$7.info('_get', query, params);
            console.error(e);
            throw e;
        }
    }
    async txn(fn) {
        await this.dbh.query('BEGIN');
        try {
            const retval = await fn();
            await this.dbh.query('COMMIT');
            return retval;
        }
        catch (e) {
            await this.dbh.query('ROLLBACK');
            log$7.error(e);
            return null;
        }
    }
    async run(query, params = []) {
        try {
            return await this.dbh.query(query, params);
        }
        catch (e) {
            log$7.info('run', query, params);
            console.error(e);
            throw e;
        }
    }
    async _getMany(query, params = []) {
        try {
            return (await this.dbh.query(query, params)).rows || [];
        }
        catch (e) {
            log$7.info('_getMany', query, params);
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
    async getMany(table, whereRaw = {}, orderBy = [], limit = { offset: -1, limit: -1 }) {
        const where = this._buildWhere(whereRaw);
        const orderBySql = this._buildOrderBy(orderBy);
        const limitSql = this._buildLimit(limit);
        const sql = 'SELECT * FROM ' + table + where.sql + orderBySql + limitSql;
        return await this._getMany(sql, where.values);
    }
    async count(table, whereRaw = {}) {
        const where = this._buildWhere(whereRaw);
        const sql = 'SELECT COUNT(*)::int FROM ' + table + where.sql;
        const row = await this._get(sql, where.values);
        return row.count;
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

// @ts-ignore
const log$6 = logger('Mail.ts');
const BASE_URL = 'https://jigsaw.hyottoko.club';
const NAME = 'jigsaw.hyottoko.club';
const NOREPLY_MAIL = 'noreply@jigsaw.hyottoko.club';
const SENDER = { name: NAME, email: NOREPLY_MAIL };
class Mail {
    constructor(cfg) {
        const defaultClient = SibApiV3Sdk.ApiClient.instance;
        const apiKey = defaultClient.authentications['api-key'];
        apiKey.apiKey = cfg.sendinblue_api_key;
        this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    }
    sendPasswordResetMail(passwordReset) {
        const mail = new SibApiV3Sdk.SendSmtpEmail();
        mail.subject = "{{params.subject}}";
        mail.htmlContent = `<html><body>
      <h1>Hello {{params.username}}</h1>
      <p>To reset your password for <a href="${BASE_URL}">${NAME}</a>
      click the following link:</p>
      <p><a href="{{params.link}}">{{params.link}}</a></p>
      </body></html>`;
        mail.sender = SENDER;
        mail.to = [{
                email: passwordReset.user.email,
                name: passwordReset.user.name,
            }];
        mail.params = {
            username: passwordReset.user.name,
            subject: `Password Reset for ${NAME}`,
            link: `${BASE_URL}/#password-reset=${passwordReset.token.token}`
        };
        this.send(mail);
    }
    sendRegistrationMail(registration) {
        const mail = new SibApiV3Sdk.SendSmtpEmail();
        mail.subject = "{{params.subject}}";
        mail.htmlContent = `<html><body>
      <h1>Hello {{params.username}}</h1>
      <p>Thank you for registering an account at <a href="${BASE_URL}">${NAME}</a>.</p>
      <p>Please confirm your registration by clicking the following link:</p>
      <p><a href="{{params.link}}">{{params.link}}</a></p>
      </body></html>`;
        mail.sender = SENDER;
        mail.to = [{
                email: registration.user.email,
                name: registration.user.name,
            }];
        mail.params = {
            username: registration.user.name,
            subject: `User Registration on ${NAME}`,
            link: `${BASE_URL}/api/verify-email/${registration.token.token}`
        };
        this.send(mail);
    }
    send(mail) {
        this.apiInstance.sendTransacEmail(mail).then(function (data) {
            log$6.info({ data }, 'API called successfully');
        }, function (error) {
            log$6.error({ error });
        });
    }
}

class Canny {
    constructor(config) {
        this.config = config;
        // pass
    }
    createToken(user) {
        if (!user.email) {
            return null;
        }
        const userData = {
            email: user.email,
            id: user.id,
            name: user.name,
        };
        return jwt.sign(userData, this.config.sso_private_key, { algorithm: 'HS256' });
    }
}

class Discord {
    constructor(config) {
        this.config = config;
        // pass
    }
    async announce(message) {
        fetch(this.config.bot.url + '/announce', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "guildId": this.config.announce.guildId,
                "channelId": this.config.announce.channelId,
                "message": message,
            })
        });
    }
}

const log$5 = logger('WebSocketServer.js');
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
                log$5.log('bad request url: ', request.url);
                socket.close();
                return;
            }
            socket.on('message', (data) => {
                const strData = String(data);
                log$5.log(`ws`, socket.protocol, strData);
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

const cropUrl = (imageUrl, crop) => {
    return imageUrl
        .replace('/uploads/', '/image-service/image/')
        .replace(/\?.*/, '')
        + Util.asQueryArgs(Object.assign({}, { mode: 'cropRestrict', mw: 1920, mh: 1920 }, crop));
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

const NEWGAME_MIN_PIECES = 10;
const NEWGAME_MAX_PIECES = 5000;
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
function addPlayer(gameId, playerId, ts) {
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
    return Game_getScoreMode(GAMES[gameId]);
}
function getSnapMode(gameId) {
    return Game_getSnapMode(GAMES[gameId]);
}
function getShapeMode(gameId) {
    return Game_getShapeMode(GAMES[gameId]);
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
function handleInput(gameId, playerId, input, ts) {
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
function Game_getScoreMode(game) {
    return game.scoreMode;
}
function Game_getSnapMode(game) {
    return game.snapMode;
}
function Game_getShapeMode(game) {
    return game.shapeMode;
}
function Game_getAllPlayers(game) {
    return game.players.map(Util.decodePlayer);
}
function Game_getPlayersWithScore(game) {
    return Game_getAllPlayers(game).filter((p) => p.points > 0);
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
    const imageUrl = game.puzzle.info.image.url;
    if (!imageUrl) {
        throw new Error('[2021-07-11] no image url set');
    }
    if (game.crop) {
        return cropUrl(imageUrl, game.crop);
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
    addPlayer,
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
    getScoreMode,
    getSnapMode,
    getShapeMode,
    handleInput,
    /// operate directly on the game object given
    Game_getStartTs,
    Game_getFinishTs,
    Game_getFinishedPiecesCount,
    Game_getPieceCount,
    Game_getActivePlayers,
    Game_getPlayersWithScore,
    Game_getImageUrl,
    Game_getScoreMode,
    Game_getSnapMode,
    Game_getShapeMode,
    Game_isFinished,
};

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
const exists = (gameId) => {
    const idxfile = idxname(gameId);
    return fs.existsSync(idxfile);
};
function hasReplay(game) {
    if (!exists(game.id)) {
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
    const timestampIdx = type === Protocol.LOG_HEADER ? 3 : (args.length - 1);
    const ts = args[timestampIdx];
    if (type !== Protocol.LOG_HEADER) {
        // for everything but header save the diff to last log entry
        args[timestampIdx] = ts - idxObj.lastTs;
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
        log[0][10] = log[0][10] || undefined; // crop
    }
    return log;
};
var GameLog = {
    shouldLog,
    create,
    exists,
    hasReplay,
    log: _log,
    get,
    filename,
    idxname,
};

const COOKIE_TOKEN = 'x-token';
const passwordHash = (plainPass, salt) => {
    const hash = crypto.createHmac('sha512', config.secret);
    hash.update(`${salt}${plainPass}`);
    return hash.digest('hex');
};
// do something CRYPTO secure???
const generateSalt = () => {
    return randomString(10);
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

const log$4 = logger('web_routes/api/index.ts');
const GAMES_PER_PAGE_LIMIT = 10;
const IMAGES_PER_PAGE_LIMIT = 20;
function createRouter$2(server) {
    const addAuthToken = async (userId, res) => {
        const token = await server.getUsers().addAuthToken(userId);
        res.cookie(COOKIE_TOKEN, token, { maxAge: 356 * Time.DAY, httpOnly: true });
    };
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
            const groups = await server.getUsers().getGroups(req.user.id);
            res.send({
                id: req.user.id,
                name: req.user.name,
                clientId: req.user.client_id,
                created: req.user.created,
                type: req.user_type,
                cannyToken: server.getCanny().createToken(req.user),
                groups: groups.map(g => g.name),
            });
            return;
        }
        res.status(401).send({ reason: 'no user' });
        return;
    });
    // login via twitch (callback url called from twitch after authentication)
    router.get('/auth/twitch/redirect_uri', async (req, res) => {
        if (!req.query.code) {
            // in error case:
            // http://localhost:3000/
            // ?error=access_denied
            // &error_description=The+user+denied+you+access
            // &state=c3ab8aa609ea11e793ae92361f002671
            res.status(403).send({ reason: req.query });
            return;
        }
        // in success case:
        // http://localhost:3000/
        // ?code=gulfwdmys5lsm6qyz4xiz9q32l10
        // &scope=channel%3Amanage%3Apolls+channel%3Aread%3Apolls
        // &state=c3ab8aa609ea11e793ae92361f002671
        const body = {
            client_id: config.auth.twitch.client_id,
            client_secret: config.auth.twitch.client_secret,
            code: req.query.code,
            grant_type: 'authorization_code',
            redirect_uri: ''
        };
        const redirectUris = [
            `https://${config.http.public_hostname}/api/auth/twitch/redirect_uri`,
            `${req.protocol}://${req.headers.host}/api/auth/twitch/redirect_uri`,
        ];
        for (const redirectUri of redirectUris) {
            body.redirect_uri = redirectUri;
            const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token${Util.asQueryArgs(body)}`, {
                method: 'POST',
            });
            if (!tokenRes.ok) {
                continue;
            }
            const tokenData = await tokenRes.json();
            // get user
            const userRes = await fetch(`https://api.twitch.tv/helix/users`, {
                headers: {
                    'Client-ID': config.auth.twitch.client_id,
                    'Authorization': `Bearer ${tokenData.access_token}`,
                }
            });
            if (!userRes.ok) {
                continue;
            }
            const userData = await userRes.json();
            const identity = await server.getUsers().getIdentity({
                provider_name: 'twitch',
                provider_id: userData.data[0].id,
            });
            let user = null;
            if (req.user) {
                user = req.user;
            }
            else if (identity) {
                user = await server.getUsers().getUserByIdentity(identity);
            }
            if (!user) {
                user = await server.getUsers().createUser({
                    name: userData.data[0].display_name,
                    created: new Date(),
                    client_id: uniqId(),
                    email: userData.data[0].email,
                });
            }
            else {
                let updateNeeded = false;
                if (!user.name) {
                    user.name = userData.data[0].display_name;
                    updateNeeded = true;
                }
                if (!user.email) {
                    user.email = userData.data[0].email;
                    updateNeeded = true;
                }
                if (updateNeeded) {
                    await server.getUsers().updateUser(user);
                }
            }
            if (!identity) {
                server.getUsers().createIdentity({
                    user_id: user.id,
                    provider_name: 'twitch',
                    provider_id: userData.data[0].id,
                });
            }
            else {
                let updateNeeded = false;
                if (identity.user_id !== user.id) {
                    // maybe we do not have to do this
                    identity.user_id = user.id;
                    updateNeeded = true;
                }
                if (!identity.provider_email) {
                    identity.provider_email = userData.data[0].email;
                    updateNeeded = true;
                }
                if (updateNeeded) {
                    server.getUsers().updateIdentity(identity);
                }
            }
            await addAuthToken(user.id, res);
            res.send('<html><script>window.opener.handleAuthCallback();window.close();</script></html>');
            return;
        }
        res.status(403).send({ reason: req.query });
    });
    // login via email + password
    router.post('/auth/local', express.json(), async (req, res) => {
        const emailPlain = req.body.email;
        const passwordPlain = req.body.password;
        const account = await server.getUsers().getAccount({ email: emailPlain });
        if (!account) {
            res.status(401).send({ reason: 'bad email' });
            return;
        }
        if (account.status !== 'verified') {
            res.status(401).send({ reason: 'email not verified' });
            return;
        }
        const salt = account.salt;
        const passHashed = passwordHash(passwordPlain, salt);
        if (account.password !== passHashed) {
            res.status(401).send({ reason: 'bad password' });
            return;
        }
        const identity = await server.getUsers().getIdentity({
            provider_name: 'local',
            provider_id: account.id,
        });
        if (!identity) {
            res.status(401).send({ reason: 'no identity' });
            return;
        }
        await addAuthToken(identity.user_id, res);
        res.send({ success: true });
    });
    router.post('/change-password', express.json(), async (req, res) => {
        const token = `${req.body.token}`;
        const passwordRaw = `${req.body.password}`;
        const tokenRow = await server.getTokensRepo().get({ type: 'password-reset', token });
        if (!tokenRow) {
            res.status(400).send({ reason: 'no such token' });
            return;
        }
        // note: token contains account id, not user id ...
        const account = await server.getUsers().getAccount({ id: tokenRow.user_id });
        if (!account) {
            res.status(400).send({ reason: 'no such account' });
            return;
        }
        const password = passwordHash(passwordRaw, account.salt);
        account.password = password;
        await server.getUsers().updateAccount(account);
        // remove token, already used
        await server.getTokensRepo().delete(tokenRow);
        res.send({ success: true });
    });
    router.post('/send-password-reset-email', express.json(), async (req, res) => {
        const emailRaw = `${req.body.email}`;
        const account = await server.getUsers().getAccount({ email: emailRaw });
        if (!account) {
            res.status(400).send({ reason: 'no such email' });
            return;
        }
        const identity = await server.getUsers().getIdentity({
            provider_name: 'local',
            provider_id: account.id,
        });
        if (!identity) {
            res.status(400).send({ reason: 'no such identity' });
            return;
        }
        const user = await server.getUsers().getUser({
            id: identity.user_id,
        });
        if (!user) {
            res.status(400).send({ reason: 'no such user' });
            return;
        }
        const token = generateToken();
        // TODO: dont misuse token table user id <> account id
        const tokenRow = { user_id: account.id, token, type: 'password-reset' };
        await server.getTokensRepo().insert(tokenRow);
        server.getMail().sendPasswordResetMail({ user: { name: user.name, email: emailRaw }, token: tokenRow });
        res.send({ success: true });
    });
    router.post('/register', express.json(), async (req, res) => {
        const salt = generateSalt();
        const emailRaw = `${req.body.email}`;
        const passwordRaw = `${req.body.password}`;
        const usernameRaw = `${req.body.username}`;
        // TODO: check if username already taken
        // TODO: check if email already taken
        //       return status 409 in both cases
        const account = await server.getUsers().createAccount({
            created: new Date(),
            email: emailRaw,
            password: passwordHash(passwordRaw, salt),
            salt: salt,
            status: 'verification_pending',
        });
        const user = await server.getUsers().createUser({
            created: new Date(),
            name: usernameRaw,
            email: emailRaw,
            client_id: uniqId(),
        });
        await server.getUsers().createIdentity({
            user_id: user.id,
            provider_name: 'local',
            provider_id: account.id,
        });
        const userInfo = { email: emailRaw, name: usernameRaw };
        const token = generateToken();
        const tokenRow = { user_id: account.id, token, type: 'registration' };
        await server.getTokensRepo().insert(tokenRow);
        server.getMail().sendRegistrationMail({ user: userInfo, token: tokenRow });
        res.send({ success: true });
    });
    router.get('/verify-email/:token', async (req, res) => {
        const token = req.params.token;
        const tokenRow = await server.getTokensRepo().get({ token });
        if (!tokenRow) {
            res.status(400).send({ reason: 'bad token' });
            return;
        }
        // tokenRow.user_id is the account id here.
        // TODO: clean this up.. users vs accounts vs user_identity
        const account = await server.getUsers().getAccount({ id: tokenRow.user_id });
        if (!account) {
            res.status(400).send({ reason: 'bad account' });
            return;
        }
        const identity = await server.getUsers().getIdentity({
            provider_name: 'local',
            provider_id: account.id,
        });
        if (!identity) {
            res.status(400).send({ reason: 'bad identity' });
            return;
        }
        // set account to verified
        await server.getUsers().setAccountVerified(account.id);
        // make the user logged in and redirect to startpage
        await addAuthToken(identity.user_id, res);
        // TODO: add parameter/hash so that user will get a message 'thanks for verifying the email'
        res.redirect(302, '/');
    });
    router.post('/logout', async (req, res) => {
        if (!req.token) {
            res.status(401).send({});
            return;
        }
        await server.getTokensRepo().delete({ token: req.token });
        res.clearCookie(COOKIE_TOKEN);
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
            game = await server.getGameService().createGameObject(gameId, log[0][1], // gameVersion
            log[0][2], // targetPieceCount
            log[0][3], // must be ImageInfo
            log[0][4], // ts (of game creation)
            log[0][5], // scoreMode
            log[0][6], // shapeMode
            log[0][7], // snapMode
            log[0][8], // creatorUserId
            true, // hasReplay
            !!log[0][9], // private
            log[0][10]);
        }
        res.send({ log, game: game ? Util.encodeGame(game) : null });
    });
    router.get('/newgame-data', async (req, res) => {
        const requestData = req.query;
        res.send({
            images: await server.getImages().imagesFromDb(requestData.search, requestData.sort, false, 0, IMAGES_PER_PAGE_LIMIT),
            tags: await server.getImages().getAllTags(),
        });
    });
    router.get('/artist/:name', async (req, res) => {
        const name = req.params.name;
        const artist = await server.getDb().get('artist', { name });
        if (!artist) {
            res.status(404).send({ reason: 'not found' });
            return;
        }
        const rel1 = await server.getDb().getMany('artist_x_collection', { artist_id: artist.id });
        const collections = await server.getDb().getMany('collection', { id: { '$in': rel1.map((r) => r.collection_id) } });
        const rel2 = await server.getDb().getMany('collection_x_image', { collection_id: { '$in': collections.map((r) => r.id) } });
        const items = await server.getImages().imagesByIdsFromDb(rel2.map((r) => r.image_id));
        collections.forEach(c => {
            c.images = items.filter(image => rel2.find(r => r.collection_id === c.id && r.image_id === image.id) ? true : false);
        });
        res.send({
            artist,
            collections,
        });
    });
    router.get('/images', async (req, res) => {
        const requestData = req.query;
        const offset = parseInt(`${requestData.offset}`, 10);
        if (isNaN(offset) || offset < 0) {
            res.status(400).send({ error: 'bad offset' });
            return;
        }
        res.send({
            images: await server.getImages().imagesFromDb(requestData.search, requestData.sort, false, offset, IMAGES_PER_PAGE_LIMIT),
        });
    });
    const GameToGameInfo = (game, ts) => {
        const finished = GameCommon.Game_getFinishTs(game);
        return {
            id: game.id,
            hasReplay: GameLog.hasReplay(game),
            started: GameCommon.Game_getStartTs(game),
            finished,
            piecesFinished: GameCommon.Game_getFinishedPiecesCount(game),
            piecesTotal: GameCommon.Game_getPieceCount(game),
            players: finished
                ? GameCommon.Game_getPlayersWithScore(game).length
                : GameCommon.Game_getActivePlayers(game, ts).length,
            imageUrl: GameCommon.Game_getImageUrl(game),
            snapMode: GameCommon.Game_getSnapMode(game),
            scoreMode: GameCommon.Game_getScoreMode(game),
            shapeMode: GameCommon.Game_getShapeMode(game),
        };
    };
    router.get('/index-data', async (req, res) => {
        const ts = Time.timestamp();
        // all running rows
        const runningRows = await server.getGameService().getPublicRunningGames(-1, -1);
        const runningCount = await server.getGameService().countPublicRunningGames();
        const finishedRows = await server.getGameService().getPublicFinishedGames(0, GAMES_PER_PAGE_LIMIT);
        const finishedCount = await server.getGameService().countPublicFinishedGames();
        const gamesRunning = runningRows.map((v) => GameToGameInfo(v, ts));
        const gamesFinished = finishedRows.map((v) => GameToGameInfo(v, ts));
        const user = req.user || null;
        const userId = user && req.user_type === 'user' ? user.id : 0;
        const leaderboards = await server.getLeaderboardRepo().getTop10(userId);
        const indexData = {
            gamesRunning: {
                items: gamesRunning,
                pagination: { total: runningCount, offset: 0, limit: 0 }
            },
            gamesFinished: {
                items: gamesFinished,
                pagination: { total: finishedCount, offset: 0, limit: GAMES_PER_PAGE_LIMIT }
            },
            leaderboards,
        };
        res.send(indexData);
    });
    router.get('/finished-games', async (req, res) => {
        const offset = parseInt(`${req.query.offset}`, 10);
        if (isNaN(offset) || offset < 0) {
            res.status(400).send({ error: 'bad offset' });
            return;
        }
        const ts = Time.timestamp();
        const finishedRows = await server.getGameService().getPublicFinishedGames(offset, GAMES_PER_PAGE_LIMIT);
        const finishedCount = await server.getGameService().countPublicFinishedGames();
        const gamesFinished = finishedRows.map((v) => GameToGameInfo(v, ts));
        const indexData = {
            items: gamesFinished,
            pagination: { total: finishedCount, offset: offset, limit: GAMES_PER_PAGE_LIMIT }
        };
        res.send(indexData);
    });
    router.post('/save-image', express.json(), async (req, res) => {
        const user = req.user || null;
        if (!user || !user.id) {
            res.status(403).send({ ok: false, error: 'forbidden' });
            return;
        }
        const data = req.body;
        const image = await server.getImages().getImageById(data.id);
        if (!image) {
            res.status(404).send({ ok: false, error: 'not_found' });
            return;
        }
        if (image.uploader_user_id !== user.id) {
            res.status(403).send({ ok: false, error: 'forbidden' });
            return;
        }
        await server.getImages().updateImage({
            title: data.title,
            copyright_name: data.copyrightName,
            copyright_url: data.copyrightURL,
        }, { id: data.id });
        await server.getImages().setTags(data.id, data.tags || []);
        res.send({ ok: true, image: await server.getImages().imageFromDb(data.id) });
    });
    router.get('/proxy', (req, res) => {
        log$4.info('proxy request for url:', req.query.url);
        request(req.query.url).pipe(res);
    });
    router.post('/upload', (req, res) => {
        upload(req, res, async (err) => {
            if (err) {
                log$4.log('/api/upload/', 'error', err);
                res.status(400).send("Something went wrong!");
                return;
            }
            log$4.info('req.file.filename', req.file.filename);
            const user = await server.getUsers().getOrCreateUserByRequest(req);
            const dim = await server.getImages().getDimensions(`${config.dir.UPLOAD_DIR}/${req.file.filename}`);
            // post form, so booleans are submitted as 'true' | 'false'
            const isPrivate = req.body.private === 'false' ? 0 : 1;
            const imageId = await server.getImages().insertImage({
                uploader_user_id: user.id,
                filename: req.file.filename,
                filename_original: req.file.originalname,
                title: req.body.title || '',
                copyright_name: req.body.copyrightName || '',
                copyright_url: req.body.copyrightURL || '',
                created: new Date(),
                width: dim.w,
                height: dim.h,
                private: isPrivate,
            });
            if (req.body.tags) {
                const tags = req.body.tags.split(',').filter((tag) => !!tag);
                await server.getImages().setTags(imageId, tags);
            }
            res.send(await server.getImages().imageFromDb(imageId));
        });
    });
    router.get('/announcements', async (req, res) => {
        const items = await server.getAnnouncementsRepo().getAll();
        res.send(items);
    });
    router.post('/newgame', express.json(), async (req, res) => {
        const user = await server.getUsers().getOrCreateUserByRequest(req);
        try {
            const gameId = await server.getGameService().createNewGame(req.body, Time.timestamp(), user.id);
            res.send({ id: gameId });
        }
        catch (e) {
            log$4.error(e);
            res.status(400).send({ reason: e.message });
        }
    });
    return router;
}

function createRouter$1(server) {
    const router = express.Router();
    const requireLoginApi = async (req, res, next) => {
        if (!req.token) {
            res.status(401).send({});
            return;
        }
        const user = req.user || null;
        if (!user || !user.id) {
            res.status(403).send({ ok: false, error: 'forbidden' });
            return;
        }
        const adminGroup = await server.getDb().get('user_groups', { name: 'admin' });
        if (!adminGroup) {
            res.status(403).send({ ok: false, error: 'no admin' });
            return;
        }
        const userXAdmin = await server.getDb().get('user_x_user_group', {
            user_group_id: adminGroup.id,
            user_id: user.id,
        });
        if (!userXAdmin) {
            res.status(403).send({ ok: false, error: 'not an admin' });
            return;
        }
        next();
    };
    router.use(requireLoginApi);
    router.get('/games', async (req, res) => {
        const items = await server.getDb().getMany('games', undefined, [{ created: -1 }]);
        const imageIdMap = {};
        items.forEach(game => {
            imageIdMap[game.image_id] = true;
        });
        const imageIds = Object.keys(imageIdMap);
        const images = await server.getDb().getMany('images', { id: { '$in': imageIds } });
        const gamesWithImages = items.map(game => {
            game.image = images.find(image => image.id === game.image_id) || null;
            return game;
        });
        res.send(gamesWithImages);
    });
    router.delete('/games/:id', async (req, res) => {
        const id = req.params.id;
        await server.getDb().delete('games', { id });
        res.send({ ok: true });
    });
    router.get('/images', async (req, res) => {
        const items = await server.getDb().getMany('images', undefined, [{ id: -1 }]);
        res.send(items);
    });
    router.delete('/images/:id', async (req, res) => {
        const id = req.params.id;
        await server.getDb().delete('images', { id });
        res.send({ ok: true });
    });
    router.get('/users', async (req, res) => {
        const items = await server.getDb().getMany('users', undefined, [{ id: -1 }]);
        res.send(items);
    });
    router.get('/groups', async (req, res) => {
        const items = await server.getDb().getMany('user_groups', undefined, [{ id: -1 }]);
        res.send(items);
    });
    router.get('/announcements', async (req, res) => {
        const items = await server.getAnnouncementsRepo().getAll();
        res.send(items);
    });
    router.post('/announcements', express.json(), async (req, res) => {
        const message = req.body.message;
        const title = req.body.title;
        const id = await server.getAnnouncementsRepo().insert({ created: new Date(), title, message });
        const announcement = await server.getAnnouncementsRepo().get({ id });
        if (!announcement) {
            res.status(500).send({ ok: false, reason: 'unable_to_get_announcement' });
            return;
        }
        await server.getDiscord().announce(`**${title}**\n${announcement.message}`);
        res.send({ announcement });
    });
    return router;
}

function createRouter(server) {
    const router = express.Router();
    router.get('/image/:filename', async (req, res) => {
        const filename = req.params.filename;
        const query = req.query;
        if (!query.mode) {
            res.status(400).send('invalid mode');
        }
        // RESIZE
        if (query.mode === 'resize') {
            const w = parseInt(`${query.w}`, 10);
            const h = parseInt(`${query.h}`, 10);
            const fit = `${query.fit}`;
            if (`${w}` !== query.w || `${h}` !== query.h) {
                res.status(400).send('x, y must be numbers');
                return;
            }
            const resizedFilename = await server.getImageResize().resizeImage(filename, w, h, fit);
            if (!resizedFilename) {
                res.status(500).send('unable to resize image');
                return;
            }
            const p = path.resolve(config.dir.RESIZE_DIR, resizedFilename);
            res.sendFile(p);
            return;
        }
        // RESTRICT SIZE
        if (query.mode === 'restrict') {
            const w = parseInt(`${query.w}`, 10);
            const h = parseInt(`${query.h}`, 10);
            if (`${w}` !== query.w ||
                `${h}` !== query.h) {
                res.status(400).send('w and h must be numbers');
                return;
            }
            const croppedFilename = await server.getImageResize().restrictImage(filename, w, h);
            if (!croppedFilename) {
                res.status(500).send('unable to restrict size image');
                return;
            }
            const p = path.resolve(config.dir.CROP_DIR, croppedFilename);
            res.sendFile(p);
            return;
        }
        // CROP with max WIDTH/HEIGHT
        if (query.mode === 'cropRestrict') {
            const crop = {
                x: parseInt(`${query.x}`, 10),
                y: parseInt(`${query.y}`, 10),
                w: parseInt(`${query.w}`, 10),
                h: parseInt(`${query.h}`, 10),
                mw: parseInt(`${query.mw}`, 10),
                mh: parseInt(`${query.mh}`, 10),
            };
            if (`${crop.x}` !== query.x ||
                `${crop.y}` !== query.y ||
                `${crop.w}` !== query.w ||
                `${crop.h}` !== query.h ||
                `${crop.mw}` !== query.mw ||
                `${crop.mh}` !== query.mh) {
                res.status(400).send('x, y, w and h must be numbers');
                return;
            }
            const croppedFilename = await server.getImageResize().cropRestrictImage(filename, crop, 1920, 1920);
            if (!croppedFilename) {
                res.status(500).send('unable to crop restrict image');
                return;
            }
            const p = path.resolve(config.dir.CROP_DIR, croppedFilename);
            res.sendFile(p);
            return;
        }
        // CROP
        if (query.mode === 'crop') {
            const crop = {
                x: parseInt(`${query.x}`, 10),
                y: parseInt(`${query.y}`, 10),
                w: parseInt(`${query.w}`, 10),
                h: parseInt(`${query.h}`, 10),
            };
            if (`${crop.x}` !== query.x ||
                `${crop.y}` !== query.y ||
                `${crop.w}` !== query.w ||
                `${crop.h}` !== query.h) {
                res.status(400).send('x, y, w and h must be numbers');
                return;
            }
            const croppedFilename = await server.getImageResize().cropImage(filename, crop);
            if (!croppedFilename) {
                res.status(500).send('unable to crop image');
                return;
            }
            const p = path.resolve(config.dir.CROP_DIR, croppedFilename);
            res.sendFile(p);
            return;
        }
        // original image
        const p = path.resolve(config.dir.UPLOAD_DIR, filename);
        res.sendFile(p);
        return;
    });
    return router;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexFile = path.resolve(__dirname, '..', '..', 'build', 'public', 'index.html');
const log$3 = logger('Server.ts');
class Server {
    constructor(db, mail, canny, discord, gameSockets, gameService, users, images, imageResize, tokensRepo, announcementsRepo, leaderboardRepo) {
        this.db = db;
        this.mail = mail;
        this.canny = canny;
        this.discord = discord;
        this.gameSockets = gameSockets;
        this.gameService = gameService;
        this.users = users;
        this.images = images;
        this.imageResize = imageResize;
        this.tokensRepo = tokensRepo;
        this.announcementsRepo = announcementsRepo;
        this.leaderboardRepo = leaderboardRepo;
        this.webserver = null;
        this.websocketserver = null;
        // pass
    }
    getDb() {
        return this.db;
    }
    getMail() {
        return this.mail;
    }
    getCanny() {
        return this.canny;
    }
    getDiscord() {
        return this.discord;
    }
    getGameSockets() {
        return this.gameSockets;
    }
    getGameService() {
        return this.gameService;
    }
    getUsers() {
        return this.users;
    }
    getImages() {
        return this.images;
    }
    getImageResize() {
        return this.imageResize;
    }
    getTokensRepo() {
        return this.tokensRepo;
    }
    getAnnouncementsRepo() {
        return this.announcementsRepo;
    }
    getLeaderboardRepo() {
        return this.leaderboardRepo;
    }
    async persistGame(gameId) {
        const game = GameCommon.get(gameId);
        if (!game) {
            log$3.error(`[ERROR] unable to persist non existing game ${gameId}`);
            return;
        }
        await this.gameService.persistGame(game);
    }
    async persistGames() {
        for (const gameId of this.gameService.dirtyGameIds()) {
            await this.persistGame(gameId);
        }
    }
    start() {
        const port = config.http.port;
        const hostname = config.http.hostname;
        const app = express();
        app.use(cookieParser());
        app.use(compression());
        // add user info to all requests
        app.use(async (req, _res, next) => {
            const data = await this.users.getUserInfoByRequest(req);
            req.token = data.token;
            req.user = data.user;
            req.user_type = data.user_type;
            next();
        });
        app.use('/admin/api', createRouter$1(this));
        app.use('/api', createRouter$2(this));
        app.use('/image-service', createRouter(this));
        app.use('/uploads/', express.static(config.dir.UPLOAD_DIR));
        app.use('/', express.static(config.dir.PUBLIC_DIR));
        app.all('*', async (req, res) => {
            res.sendFile(indexFile);
        });
        const wss = new WebSocketServer(config.ws);
        const notify = (data, sockets) => {
            for (const socket of sockets) {
                wss.notifyOne(data, socket);
            }
        };
        wss.on('close', async ({ socket }) => {
            try {
                const proto = socket.protocol.split('|');
                const clientId = proto[0];
                const gameId = proto[1];
                this.gameSockets.removeSocket(gameId, socket);
                const ts = Time.timestamp();
                const clientSeq = -1; // client lost connection, so clientSeq doesn't matter
                const clientEvtData = [Protocol.INPUT_EV_CONNECTION_CLOSE];
                const changes = await this.gameService.handleInput(gameId, clientId, clientEvtData, ts);
                const sockets = this.gameSockets.getSockets(gameId);
                if (sockets.length) {
                    notify([Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes], sockets);
                }
                else {
                    this.persistGame(gameId);
                    log$3.info(`[INFO] unloading game: ${gameId}`);
                    GameCommon.unsetGame(gameId);
                }
            }
            catch (e) {
                log$3.error(e);
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
                                const gameObject = await this.gameService.loadGame(gameId);
                                if (!gameObject) {
                                    throw `[game ${gameId} does not exist... ]`;
                                }
                                GameCommon.setGame(gameObject.id, gameObject);
                            }
                            const ts = Time.timestamp();
                            this.gameService.addPlayer(gameId, clientId, ts);
                            this.gameSockets.addSocket(gameId, socket);
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
                                const gameObject = await this.gameService.loadGame(gameId);
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
                                this.gameService.addPlayer(gameId, clientId, ts);
                                sendGame = true;
                            }
                            if (!this.gameSockets.socketExists(gameId, socket)) {
                                this.gameSockets.addSocket(gameId, socket);
                                sendGame = true;
                            }
                            if (sendGame) {
                                const game = GameCommon.get(gameId);
                                if (!game) {
                                    throw `[game ${gameId} does not exist (anymore)... ]`;
                                }
                                notify([Protocol.EV_SERVER_INIT, Util.encodeGame(game)], [socket]);
                            }
                            const changes = await this.gameService.handleInput(gameId, clientId, clientEvtData, ts);
                            notify([Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes], this.gameSockets.getSockets(gameId));
                        }
                        break;
                }
            }
            catch (e) {
                log$3.error(e);
                log$3.error('data:', data);
            }
        });
        this.webserver = app.listen(port, hostname, () => log$3.log(`server running on http://${hostname}:${port}`));
        wss.listen();
        this.websocketserver = wss;
    }
    close() {
        log$3.log('shutting down webserver...');
        if (this.webserver) {
            this.webserver.close();
            this.webserver = null;
        }
        log$3.log('shutting down websocketserver...');
        if (this.websocketserver) {
            this.websocketserver.close();
            this.websocketserver = null;
        }
    }
}

const log$2 = logger('GameSocket.js');
class GameSockets {
    constructor() {
        this.sockets = {};
    }
    socketExists(gameId, socket) {
        if (!(gameId in this.sockets)) {
            return false;
        }
        return this.sockets[gameId].includes(socket);
    }
    removeSocket(gameId, socket) {
        if (!(gameId in this.sockets)) {
            return;
        }
        this.sockets[gameId] = this.sockets[gameId].filter((s) => s !== socket);
        log$2.log('removed socket: ', gameId, socket.protocol);
        log$2.log('socket count: ', Object.keys(this.sockets[gameId]).length);
    }
    addSocket(gameId, socket) {
        if (!(gameId in this.sockets)) {
            this.sockets[gameId] = [];
        }
        if (!this.sockets[gameId].includes(socket)) {
            this.sockets[gameId].push(socket);
            log$2.log('added socket: ', gameId, socket.protocol);
            log$2.log('socket count: ', Object.keys(this.sockets[gameId]).length);
        }
    }
    getSockets(gameId) {
        if (!(gameId in this.sockets)) {
            return [];
        }
        return this.sockets[gameId];
    }
}

const log$1 = logger('GameService.js');
class GameService {
    constructor(repo, puzzleService, leaderboardRepo) {
        this.repo = repo;
        this.puzzleService = puzzleService;
        this.leaderboardRepo = leaderboardRepo;
        this.dirtyGames = {};
        // pass
    }
    setDirty(gameId) {
        this.dirtyGames[gameId] = true;
    }
    setClean(gameId) {
        if (gameId in this.dirtyGames) {
            delete this.dirtyGames[gameId];
        }
    }
    gameRowToGameObject(gameRow) {
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
        const gameObject = this.storeDataToGame(game, gameRow.creator_user_id, !!gameRow.private);
        gameObject.hasReplay = GameLog.hasReplay(gameObject);
        gameObject.crop = game.crop;
        return gameObject;
    }
    async loadGame(gameId) {
        log$1.info(`[INFO] loading game: ${gameId}`);
        const gameRow = await this.repo.getGameRowById(gameId);
        if (!gameRow) {
            log$1.info(`[INFO] game not found: ${gameId}`);
            return null;
        }
        const gameObject = this.gameRowToGameObject(gameRow);
        if (!gameObject) {
            log$1.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
            return null;
        }
        return gameObject;
    }
    gameRowsToGames(gameRows) {
        const games = [];
        for (const gameRow of gameRows) {
            const gameObject = this.gameRowToGameObject(gameRow);
            if (!gameObject) {
                log$1.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
                continue;
            }
            games.push(gameObject);
        }
        return games;
    }
    async getPublicRunningGames(offset, limit) {
        const rows = await this.repo.getPublicRunningGames(offset, limit);
        return this.gameRowsToGames(rows);
    }
    async getPublicFinishedGames(offset, limit) {
        const rows = await this.repo.getPublicFinishedGames(offset, limit);
        return this.gameRowsToGames(rows);
    }
    async countPublicRunningGames() {
        return await this.repo.countPublicRunningGames();
    }
    async countPublicFinishedGames() {
        return await this.repo.countPublicFinishedGames();
    }
    async exists(gameId) {
        return await this.repo.exists(gameId);
    }
    dirtyGameIds() {
        return Object.keys(this.dirtyGames);
    }
    async persistGame(game) {
        this.setClean(game.id);
        await this.repo.upsert({
            id: game.id,
            creator_user_id: game.creatorUserId,
            image_id: game.puzzle.info.image.id,
            created: new Date(game.puzzle.data.started),
            finished: game.puzzle.data.finished ? new Date(game.puzzle.data.finished) : null,
            data: JSON.stringify(this.gameToStoreData(game)),
            private: game.private ? 1 : 0,
            pieces_count: game.puzzle.tiles.length,
        }, {
            id: game.id,
        });
        await this.repo.updatePlayerRelations(game.id, game.players);
        game.players;
        log$1.info(`[INFO] persisted game ${game.id}`);
    }
    storeDataToGame(storeData, creatorUserId, isPrivate) {
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
    gameToStoreData(game) {
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
            crop: game.crop,
        };
    }
    async createGameObject(gameId, gameVersion, targetPieceCount, image, ts, scoreMode, shapeMode, snapMode, creatorUserId, hasReplay, isPrivate, crop) {
        const seed = Util.hash(gameId + ' ' + ts);
        const rng = new Rng(seed);
        return {
            id: gameId,
            gameVersion: gameVersion,
            creatorUserId,
            rng: { type: 'Rng', obj: rng },
            puzzle: await this.puzzleService.createPuzzle(rng, targetPieceCount, image, ts, shapeMode, gameVersion),
            players: [],
            scoreMode,
            shapeMode,
            snapMode,
            hasReplay,
            private: isPrivate,
            crop,
        };
    }
    async createNewGame(gameSettings, ts, creatorUserId) {
        if (gameSettings.tiles < NEWGAME_MIN_PIECES || gameSettings.tiles > NEWGAME_MAX_PIECES) {
            throw new Error(`Target pieces count must be between ${NEWGAME_MIN_PIECES} and ${NEWGAME_MAX_PIECES}`);
        }
        let gameId;
        do {
            gameId = Util.uniqId();
        } while (await this.exists(gameId));
        const gameObject = await this.createGameObject(gameId, Protocol.GAME_VERSION, gameSettings.tiles, gameSettings.image, ts, gameSettings.scoreMode, gameSettings.shapeMode, gameSettings.snapMode, creatorUserId, true, // hasReplay
        gameSettings.private, gameSettings.crop);
        GameLog.create(gameId, ts);
        GameLog.log(gameObject.id, Protocol.LOG_HEADER, gameObject.gameVersion, gameSettings.tiles, gameSettings.image, ts, gameObject.scoreMode, gameObject.shapeMode, gameObject.snapMode, gameObject.creatorUserId, gameObject.private ? 1 : 0, gameSettings.crop);
        GameCommon.setGame(gameObject.id, gameObject);
        await this.persistGame(gameObject);
        return gameObject.id;
    }
    addPlayer(gameId, playerId, ts) {
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
        this.setDirty(gameId);
    }
    async handleInput(gameId, playerId, input, ts) {
        if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
            const idx = GameCommon.getPlayerIndexById(gameId, playerId);
            GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, ts);
        }
        const wasFinished = GameCommon.getFinishTs(gameId);
        const ret = GameCommon.handleInput(gameId, playerId, input, ts);
        const isFinished = GameCommon.getFinishTs(gameId);
        this.setDirty(gameId);
        if (!wasFinished && isFinished) {
            const game = GameCommon.get(gameId);
            if (game) {
                // persist game immediately when it was just finished
                // and also update the leaderboard afterwards
                await this.persistGame(game);
                await this.leaderboardRepo.updateLeaderboards();
            }
        }
        return ret;
    }
}

const TABLE$6 = 'games';
class GamesRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async getGameRowById(gameId) {
        const gameRow = await this.db.get(TABLE$6, { id: gameId });
        return gameRow || null;
    }
    async getPublicRunningGames(offset, limit) {
        return await this.db.getMany(TABLE$6, { private: 0, finished: null }, [{ created: -1 }], { limit, offset });
    }
    async getPublicFinishedGames(offset, limit) {
        return await this.db.getMany(TABLE$6, { private: 0, finished: { '$ne': null } }, [{ finished: -1 }], { limit, offset });
    }
    async countPublicRunningGames() {
        return await this.count({ private: 0, finished: null });
    }
    async countPublicFinishedGames() {
        return await this.count({ private: 0, finished: { '$ne': null } });
    }
    async count(where) {
        return await this.db.count(TABLE$6, where);
    }
    async exists(gameId) {
        const gameRow = await this.getGameRowById(gameId);
        return !!gameRow;
    }
    async upsert(row, where) {
        await this.db.upsert(TABLE$6, row, where);
    }
    async updatePlayerRelations(gameId, players) {
        if (!players.length) {
            return;
        }
        const decodedPlayers = players.map(player => Util.decodePlayer(player));
        const userRows = await this.db.getMany('users', { client_id: { '$in': decodedPlayers.map(p => p.id) } });
        for (const p of decodedPlayers) {
            const userRow = userRows.find(row => row.client_id === p.id);
            const userId = userRow
                ? userRow.id
                : await this.db.insert('users', { client_id: p.id, created: new Date() }, 'id');
            await this.db.upsert('user_x_game', {
                user_id: userId,
                game_id: gameId,
                pieces_count: p.points,
            }, {
                user_id: userId,
                game_id: gameId,
            });
        }
    }
}

const key = crypto.createHash('md5').update(config.secret).digest("hex");
const encrypt = (str) => {
    return Buffer.from(key + str, 'utf8').toString('base64');
};
const decrypt = (str) => {
    const decrypted = Buffer.from(str, 'base64').toString('utf8');
    return decrypted.substring(key.length);
};
var Crypto = {
    encrypt,
    decrypt,
};

const TABLE$5 = 'accounts';
class AccountsRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async insert(account) {
        if (account.email) {
            account.email = Crypto.encrypt(account.email);
        }
        return await this.db.insert(TABLE$5, account, 'id');
    }
    async get(where) {
        if (where.email) {
            where.email = Crypto.encrypt(where.email);
        }
        const account = await this.db.get(TABLE$5, where);
        if (account) {
            if (account.email) {
                account.email = Crypto.decrypt(account.email);
            }
        }
        return account;
    }
    async update(account, where) {
        if (account.email) {
            account.email = Crypto.encrypt(account.email);
        }
        if (where.email) {
            where.email = Crypto.encrypt(where.email);
        }
        await this.db.update('accounts', account, where);
    }
}

const TABLE$4 = 'tokens';
class TokensRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async insert(row) {
        await this.db.insert(TABLE$4, row);
    }
    async get(where) {
        return await this.db.get(TABLE$4, where);
    }
    async delete(where) {
        await this.db.delete('tokens', where);
    }
}

const TABLE$3 = 'user_identity';
class UserIdentityRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async insert(userIdentity) {
        if (userIdentity.provider_email) {
            userIdentity.provider_email = Crypto.encrypt(userIdentity.provider_email);
        }
        return await this.db.insert(TABLE$3, userIdentity, 'id');
    }
    async get(where) {
        if (where.provider_email) {
            where.provider_email = Crypto.encrypt(where.provider_email);
        }
        const identity = await this.db.get(TABLE$3, where);
        if (identity) {
            if (identity.provider_email) {
                identity.provider_email = Crypto.decrypt(identity.provider_email);
            }
        }
        return identity;
    }
    async update(userIdentity) {
        if (userIdentity.provider_email) {
            userIdentity.provider_email = Crypto.encrypt(userIdentity.provider_email);
        }
        await this.db.update(TABLE$3, userIdentity, { id: userIdentity.id });
    }
}

const TABLE$2 = 'users';
class UsersRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async insert(user) {
        if (user.email) {
            user.email = Crypto.encrypt(user.email);
        }
        return await this.db.insert(TABLE$2, user, 'id');
    }
    async update(user) {
        if (user.email) {
            user.email = Crypto.encrypt(user.email);
        }
        await this.db.update(TABLE$2, user, { id: user.id });
    }
    async get(where) {
        if (where.email) {
            where.email = Crypto.encrypt(where.email);
        }
        const user = await this.db.get(TABLE$2, where);
        if (user) {
            user.id = parseInt(user.id, 10);
            if (user.email) {
                user.email = Crypto.decrypt(user.email);
            }
        }
        return user;
    }
    async getGroupsByUserId(userId) {
        const relations = await this.db.getMany('user_x_user_group', { user_id: userId });
        const groupIds = relations.map(r => r.user_group_id);
        return await this.db.getMany('user_groups', { id: { '$in': groupIds } });
    }
}

const HEADER_CLIENT_ID = 'client-id';
class Users {
    constructor(db) {
        this.usersRepo = new UsersRepo(db);
        this.accountsRepo = new AccountsRepo(db);
        this.userIdentityRepo = new UserIdentityRepo(db);
        this.tokensRepo = new TokensRepo(db);
    }
    async setAccountVerified(accountId) {
        await this.accountsRepo.update({ status: 'verified' }, { id: accountId });
    }
    async getGroups(userId) {
        return await this.usersRepo.getGroupsByUserId(userId);
    }
    async createAccount(account) {
        const accountId = await this.accountsRepo.insert(account);
        return await this.accountsRepo.get({ id: accountId });
    }
    async createIdentity(identity) {
        const identityId = await this.userIdentityRepo.insert(identity);
        return await this.userIdentityRepo.get({ id: identityId });
    }
    async updateIdentity(identity) {
        await this.userIdentityRepo.update(identity);
    }
    async getIdentity(where) {
        return await this.userIdentityRepo.get(where);
    }
    async getAccount(where) {
        return await this.accountsRepo.get(where);
    }
    async updateAccount(account) {
        return await this.accountsRepo.update(account, { id: account.id });
    }
    async createUser(user) {
        const userId = await this.usersRepo.insert(user);
        return await this.getUser({ id: userId });
    }
    async updateUser(user) {
        await this.usersRepo.update(user);
    }
    async getOrCreateUserByRequest(req) {
        // if user is already set on the request use that one
        if (req.user) {
            return req.user;
        }
        let data = await this.getUserInfoByRequest(req);
        if (!data.user) {
            await this.usersRepo.insert({
                client_id: req.headers[HEADER_CLIENT_ID],
                created: new Date(),
            });
            data = await this.getUserInfoByRequest(req);
        }
        // here the user is already guaranteed to exist (as UserRow is fine here)
        return data.user;
    }
    async getUser(where) {
        return await this.usersRepo.get(where);
    }
    async getToken(where) {
        return await this.tokensRepo.get(where);
    }
    async addAuthToken(userId) {
        const token = generateToken();
        await this.tokensRepo.insert({ user_id: userId, token, type: 'auth' });
        return token;
    }
    async getUserInfoByRequest(req) {
        const token = req.cookies[COOKIE_TOKEN] || null;
        const tokenRow = token
            ? await this.getToken({ token, type: 'auth' })
            : null;
        let user = tokenRow ? await this.getUser({ id: tokenRow.user_id }) : null;
        if (user && tokenRow) {
            return {
                token: tokenRow.token,
                user: user,
                user_type: 'user',
            };
        }
        // when no token is given or the token is not found or the user is not found
        // we fall back to check the request for client id.
        user = await this.getUser({ client_id: req.headers[HEADER_CLIENT_ID] });
        return {
            token: null,
            user: user,
            user_type: user ? 'guest' : null,
        };
    }
    async getUserByIdentity(identity) {
        return this.getUser({ id: identity.user_id });
    }
}

const TABLE$1 = 'images';
class ImagesRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async get(where) {
        return await this.db.get(TABLE$1, where);
    }
    async insert(image) {
        return await this.db.insert(TABLE$1, image, 'id');
    }
    async update(image, where) {
        await this.db.update(TABLE$1, image, where);
    }
    async deleteTagRelations(imageId) {
        await this.db.delete('image_x_category', { image_id: imageId });
    }
    async insertTagRelation(imageXtag) {
        await this.db.insert('image_x_category', imageXtag);
    }
    async upsertTag(tag) {
        return await this.db.upsert('categories', tag, { slug: tag.slug }, 'id');
    }
    async getTagsBySlugs(slugs) {
        return await this.db.getMany('categories', { slug: { '$in': slugs } });
    }
    async getTagsBySearch(search) {
        return await this.db.getMany('categories', { slug: { '$ilike': search + '%' } });
    }
    async getTagsByImageId(imageId) {
        const query = `
      select c.id, c.slug, c.title from categories c
      inner join image_x_category ixc on c.id = ixc.category_id
      where ixc.image_id = $1`;
        return await this.db._getMany(query, [imageId]);
    }
    async searchImagesWithCount(search, orderBy, isPrivate, offset, limit) {
        const orderByMap = {
            alpha_asc: [{ title: 1 }, { created: -1 }],
            alpha_desc: [{ title: -1 }, { created: -1 }],
            date_asc: [{ created: 1 }],
            date_desc: [{ created: -1 }],
            game_count_asc: [{ games_count: 1 }, { created: -1 }],
            game_count_desc: [{ games_count: -1 }, { created: -1 }],
        };
        const imageIds = [];
        // search in tags:
        const searchClean = search.trim();
        const searches = searchClean ? searchClean.split(/\s+/) : [];
        if (searches.length > 0) {
            for (search of searches) {
                const tags = await this.getTagsBySearch(search);
                if (tags) {
                    const where = this.db._buildWhere({
                        'category_id': { '$in': tags.map(x => x.id) }
                    });
                    const ids = (await this.db._getMany(`
      select i.id from image_x_category ixc
      inner join images i on i.id = ixc.image_id ${where.sql};
      `, where.values)).map(img => img.id);
                    imageIds.push(...ids);
                }
            }
        }
        const params = [];
        const ors = [];
        if (imageIds.length > 0) {
            ors.push(`images.id IN (${imageIds.join(',')})`);
        }
        if (searches.length) {
            let i = 1;
            for (search of searches) {
                ors.push(`users.name ilike $${i++}`);
                params.push(`%${search}%`);
                ors.push(`images.title ilike $${i++}`);
                params.push(`%${search}%`);
                ors.push(`images.copyright_name ilike $${i++}`);
                params.push(`%${search}%`);
            }
        }
        return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          games
        WHERE
          private = ${isPrivate ? 1 : 0}
        GROUP BY image_id
      )
      SELECT
        images.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(users.name, '') as uploader_user_name
      FROM
        images
        LEFT JOIN counts ON counts.image_id = images.id
        LEFT JOIN users ON users.id = images.uploader_user_id
      WHERE
        private = ${isPrivate ? 1 : 0}
        ${ors.length > 0 ? ` AND (${ors.join(' OR ')})` : ''}
      ${this.db._buildOrderBy(orderByMap[orderBy])}
      ${this.db._buildLimit({ offset, limit })}
    `, params);
    }
    async getImagesWithCountByIds(imageIds) {
        const params = [];
        const dbWhere = this.db._buildWhere({ 'images.id': { '$in': imageIds } });
        params.push(...dbWhere.values);
        return await this.db._getMany(`
      WITH counts AS (
        SELECT
          COUNT(*)::int AS count,
          image_id
        FROM
          games
        WHERE
          private = 0
        GROUP BY image_id
      )
      SELECT
        images.*,
        COALESCE(counts.count, 0) AS games_count,
        COALESCE(users.name, '') as uploader_user_name
      FROM
        images
        LEFT JOIN counts ON counts.image_id = images.id
        LEFT JOIN users ON users.id = images.uploader_user_id
      ${dbWhere.sql}
    `, params);
    }
    async getAllTagsWithCount() {
        const query = `
      select c.id, c.slug, c.title, count(*)::int as images_count from categories c
      inner join image_x_category ixc on c.id = ixc.category_id
      inner join images i on i.id = ixc.image_id
      group by c.id order by images_count desc;`;
        return await this.db._getMany(query);
    }
}

class Images {
    constructor(imagesRepo) {
        this.imagesRepo = imagesRepo;
        // pass
    }
    async getExifOrientation(imagePath) {
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
    async getAllTags() {
        const tagRows = await this.imagesRepo.getAllTagsWithCount();
        return tagRows.map(row => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            total: row.images_count,
        }));
    }
    async getTags(imageId) {
        const tagRows = await this.imagesRepo.getTagsByImageId(imageId);
        return tagRows.map(row => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            total: 0,
        }));
    }
    async imageFromDb(imageId) {
        const imageInfos = await this.imagesByIdsFromDb([imageId]);
        return imageInfos.length === 0 ? null : imageInfos[0];
    }
    async imageWithCountToImageInfo(row) {
        return {
            id: row.id,
            uploaderUserId: row.uploader_user_id,
            uploaderName: row.uploader_user_name || null,
            filename: row.filename,
            url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(row.filename)}`,
            title: row.title,
            tags: await this.getTags(row.id),
            created: row.created.getTime(),
            width: row.width,
            height: row.height,
            private: !!row.private,
            gameCount: parseInt(row.games_count, 10),
            copyrightName: row.copyright_name,
            copyrightURL: row.copyright_url,
        };
    }
    async imagesFromDb(search, orderBy, isPrivate, offset, limit) {
        const rows = await this.imagesRepo.searchImagesWithCount(search, orderBy, isPrivate, offset, limit);
        const images = [];
        for (const row of rows) {
            images.push(await this.imageWithCountToImageInfo(row));
        }
        return images;
    }
    async imagesByIdsFromDb(ids) {
        const rows = await this.imagesRepo.getImagesWithCountByIds(ids);
        const images = [];
        for (const row of rows) {
            images.push(await this.imageWithCountToImageInfo(row));
        }
        return images;
    }
    async getDimensions(imagePath) {
        const dimensions = await probe(fs.createReadStream(imagePath));
        const orientation = await this.getExifOrientation(imagePath);
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
    async setTags(imageId, tags) {
        this.imagesRepo.deleteTagRelations(imageId);
        for (const tag of tags) {
            const slug = Util.slug(tag);
            const id = await this.imagesRepo.upsertTag({ slug, title: tag });
            if (id) {
                this.imagesRepo.insertTagRelation({
                    image_id: imageId,
                    category_id: id,
                });
            }
        }
    }
    async insertImage(image) {
        return await this.imagesRepo.insert(image);
    }
    async updateImage(image, where) {
        await this.imagesRepo.update(image, where);
    }
    async getImageById(imageId) {
        return await this.imagesRepo.get({ id: imageId });
    }
}

const TABLE = 'announcements';
class AnnouncementsRepo {
    constructor(db) {
        this.db = db;
        // pass
    }
    async getAll() {
        return await this.db.getMany(TABLE, undefined, [{ created: -1 }]);
    }
    async insert(announcement) {
        return await this.db.insert(TABLE, announcement, 'id');
    }
    async get(where) {
        return await this.db.get('announcements', where);
    }
}

const log = logger('ImageResize.ts');
class ImageResize {
    constructor(images) {
        this.images = images;
        // pass
    }
    async loadSharpImage(imagePath) {
        const orientation = await this.images.getExifOrientation(imagePath);
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
        return sharpImg;
    }
    async cropRestrictImage(filename, crop, maxw, maxh) {
        try {
            const baseDir = config.dir.CROP_DIR;
            const cropFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}_max_${maxw}x${maxh}-q75.webp`;
            if (!fs.existsSync(cropFilename)) {
                if (!fs.existsSync(baseDir)) {
                    fs.mkdirSync(baseDir, { recursive: true });
                }
                const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`;
                const sharpImg = await this.loadSharpImage(originalImagePath);
                await sharpImg.extract({
                    top: crop.y,
                    left: crop.x,
                    width: crop.w,
                    height: crop.h
                }).resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(cropFilename);
            }
            return cropFilename;
        }
        catch (e) {
            log.error('error when crop resizing image', filename, e);
            return null;
        }
    }
    async restrictImage(filename, maxw, maxh) {
        try {
            const baseDir = config.dir.RESIZE_DIR;
            const resizeFilename = `${baseDir}/${filename}-max_${maxw}x${maxh}-q75.webp`;
            if (!fs.existsSync(resizeFilename)) {
                if (!fs.existsSync(baseDir)) {
                    fs.mkdirSync(baseDir, { recursive: true });
                }
                const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`;
                const sharpImg = await this.loadSharpImage(originalImagePath);
                await sharpImg.resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(resizeFilename);
            }
            return resizeFilename;
        }
        catch (e) {
            log.error('error when resizing image', filename, e);
            return null;
        }
    }
    async cropImage(filename, crop) {
        try {
            const baseDir = config.dir.CROP_DIR;
            const cropFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}-q75.webp`;
            if (!fs.existsSync(cropFilename)) {
                if (!fs.existsSync(baseDir)) {
                    fs.mkdirSync(baseDir, { recursive: true });
                }
                const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`;
                const sharpImg = await this.loadSharpImage(originalImagePath);
                await sharpImg.extract({
                    top: crop.y,
                    left: crop.x,
                    width: crop.w,
                    height: crop.h
                }).webp({ quality: 75 }).toFile(cropFilename);
            }
            return cropFilename;
        }
        catch (e) {
            log.error('error when cropping image', filename, e);
            return null;
        }
    }
    async resizeImage(filename, w, h, fit) {
        try {
            const baseDir = config.dir.RESIZE_DIR;
            const resizeFilename = `${baseDir}/${filename}-${w}x${h || 0}-${fit}-q75.webp`;
            if (!fs.existsSync(resizeFilename)) {
                if (!fs.existsSync(baseDir)) {
                    fs.mkdirSync(baseDir, { recursive: true });
                }
                const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`;
                const sharpImg = await this.loadSharpImage(originalImagePath);
                log.info(w, h, resizeFilename);
                await sharpImg.resize(w, h || null, { fit }).webp({ quality: 75 }).toFile(resizeFilename);
            }
            return resizeFilename;
        }
        catch (e) {
            log.error('error when resizing image', filename, e);
            return null;
        }
    }
}

// cut size of each puzzle piece in the
// final resized version of the puzzle image
const PIECE_SIZE = 64;
const determinePiecesXY = (dim, desiredPieceCount) => {
    if (desiredPieceCount <= 0 || isNaN(desiredPieceCount)) {
        return { countHorizontal: 0, countVertical: 0 };
    }
    const w_ = dim.w < dim.h ? (dim.w * dim.h) : (dim.w * dim.w);
    const h_ = dim.w < dim.h ? (dim.h * dim.h) : (dim.w * dim.h);
    let size = 0;
    let pieces = 0;
    do {
        size++;
        pieces = Math.floor(w_ / size) * Math.floor(h_ / size);
    } while (pieces >= desiredPieceCount);
    if (pieces !== desiredPieceCount) {
        size--;
    }
    return {
        countHorizontal: Math.floor(w_ / size),
        countVertical: Math.floor(h_ / size),
    };
};
const determinePuzzleInfo = (dim, desiredPieceCount) => {
    const { countHorizontal, countVertical } = determinePiecesXY(dim, desiredPieceCount);
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
        desiredPieceCount: desiredPieceCount,
    };
};
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

class PuzzleService {
    constructor(images) {
        this.images = images;
        // pass
    }
    async createPuzzle(rng, targetPieceCount, image, ts, shapeMode, gameVersion) {
        const imagePath = `${config.dir.UPLOAD_DIR}/${image.filename}`;
        // determine puzzle information from the image dimensions
        const dim = await this.images.getDimensions(imagePath);
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
        const tableDim = this.determineTableDim(info, gameVersion);
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
    determineTableDim(info, gameVersion) {
        if (gameVersion <= 3) {
            return { w: info.width * 3, h: info.height * 3 };
        }
        const tableSize = Math.max(info.width, info.height) * 6;
        return { w: tableSize, h: tableSize };
    }
}

class LeaderboardRepo {
    constructor(db) {
        this.db = db;
        this.LEADERBOARDS = [
            { name: 'alltime' },
            { name: 'week' },
            { name: 'month' },
        ];
        // pass
    }
    async updateLeaderboards() {
        await this.db.txn(async () => {
            await this.db.run('truncate leaderboard_entries');
            for (const lb of this.LEADERBOARDS) {
                const leaderboardId = await this.db.upsert('leaderboard', { name: lb.name }, { name: lb.name }, 'id');
                const rows = await this.db._getMany(`
          with relevant_users as (
            select u.id from users u
              inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'local'
              inner join accounts a on a.id::text = ui.provider_id and a.status = 'verified'
            union
            select u.id from users u
              inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'twitch'
          ),
          tmp as (
            select
              uxg.user_id,
              count(uxg.game_id)::int as games_count,
              sum(uxg.pieces_count)::int as pieces_count
            from user_x_game uxg
            inner join games g on g.id = uxg.game_id and g.finished is not null and g.private = 0
            where
              uxg.pieces_count > 0
              ${lb.name === 'week' ? `and g.finished > (current_timestamp - interval '1 week')` :
                    lb.name === 'month' ? `and g.finished > (current_timestamp - interval '1 month')` :
                        ''}
            group by uxg.user_id
          )
          select
            u.id as user_id,
            coalesce(tmp.games_count, 0) as games_count,
            coalesce(tmp.pieces_count, 0) as pieces_count
          from relevant_users u
          left join tmp on tmp.user_id = u.id
          order by pieces_count desc, games_count desc
        `);
                let i = 1;
                for (const row of rows) {
                    row.leaderboard_id = leaderboardId;
                    row.rank = row.pieces_count ? i : 0;
                    this.db.insert('leaderboard_entries', row);
                    i++;
                }
            }
        });
    }
    async getTop10(userId) {
        const leaderboards = [];
        for (const lb of this.LEADERBOARDS) {
            const leaderboard = await this.db.get('leaderboard', { name: lb.name });
            const leaderboardUserEntry = userId ? await this.db._get(`
        select
          lbe.*, u.name as user_name
        from leaderboard_entries lbe
          inner join users u on u.id = lbe.user_id
        where lbe.user_id = $1 and lbe.leaderboard_id = $2
      `, [userId, leaderboard.id]) : null;
            const leaderboardEntries = await this.db._getMany(`
        select
          lbe.*, u.name as user_name
        from leaderboard_entries lbe
          inner join users u on u.id = lbe.user_id
        where
          lbe.leaderboard_id = $1
          and lbe.pieces_count > 0
        order by
          lbe.pieces_count desc,
          lbe.games_count desc
        limit 10
      `, [leaderboard.id]);
            leaderboards.push({
                id: leaderboard.id,
                name: leaderboard.name,
                entries: leaderboardEntries,
                userEntry: leaderboardUserEntry,
            });
        }
        return leaderboards;
    }
}

const run = async () => {
    const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR);
    await db.connect();
    await db.patch();
    const mail = new Mail(config.mail);
    const canny = new Canny(config.canny);
    const discord = new Discord(config.discord);
    const gameSockets = new GameSockets();
    const gamesRepo = new GamesRepo(db);
    const imagesRepo = new ImagesRepo(db);
    const users = new Users(db);
    const images = new Images(imagesRepo);
    const imageResize = new ImageResize(images);
    const tokensRepo = new TokensRepo(db);
    const announcementsRepo = new AnnouncementsRepo(db);
    const puzzleService = new PuzzleService(images);
    const leaderboardRepo = new LeaderboardRepo(db);
    const gameService = new GameService(gamesRepo, puzzleService, leaderboardRepo);
    const server = new Server(db, mail, canny, discord, gameSockets, gameService, users, images, imageResize, tokensRepo, announcementsRepo, leaderboardRepo);
    server.start();
    const log = logger('main.js');
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
        await server.persistGames();
        memoryUsageHuman();
        persistInterval = setTimeout(doPersist, config.persistence.interval);
    };
    persistInterval = setTimeout(doPersist, config.persistence.interval);
    const gracefulShutdown = async (signal) => {
        log.log(`${signal} received...`);
        log.log('clearing persist interval...');
        clearInterval(persistInterval);
        log.log('Persisting games...');
        await server.persistGames();
        log.log('shutting down server...');
        server.close();
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
