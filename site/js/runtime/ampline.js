// A tiny CommonJS registry that runs ampline-claude's real renderer in the browser.
// Node-only modules are replaced: cache -> in-memory Map, config.loadConfig -> demo config,
// segments/git + segments/task -> fakes, fs/os/child_process/crypto -> throwing stubs.
import { FACTORIES, VERSION } from './factories.generated.js';
import { makeFakeGit, makeFakeTask } from './fakes.js';

// Every module a vendored ampline file may require that is NOT vendored: replaced inside createAmpline.
// test/sync.test.mjs fails when a vendored file requires something that is neither vendored nor listed here.
export const STUBBED_MODULES = [
  'path', 'os', 'fs', 'crypto', 'child_process', 'cache', 'claudeDir', 'segments/git', 'segments/task',
];

const BUILTIN_UNAVAILABLE = (name) => new Proxy({}, {
  get: (_, key) => () => { throw new Error(`${name}.${String(key)} is unavailable in the browser`); },
});

const pathShim = {
  basename: (p) => String(p).split(/[\\/]/).filter(Boolean).pop() || '',
  dirname: (p) => String(p).replace(/[\\/][^\\/]*[\\/]?$/, '') || '/',
  join: (...a) => a.join('/').replace(/\/+/g, '/'),
  resolve: (...a) => a.join('/').replace(/\/+/g, '/'),
  sep: '/',
};

function resolveId(fromId, request) {
  if (!request.startsWith('.')) return request;
  const parts = fromId.split('/').slice(0, -1);
  for (const seg of request.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

// ampline-claude 1.0.0 prints the subagent panel as one JSON line per row, {"id", "content"}, where content
// is the ANSI row (Claude Code takes the content as-is). Returns the contents, in order. Pure; a blank or
// malformed line, or one without a string content, is skipped rather than shown as raw JSON.
export function subagentRows(raw) {
  const rows = [];
  for (const line of String(raw == null ? '' : raw).split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row.content === 'string') rows.push(row.content);
    } catch { /* not a row */ }
  }
  return rows;
}

export function createAmpline({ noColor = false, columns = 120 } = {}) {
  const env = { COLUMNS: String(columns) };
  if (noColor) env.NO_COLOR = '1'; // colors.js reads this once at load: one instance per mode
  const proc = { env, cwd: () => '/home/you/widgets' };

  const mem = new Map();
  const cacheShim = {
    read(key) { const e = mem.get(key); return e ? { age: Date.now() - e.t, value: e.v } : null; },
    write(key, value) { mem.set(key, { t: Date.now(), v: value }); },
    remove(key) { mem.delete(key); },
    prune() {},
    CACHE_DIR: '',
  };

  const registry = new Map();
  let currentConfig = null;
  const overrides = {
    path: pathShim,
    os: { homedir: () => '/home/you', platform: () => 'linux' },
    fs: BUILTIN_UNAVAILABLE('fs'),
    crypto: BUILTIN_UNAVAILABLE('crypto'),
    child_process: BUILTIN_UNAVAILABLE('child_process'),
    cache: cacheShim,
    claudeDir: { claudeDir: () => '/home/you/.claude' },
  };

  function load(id) {
    if (registry.has(id)) return registry.get(id).exports;
    if (id === 'config') {
      const real = loadFactory('config');
      const wrapped = { ...real, loadConfig: () => currentConfig };
      registry.set('config', { exports: wrapped });
      return wrapped;
    }
    if (id === 'segments/git') return cacheModule(id, fakes.git);
    if (id === 'segments/task') return cacheModule(id, fakes.task);
    if (id in overrides) return overrides[id];
    return loadFactory(id);
  }
  function cacheModule(id, exports) { registry.set(id, { exports }); return exports; }
  function loadFactory(id) {
    const factory = FACTORIES[id];
    if (!factory) throw new Error(`ampline runtime: no module "${id}"`);
    const module = { exports: {} };
    registry.set(`__raw:${id}`, module);
    factory(module, module.exports, (req) => load(resolveId(id, req)), proc);
    if (id !== 'config') registry.set(id, module);
    return module.exports;
  }

  const colors = load('colors');
  const fakes = { git: makeFakeGit(colors), task: makeFakeTask(colors) };
  const configModule = load('config');
  currentConfig = configModule.validateAndMerge({});

  return {
    version: VERSION,
    colors,
    _fakes: fakes,
    renderStatusline: (input) => load('render').renderStatusline(input),
    renderSubagentLine: (input) => load('segments/subagents').renderSubagentLine(input),
    setColumns(n) { env.COLUMNS = String(n); }, // layout.js reads COLUMNS on every call
    setConfig(user) { currentConfig = configModule.validateAndMerge(user || {}); return currentConfig; },
    getConfig: () => currentConfig,
    resetCache() { mem.clear(); }, // drops the in-memory usage/git cache: output becomes a pure function of the input
    stripAnsi: (s) => colors.stripAnsi(s),
    safeLinkUrl: (u) => load('segments/pr').safeLinkUrl(u),
  };
}
