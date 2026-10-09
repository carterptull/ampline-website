// Browser stand-ins for the two segments that need fs/child_process.
// Output format is copied from lib/segments/git.js and lib/segments/task.js;
// test/fakes.test.mjs pins it to bytes captured from the real binary.
export function makeFakeGit({ DIM, RESET, fg, sanitize }) {
  function truncate(name, max) {
    const limit = Number.isFinite(max) && max > 4 ? max : 24;
    const chars = Array.from(name);
    return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : name;
  }
  return {
    renderGitSegment(ctx) {
      try {
        const g = ctx && ctx.input && ctx.input.__demo && ctx.input.__demo.git;
        if (!g || !g.branch) return null;
        const raw = sanitize(String(g.branch));
        if (!raw) return null;
        const branch = truncate(raw, ctx.config && ctx.config.maxBranchLength);
        let sync = '';
        if (g.ahead) sync += `${fg(96, 200, 120)}↑${g.ahead}${RESET}`;
        if (g.behind) sync += `${fg(232, 67, 61)}↓${g.behind}${RESET}`;
        const marker = g.dirty ? ` ${fg(245, 196, 61)}●${RESET}` : ` ${fg(96, 200, 120)}✓${RESET}`;
        return `${DIM}⎇ ${branch}${RESET}${sync ? ' ' + sync : ''}${marker}`;
      } catch { return null; }
    },
  };
}

export function makeFakeTask({ DIM, RESET, sanitize }) {
  return {
    renderTaskSegment(ctx) {
      try {
        const t = ctx && ctx.input && ctx.input.__demo && ctx.input.__demo.task;
        if (!t || typeof t !== 'string') return null;
        const config = (ctx && ctx.config) || {};
        const clean = sanitize(t);
        const limit = Number.isFinite(config.maxTaskLength) && config.maxTaskLength > 4 ? config.maxTaskLength : 40;
        const chars = Array.from(clean);
        const shown = chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : clean;
        return `${DIM}${shown}${RESET}`;
      } catch { return null; }
    },
  };
}
