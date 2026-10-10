// Demo payloads in Claude Code's statusline shape. Reset times are computed from `now`
// at render time: fixed epochs go stale and silently drop the ↺ countdown.
export const FAMILIES = ['haiku', 'sonnet', 'opus', 'fable'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const MODEL_NAMES = {
  haiku: { id: 'claude-haiku-5-5', name: 'Haiku 5.5' },
  sonnet: { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5' },
  opus: { id: 'claude-opus-5-5', name: 'Opus 5.5' },
  fable: { id: 'claude-fable-5-1', name: 'Fable 5.1' },
};

export const HERO_CYCLE = [
  ['opus', 'xhigh'], ['haiku', 'medium'], ['sonnet', 'high'], ['fable', 'max'], ['opus', 'high'], ['sonnet', 'max'],
];

export function wheelIndex(family, effort) {
  const f = FAMILIES.indexOf(family);
  if (f < 0) return -1;
  const e = effort ? EFFORTS.indexOf(effort) : (family === 'haiku' ? 4 : 2);
  return f * 5 + (e < 0 ? 2 : e);
}

export function statusPayload({
  family = 'opus', effort = 'xhigh', context = 63, fiveHour = 24, weekly = 41,
  rateLimits = true, pr = { number: 1234, review_state: 'approved' },
  git = { branch: 'feat/cache-layer', ahead: 2, behind: 1, dirty: true },
  task = 'Refactor the bar renderer', cost = 1.87, added = 156, removed = 23,
  now = Date.now(),
} = {}) {
  const s = Math.floor(now / 1000);
  const m = MODEL_NAMES[family];
  const input = {
    workspace: { current_dir: '/home/you/widgets', repo: { name: 'widgets' } },
    model: { id: m.id, display_name: m.name },
    context_window: { used_percentage: context },
    cost: { total_cost_usd: cost, total_lines_added: added, total_lines_removed: removed },
    __demo: { git, task },
  };
  if (effort) input.effort = { level: effort };
  if (rateLimits) {
    input.rate_limits = {
      five_hour: { used_percentage: fiveHour, resets_at: s + 2 * 3600 + 13 * 60 + 30 },
      seven_day: { used_percentage: weekly, resets_at: s + 3 * 86400 + 4 * 3600 + 30 },
    };
  }
  if (pr) {
    const url = pr.kind === 'mr'
      ? `https://gitlab.com/acme/widgets/-/merge_requests/${pr.number}`
      : `https://github.com/acme/widgets/pull/${pr.number}`;
    input.pr = { url, ...pr };
  }
  return input;
}

export function subagentPayload({ columns = 100 } = {}) {
  return {
    columns,
    tasks: [
      { status: 'running', label: 'Explore the cache layer', model: 'claude-haiku-5-5', tokenCount: 8421 },
      { status: 'running', label: 'Review the diff', model: 'claude-sonnet-5-5', tokenCount: 120400 },
      { status: 'queued', label: 'Write tests', model: 'claude-opus-5-5' }, // not started yet: no tokens
    ],
  };
}
