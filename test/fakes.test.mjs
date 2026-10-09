import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAmpline } from '../site/js/runtime/ampline.js';

const amp = createAmpline({ columns: 200 });
const cfg = amp.getConfig();
const git = (g) => amp._fakes.git.renderGitSegment({ input: { __demo: { git: g } }, config: cfg });
const task = (t) => amp._fakes.task.renderTaskSegment({ input: { __demo: { task: t } }, config: cfg });

test('git: long branch, ahead 2, behind 1, dirty === real binary bytes', () => {
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

test('task: short and truncated-at-40 === real binary bytes', () => {
  assert.equal(task('Refactor the bar renderer'), '\u001b[2mRefactor the bar renderer\u001b[0m');
  assert.equal(task('Wiring up the parser for the new payload shape'),
    '\u001b[2mWiring up the parser for the new payloa…\u001b[0m');
});

test('task: control characters are stripped (sanitize)', () => {
  assert.equal(task('evil\u001b[31mred'), '\u001b[2mevil[31mred\u001b[0m');
});
