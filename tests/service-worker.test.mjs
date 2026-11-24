// PWA-01 y PWA-02: el service worker instala versiones completas, no mezcla archivos de dos versiones
// y no borra cachés ajenas. Usa cachés y red simuladas; no sustituye probar Safari en un iPhone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('service-worker.js', root), 'utf8');
const ORIGIN = 'https://sterk.example';
const BASE = `${ORIGIN}/app/`;

function loadWorker({ network = (request) => ({ ok: true, body: `red:${request.url}` }), caches: initial = {} } = {}) {
  const stores = new Map(Object.entries(initial).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
  const listeners = {};
  const requests = [];
  const lifecycle = { skipWaiting: 0, claim: 0 };
  const urlOf = (request) => (typeof request === 'string' ? new URL(request, BASE).href : request.url);
  class Request {
    constructor(url, init = {}) {
      this.url = new URL(url, BASE).href;
      this.method = init.method || 'GET';
      this.mode = init.mode || 'cors';
      this.cache = init.cache || 'default';
      this.headers = new Map(Object.entries(init.headers || {}));
    }
  }
  const fetch = async (request) => {
    requests.push(request);
    const response = network(request);
    if (!response) throw new TypeError('Sin conexión');
    return response;
  };
  const cacheFor = (store) => ({
    // Como en el navegador, addAll no guarda nada si una respuesta falla.
    async addAll(list) {
      const responses = [];
      for (const request of list) {
        const response = await fetch(request);
        if (!response.ok) throw new TypeError('Respuesta no válida');
        responses.push([urlOf(request), response]);
      }
      responses.forEach(([url, response]) => store.set(url, response));
    },
    async match(request, { ignoreSearch = false } = {}) {
      const url = new URL(urlOf(request));
      if (ignoreSearch) url.search = '';
      return store.get(url.href);
    },
    async put(request, response) { store.set(urlOf(request), response); },
  });
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      return cacheFor(stores.get(name));
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const store of stores.values()) if (store.has(urlOf(request))) return store.get(urlOf(request));
      return undefined;
    },
  };
  const self = {
    location: new URL(`${BASE}service-worker.js`),
    addEventListener(type, listener) { listeners[type] = listener; },
    async skipWaiting() { lifecycle.skipWaiting += 1; },
    clients: { async claim() { lifecycle.claim += 1; } },
  };
  // Respuesta mínima: cuerpo, estado y cabeceras, para las respuestas por rangos de los vídeos.
  class Response {
    constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.headers = new Map(Object.entries(init.headers || {})); }
    static error() { return { type: 'error' }; }
  }
  vm.runInNewContext(source, { self, caches, fetch, Request, Response, URL, Promise, Number, Math, String });
  const cacheName = /const CACHE_NAME = "([^"]+)"/.exec(source)[1];
  const dispatch = async (type, extra = {}) => {
    let pending;
    const event = { ...extra, waitUntil(promise) { pending = promise; }, respondWith(promise) { pending = promise; } };
    listeners[type](event);
    return pending;
  };
  return { stores, requests, lifecycle, cacheName, dispatch, Request };
}

const shell = () => JSON.parse(/const APP_SHELL = (\[[\s\S]*?\]);/.exec(source)[1].replace(/,\s*\]/, ']'));

test('PWA-02: installing downloads every app file from the network, bypassing the HTTP cache', async () => {
  const worker = loadWorker();
  await worker.dispatch('install');
  assert.equal(worker.requests.length, shell().length);
  assert(worker.requests.every((request) => request.cache === 'reload'));
  assert.equal(worker.stores.get(worker.cacheName).size, shell().length);
  assert.equal(worker.lifecycle.skipWaiting, 1);
});

test('PWA-02: if one file fails, nothing of the new version is used', async () => {
  const worker = loadWorker({ network: (request) => ({ ok: !request.url.endsWith('/src/storage.js'), body: request.url }) });
  await assert.rejects(worker.dispatch('install'));
  assert.equal(worker.stores.get(worker.cacheName)?.size ?? 0, 0);
  assert.equal(worker.lifecycle.skipWaiting, 0);
});

test('PWA-02: requests are answered only from this version cache, never from an older one', async () => {
  const worker = loadWorker({ caches: { 'sterk-v1-7-3': { [`${BASE}src/storage.js`]: 'storage antiguo' } } });
  await worker.dispatch('install');
  const response = await worker.dispatch('fetch', { request: new worker.Request(`${BASE}src/storage.js`) });
  assert.equal(response.body, `red:${BASE}src/storage.js`);
});

test('PWA-01: activating removes older Sterk caches and keeps the rest of the origin', async () => {
  const worker = loadWorker({ caches: { 'sterk-v1-7-3': {}, 'otra-app': {} } });
  await worker.dispatch('install');
  await worker.dispatch('activate');
  assert.deepEqual([...worker.stores.keys()].sort(), ['otra-app', worker.cacheName].sort());
  assert.equal(worker.lifecycle.claim, 1);
});

test('PWA-01: offline, navigation opens the saved app but a missing resource is not replaced by HTML', async () => {
  let online = true;
  const worker = loadWorker({ network: (request) => (online ? { ok: true, body: `red:${request.url}` } : null) });
  await worker.dispatch('install');
  online = false;

  const page = await worker.dispatch('fetch', { request: new worker.Request(`${BASE}?source=pwa`, { mode: 'navigate' }) });
  assert.equal(page.body, `red:${BASE}`);
  const other = await worker.dispatch('fetch', { request: new worker.Request(`${BASE}historial`, { mode: 'navigate' }) });
  assert.equal(other.body, `red:${BASE}index.html`);
  const script = await worker.dispatch('fetch', { request: new worker.Request(`${BASE}src/nuevo.js`) });
  assert.equal(script.type, 'error');
});

test('PWA-02: a saved video asked by ranges, as Safari does, is answered with only those bytes (206)', async () => {
  const bytes = Uint8Array.from({ length: 100 }, (_, i) => i);
  const video = `${BASE}assets/exercises/barbell-squat-claro.mp4`;
  const worker = loadWorker({ network: (request) => (request.url === video
    ? { ok: true, headers: new Map([['Content-Type', 'video/mp4']]), arrayBuffer: async () => bytes.buffer }
    : { ok: true, body: `red:${request.url}` }) });
  await worker.dispatch('install');
  const ask = (range) => worker.dispatch('fetch', { request: new worker.Request(video, { headers: { range } }) });

  const first = await ask('bytes=0-1');
  assert.equal(first.status, 206);
  assert.deepEqual([...new Uint8Array(first.body)], [0, 1]);
  assert.equal(first.headers.get('Content-Range'), 'bytes 0-1/100');
  assert.equal(first.headers.get('Content-Type'), 'video/mp4');
  const rest = await ask('bytes=90-');
  assert.deepEqual([...new Uint8Array(rest.body)], [90, 91, 92, 93, 94, 95, 96, 97, 98, 99]);
  assert.equal(rest.headers.get('Content-Range'), 'bytes 90-99/100');
  assert.equal((await ask('bytes=200-')).status, 416);
  // Sin rango, el archivo entero como antes.
  const whole = await worker.dispatch('fetch', { request: new worker.Request(video) });
  assert.equal(whole.arrayBuffer !== undefined, true);
});

test('PWA-01: other origins and non-GET requests are left to the browser', async () => {
  const worker = loadWorker();
  assert.equal(await worker.dispatch('fetch', { request: new worker.Request('https://fonts.example/font.woff2') }), undefined);
  assert.equal(await worker.dispatch('fetch', { request: new worker.Request(`${BASE}src/app.js`, { method: 'POST' }) }), undefined);
});

test('PWA-02: package.json, the cache name and Settings show the same version', async () => {
  const { version } = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'));
  const cacheName = /const CACHE_NAME = "([^"]+)"/.exec(source)[1];
  const { APP_VERSION: settings } = await import('../src/version.js');
  const { settingsDashboard } = await import('../src/dashboard.js');
  assert.match(settingsDashboard([], 0), new RegExp(`Versión ${settings.replaceAll('.', '\\.')}<`));
  assert.equal(cacheName, `sterk-v${version.replaceAll('.', '-')}`);
  assert.equal(settings, version);
});

test('PWA-02: the precache lists every app file, and every listed file exists', () => {
  const listed = shell();
  const expected = [
    './', './index.html', './manifest.json',
    ...fs.readdirSync(new URL('src/', root)).filter((file) => /\.(js|css)$/.test(file)).map((file) => `./src/${file}`),
    ...fs.readdirSync(new URL('icons/', root)).map((file) => `./icons/${file}`),
    ...fs.readdirSync(new URL('assets/exercises/', root)).map((file) => `./assets/exercises/${file}`),
    ...fs.readdirSync(new URL('assets/fonts/', root)).map((file) => `./assets/fonts/${file}`),
  ];
  assert.deepEqual([...listed].sort(), [...expected].sort());
  for (const file of listed.filter((file) => file !== './')) assert(fs.existsSync(new URL(file, root)), file);
});
