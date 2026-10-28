import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALL_TRANSCRIPT } from '../site/js/install-demo.js';
// The installer's own test for "this Node lives in a version-named directory" (exported for tests).
import installer from '../node_modules/ampline-claude/lib/install.js';

// The install demo's terminal output is the one hand-copied block on the site (DECISIONS.md D21). This runs the
// real installer from the pinned devDependency, in a throwaway home, and requires its stdout to match the copy.
// A version bump that changes the installer's output fails here and forces a re-capture.
const BIN = fileURLToPath(new URL('../node_modules/ampline-claude/bin/ampline-claude.js', import.meta.url));

// Since 1.0.0 the installer adds two lines right after the first one when the Node it writes into settings.json
// is worth a user's attention: a Node installed under a version-named directory (nvm, fnm, volta, asdf, nodenv,
// mise, Homebrew's Cellar, snap) or a bare `node` fallback.
//
//   ✓ ampline-claude installed.
//     Node: /home/you/.nvm/versions/node/v24.1.0/bin/node
//     Note: re-run `npx ampline-claude --install` after upgrading Node.
//
// They depend on where Node lives on the machine running the test, not on the installer's wording, so a developer
// with a version manager would fail this test for no reason (CI's runner Node is not versioned). The installer is
// run with this process's Node, so the pair is masked ONLY when the installer's own isVersionedNodePath says
// process.execPath is versioned; on any other machine the raw lines are compared, so the demo cannot silently
// diverge if a future installer prints the note on every install. When masking, exactly these two lines are
// removed: at most one of each, the Node line (an absolute path, not the bare `node` fallback) directly after the
// first line and the Note line directly after that. Anything else extra still fails.
const VERSIONED_NODE = installer.isVersionedNodePath(process.execPath);
const NOTE_LINE = '  Note: re-run `npx ampline-claude --install` after upgrading Node.';
function withoutNodeNote(lines, versioned) {
  if (!versioned) return lines;
  const nodeAt = lines.flatMap((l, i) => (l.startsWith('  Node: ') ? [i] : []));
  const noteAt = lines.flatMap((l, i) => (l === NOTE_LINE ? [i] : []));
  assert.ok(nodeAt.length <= 1 && noteAt.length <= 1, `at most one Node line and one Note line, got ${nodeAt.length} and ${noteAt.length}`);
  assert.equal(nodeAt.length, noteAt.length, 'the Node line and the Note line come as a pair');
  if (nodeAt.length === 0) return lines;
  assert.deepEqual([nodeAt[0], noteAt[0]], [1, 2], 'right after the first line, Node then Note');
  assert.match(lines[1], /^  Node: (?:\/|[A-Za-z]:[\\/])/, 'the Node line shows an absolute path, not the bare-node fallback');
  return [lines[0], ...lines.slice(3)];
}

test('INSTALL_TRANSCRIPT equals the pinned installer output, run in a throwaway home', () => {
  const home = mkdtempSync(join(tmpdir(), 'ampline-install-'));
  try {
    // An allowlist, so nothing that locates a real home or config dir can leak in. Windows env keys are
    // case-insensitive, so match them that way; HOME and USERPROFILE point at the throwaway dir.
    const KEEP = new Set(['PATH', 'SYSTEMROOT', 'TEMP', 'TMP']);
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => KEEP.has(k.toUpperCase())));
    env.HOME = home;
    env.USERPROFILE = home;
    const r = spawnSync(process.execPath, [BIN, '--install'], { env, cwd: home, timeout: 30000, encoding: 'utf8' });
    assert.equal(r.status, 0, `installer exited ${r.status}: ${r.stderr}`);
    assert.equal(r.stderr, '');
    const lines = r.stdout.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    // The six normal lines are always compared exactly; the machine-dependent pair is masked only for a versioned Node.
    assert.deepEqual(withoutNodeNote(lines, VERSIONED_NODE), INSTALL_TRANSCRIPT);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('withoutNodeNote masks exactly the Node and Note pair, and only for a versioned Node', () => {
  const plain = ['✓ ampline-claude installed.', '', 'Restart Claude Code or start a new session.'];
  const node = '  Node: /home/you/.nvm/versions/node/v24.1.0/bin/node';
  const withPair = [plain[0], node, NOTE_LINE, ...plain.slice(1)];
  const mask = (lines) => withoutNodeNote(lines, true);
  assert.deepEqual(mask(plain), plain, 'a normal install is untouched');
  assert.deepEqual(mask(withPair), plain, 'the pair is removed');
  assert.deepEqual(mask([plain[0], '  Node: C:/Users/you/.nvm/v24.1.0/node.exe', NOTE_LINE, ...plain.slice(1)]), plain, 'a Windows path is fine');
  assert.throws(() => mask([plain[0], node, ...plain.slice(1)]), /pair/, 'a Node line alone is not tolerated');
  assert.throws(() => mask([plain[0], NOTE_LINE, ...plain.slice(1)]), /pair/, 'a Note line alone is not tolerated');
  assert.throws(() => mask([plain[0], node, NOTE_LINE, node, NOTE_LINE, ...plain.slice(1)]), /at most one/);
  assert.throws(() => mask([plain[0], plain[1], node, NOTE_LINE, plain[2]]), /right after the first line/);
  assert.throws(() => mask([plain[0], '  Node: node', NOTE_LINE, ...plain.slice(1)]), /absolute path/, 'the bare-node fallback is not masked');
  assert.deepEqual(mask([...withPair, 'Previous settings backed up']), [...plain, 'Previous settings backed up'],
    'unrelated extra lines are left in, so the comparison still fails on them');
  // Not a versioned Node: nothing is masked, so a note on every install would fail the transcript comparison.
  assert.deepEqual(withoutNodeNote(withPair, false), withPair);
  assert.notDeepEqual(withoutNodeNote(withPair, false), plain);
});

test('this machine: the masking decision follows isVersionedNodePath from the installer itself', () => {
  assert.equal(typeof VERSIONED_NODE, 'boolean');
  assert.equal(installer.isVersionedNodePath('/home/you/.nvm/versions/node/v24.1.0/bin/node'), true);
  assert.equal(installer.isVersionedNodePath('/usr/bin/node'), false);
});
