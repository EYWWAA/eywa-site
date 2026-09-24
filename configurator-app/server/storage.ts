import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
export const DATA_DIR=resolve(process.env.EYWA_DATA_DIR||'data');
let connection:DatabaseSync|undefined;
export function db(){if(!connection){mkdirSync(DATA_DIR,{recursive:true,mode:0o700});connection=new DatabaseSync(join(DATA_DIR,'eywa.sqlite'));connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS leases (key TEXT PRIMARY KEY, token TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);}return connection;}
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function cached<T>(key:string):T|null {const row=db().prepare('SELECT value FROM cache WHERE key=? AND expires>?').get(key,Date.now()) as {value:string}|undefined;return row?JSON.parse(row.value):null;}
export function saveCache(key:string,value:unknown,ttl=30*86400000){db().prepare('INSERT INTO cache(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires').run(key,JSON.stringify(value),Date.now()+ttl);}
export function removeCache(key:string){db().prepare('DELETE FROM cache WHERE key=?').run(key);}
export function claim(key:string,ms=240000){const token=randomUUID();const row=db().prepare('INSERT INTO leases(key,token,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE leases.expires < ? RETURNING token').get(key,token,Date.now()+ms,Date.now()) as {token:string}|undefined;return row?.token===token?token:null;}
export function release(key:string,token:string){db().prepare('DELETE FROM leases WHERE key=? AND token=?').run(key,token);}
export function consume(key:string,limit:number,windowMs:number){const now=Date.now();const row=db().prepare('INSERT INTO counters(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN counters.expires < ? THEN 1 ELSE counters.count+1 END,expires=CASE WHEN counters.expires < ? THEN excluded.expires ELSE counters.expires END RETURNING count').get(key,now+windowMs,now,now) as {count:number};return row.count<=limit;}
export function prune(){db().prepare('DELETE FROM cache WHERE expires < ?').run(Date.now());db().prepare('DELETE FROM counters WHERE expires < ?').run(Date.now());db().prepare('DELETE FROM leases WHERE expires < ?').run(Date.now());}
