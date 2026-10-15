import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALL_TRANSCRIPT } from '../site/js/install-demo.js';

// The install demo's terminal output is the one hand-copied block on the site (DECISIONS.md D21). This runs the
// real installer from the pinned devDependency, in a throwaway home, and requires its stdout to match the copy.
// A version bump that changes the installer's output fails here and forces a re-capture.
const BIN = fileURLToPath(new URL('../node_modules/ampline-claude/bin/ampline-claude.js', import.meta.url));

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
    assert.deepEqual(lines, INSTALL_TRANSCRIPT);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
