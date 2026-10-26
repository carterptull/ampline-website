import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAmpline } from '../site/js/runtime/ampline.js';

const amp = createAmpline({ columns: 200 });
const cfg = amp.getConfig();
const git = (g) => amp._fakes.git.renderGitSegment({ input: { __demo: { git: g } }, config: cfg });
const task = (t) => amp._fakes.task.renderTaskSegment({ input: { __demo: { task: t } }, config: cfg });

// Byte pins: fast checks of the exact escape sequences. They are not the drift guard; the real-binary
// comparisons further down are (they run the pinned ampline-claude and require the same bytes).
test('git: long branch, ahead 2, behind 1, dirty bytes', () => {
  assert.equal(
    git({ branch: 'feat/TAMA5-32796-statusline-v2', ahead: 2, behind: 1, dirty: true }),
    '\u001b[2m⎇ feat/TAMA5-32796-status…\u001b[0m \u001b[38;2;96;200;120m↑2\u001b[0m\u001b[38;2;232;67;61m↓1\u001b[0m \u001b[38;2;245;196;61m●\u001b[0m'
  );
});

test('git: clean, no ahead/behind', () => {
  assert.equal(git({ branch: 'main', ahead: 0, behind: 0, dirty: false }),
    '\u001b[2m⎇ main\u001b[0m \u001b[38;2;96;200;120m✓\u001b[0m');
});

test('git: no demo data -> null (segment omitted, like a non-repo dir)', () => {
  assert.equal(amp._fakes.git.renderGitSegment({ input: {}, config: cfg }), null);
});

test('task: short and truncated-at-40 bytes', () => {
  assert.equal(task('Refactor the bar renderer'), '\u001b[2mRefactor the bar renderer\u001b[0m');
  assert.equal(task('Wiring up the parser for the new payload shape'),
    '\u001b[2mWiring up the parser for the new payloa…\u001b[0m');
});

test('task: control characters are stripped (sanitize)', () => {
  assert.equal(task('evil\u001b[31mred'), '\u001b[2mevil[31mred\u001b[0m');
});

test('task: trims, and drops text that is blank after cleaning (as the real 1.0.0 segment does)', () => {
  assert.equal(task('  Refactor  '), '\u001b[2mRefactor\u001b[0m');
  assert.equal(task('\u0007'), null);
  assert.equal(task('   '), null);
  assert.equal(task('\u001b'), null);
});

// ---------------------------------------------------------------------------------------------
// Real-binary comparisons. These run the pinned ampline-claude binary against a real git repository and
// a real todo file in a throwaway HOME and require the fake to print the same bytes, so a format change
// upstream fails here instead of shipping silently.
// ---------------------------------------------------------------------------------------------
const BIN = fileURLToPath(new URL('../node_modules/ampline-claude/bin/ampline-claude.js', import.meta.url));
const HAVE_GIT = spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0;

// A fresh HOME per case: the binary caches git and task results under the Claude config dir for a few
// seconds, which would otherwise leak between cases. CLAUDE_CONFIG_DIR is not set (the env is built from
// scratch), so the Claude dir is HOME/.claude. HOME is the throwaway, so no developer git config applies.
function withHome(fn) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'ampline-fakes-')));
  try { return fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
}
const cleanEnv = (home) => ({
  PATH: process.env.PATH,
  HOME: home,
  USERPROFILE: home,
  COLUMNS: '200',
  ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
});
// The real binary with one segment, configured by a .amplinerc.json that the config walk finds in HOME.
function realSegment(home, segment, input, cwd) {
  writeFileSync(join(home, '.amplinerc.json'), JSON.stringify({ segments: [segment] }));
  return execFileSync(process.execPath, [BIN], {
    input: JSON.stringify(input), cwd, env: cleanEnv(home), encoding: 'utf8',
  });
}
function runGit(home, cwd, ...args) {
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd, env: cleanEnv(home), stdio: 'pipe',
  });
}
const fakeGit = (g) => amp._fakes.git.renderGitSegment({ input: { __demo: { git: g } }, config: amp.getConfig() });
const fakeTask = (t) => amp._fakes.task.renderTaskSegment({ input: { __demo: { task: t } }, config: amp.getConfig() });

// A plain repository: no filter or include in its own config (the 1.0.0 git segment skips `git status`
// for those, and prints no marker). With `upstream` a bare origin, a second clone that pushes one commit
// (this clone is behind by 1) and two local commits (ahead by 2), then a fetch so git knows both counts.
function makeRepo(home, { branch, upstream = false, dirty = false }) {
  const repo = join(home, 'work', 'widgets');
  mkdirSync(repo, { recursive: true });
  runGit(home, repo, 'init', '-q', '-b', branch);
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  runGit(home, repo, 'add', 'a.txt');
  runGit(home, repo, 'commit', '-q', '-m', 'first');
  if (upstream) {
    const origin = join(home, 'origin.git');
    runGit(home, home, 'clone', '-q', '--bare', repo, origin);
    runGit(home, repo, 'remote', 'add', 'origin', origin);
    runGit(home, repo, 'fetch', '-q', 'origin');
    runGit(home, repo, 'branch', '-q', '--set-upstream-to', `origin/${branch}`, branch);
    const other = join(home, 'other');
    runGit(home, home, 'clone', '-q', origin, other);
    writeFileSync(join(other, 'b.txt'), 'two\n');
    runGit(home, other, 'add', 'b.txt');
    runGit(home, other, 'commit', '-q', '-m', 'remote work');
    runGit(home, other, 'push', '-q', 'origin', branch);
    for (const f of ['c.txt', 'd.txt']) {
      writeFileSync(join(repo, f), 'local\n');
      runGit(home, repo, 'add', f);
      runGit(home, repo, 'commit', '-q', '-m', `local ${f}`);
    }
    runGit(home, repo, 'fetch', '-q', 'origin');
  }
  if (dirty) writeFileSync(join(repo, 'a.txt'), 'changed\n'); // a modified tracked file
  return repo;
}

const GIT_CASES = [
  ['clean, no upstream', { branch: 'main' }, { branch: 'main', ahead: 0, behind: 0, dirty: false }],
  ['dirty, no upstream', { branch: 'main', dirty: true }, { branch: 'main', ahead: 0, behind: 0, dirty: true }],
  ['ahead 2, behind 1, clean', { branch: 'main', upstream: true }, { branch: 'main', ahead: 2, behind: 1, dirty: false }],
  ['ahead 2, behind 1, dirty', { branch: 'feat/cache-layer', upstream: true, dirty: true }, { branch: 'feat/cache-layer', ahead: 2, behind: 1, dirty: true }],
  ['branch cut at 24 characters', { branch: 'feat/TAMA5-32796-statusline-v2', upstream: true }, { branch: 'feat/TAMA5-32796-statusline-v2', ahead: 2, behind: 1, dirty: false }],
];
for (const [name, repoOpts, demo] of GIT_CASES) {
  test(`real binary: git fake === real git segment (${name})`, { skip: !HAVE_GIT && 'git is not installed' }, () => {
    withHome((home) => {
      const repo = makeRepo(home, repoOpts);
      const real = realSegment(home, 'git', { workspace: { current_dir: repo } }, repo);
      assert.ok(real.length > 0, 'the real binary printed nothing: the fixture is wrong');
      assert.equal(real, fakeGit(demo));
    });
  });
}

test('real binary: a directory that is not a repository prints no git segment, like the fake without demo data', () => {
  withHome((home) => {
    const dir = join(home, 'plain');
    mkdirSync(dir);
    assert.equal(realSegment(home, 'git', { workspace: { current_dir: dir } }, dir), '');
    assert.equal(amp._fakes.git.renderGitSegment({ input: {}, config: cfg }), null);
  });
});

// The real segment reads ~/.claude/todos/<session_id>.json (a file named exactly <id>.json, or <id>-agent-*.json):
// the in-progress item's activeForm, else its content.
const SESSION = 'sess-1234';
function realTask(text, extra = {}) {
  return withHome((home) => {
    const dir = join(home, '.claude', 'todos');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${SESSION}.json`), JSON.stringify([
      { content: 'Done earlier', status: 'completed' },
      { activeForm: text, content: 'Content, used only when activeForm is blank', status: 'in_progress', ...extra },
      { content: 'Later', status: 'pending' },
    ]));
    return realSegment(home, 'task', { session_id: SESSION, workspace: { current_dir: home } }, home);
  });
}
const TASK_CASES = [
  ['short', 'Refactor the bar renderer'],
  ['exactly 40 characters is not cut', 'x'.repeat(40)],
  ['41 characters is cut with an ellipsis', 'y'.repeat(41)],
  ['truncated at 40', 'Wiring up the parser for the new payload shape'],
  ['surrounding whitespace is trimmed', '  Refactor  '],
  ['control characters are stripped', 'evil\u001b[31mred'],
  ['a code point beyond the BMP is never split', '\u{1F600}'.repeat(45)],
];
for (const [name, text] of TASK_CASES) {
  test(`real binary: task fake === real task segment (${name})`, () => {
    const real = realTask(text);
    assert.ok(real.length > 0, 'the real binary printed nothing: the fixture is wrong');
    assert.equal(real, fakeTask(text));
  });
}
for (const [name, text] of [['only a control character', '\u0007'], ['only whitespace', '   ']]) {
  test(`real binary: a blank task is left out by both (${name})`, () => {
    // content is blanked too, so the real reader has no other text to fall back to.
    const real = realTask(text, { content: text });
    assert.equal(real, '');
    assert.equal(fakeTask(text), null);
  });
}
