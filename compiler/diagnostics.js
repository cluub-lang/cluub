// Diagnostics: every problem Cluub reports has a code, an exact location,
// a plain-English message and (almost always) a hint telling you how to fix it.

export class CluubError extends Error {
  constructor(diag) {
    super(diag.message);
    this.diag = { severity: 'error', ...diag };
  }
}

export class Reporter {
  constructor() { this.items = []; }
  error(d) { this.items.push({ severity: 'error', ...d }); }
  warn(d) { this.items.push({ severity: 'warning', ...d }); }
  hint(d) { this.items.push({ severity: 'hint', ...d }); }
  get errors() { return this.items.filter((d) => d.severity === 'error'); }
  get hasErrors() { return this.errors.length > 0; }
}

// Levenshtein distance, used for "did you mean ...?" suggestions.
export function distance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  return dp[m][n];
}

export function suggest(name, candidates) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = distance(name, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best && bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

const COLORS = { error: '\x1b[31m', warning: '\x1b[33m', hint: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };

// Pretty, Elm-style rendering with a code frame and a caret under the problem.
export function formatDiagnostic(d, sources = {}, color = false) {
  const c = color ? COLORS : Object.fromEntries(Object.keys(COLORS).map((k) => [k, '']));
  const label = { error: 'error', warning: 'warning', hint: 'suggestion' }[d.severity] || d.severity;
  const loc = d.file ? `${d.file}:${d.line ?? '?'}:${d.col ?? '?'}` : '';
  let out = `${c[d.severity]}${c.bold}${label} ${d.code}${c.reset} ${c.dim}${loc}${c.reset}\n  ${d.message}\n`;
  const src = sources[d.file];
  if (src && d.line) {
    const lines = src.split('\n');
    const from = Math.max(1, d.line - 1);
    for (let ln = from; ln <= d.line; ln++) {
      const text = lines[ln - 1] ?? '';
      out += `${c.dim}${String(ln).padStart(4)} |${c.reset} ${text}\n`;
    }
    const caretLen = Math.max(1, d.length || 1);
    out += `${c.dim}     |${c.reset} ${' '.repeat(Math.max(0, (d.col || 1) - 1))}${c[d.severity]}${'^'.repeat(caretLen)}${c.reset}\n`;
  }
  if (d.hint) out += `  ${c.hint}hint:${c.reset} ${d.hint}\n`;
  return out;
}

// Catalogue of every diagnostic. Used by the docs and by `cluub explain-error`.
export const CODES = {
  E001: 'Tabs used for indentation',
  E002: 'Indentation step is not 2 spaces',
  E003: 'Indentation does not line up with an outer block',
  E004: 'Unterminated text',
  E005: 'Unexpected character',
  E006: 'Symbol operator used where Cluub uses a word',
  E010: 'Unexpected token / syntax error',
  E011: 'Unknown top-level declaration',
  E012: 'Unknown member inside a declaration',
  E013: 'Unknown view element',
  E101: 'Duplicate declaration',
  E102: 'Declaration name must be PascalCase',
  E103: 'Field, action, state or parameter name must be camelCase',
  E104: 'Unknown dependency in `uses`',
  E105: 'Unknown name',
  E106: 'Dependency used without `uses`',
  E107: 'Unknown action, route or store method',
  E108: 'Wrong arguments in a call',
  E109: 'Unknown model field',
  E110: 'Assignment to a name that was never created',
  E111: 'Name created twice in the same block',
  E112: '`input`/`checkbox` must be bound to state',
  E113: 'Event handler must be an action call',
  E114: 'Wrong component properties',
  E115: 'Duplicate route or action name',
  E116: 'Unknown layout',
  E117: 'Api or action called while a view is drawn',
  E120: 'Test-only statement used outside a test',
  E201: 'Layer rule violated',
  E202: 'Circular dependency between services',
  E203: 'Components and layouts cannot use dependencies',
  E204: 'AI called from the UI layer',
  E205: 'Environment secret read from the UI layer',
  E301: 'Declaration is in the wrong folder',
  E401: 'Hard-coded secret detected',
  W101: 'Unused dependency',
  W102: 'Action is too long (Single Responsibility)',
  W103: 'Service has too many actions (Single Responsibility / Interface Segregation)',
  W104: 'Missing `about` description',
  W105: 'State is never used',
  W106: 'Page has no view',
  W107: 'Layout without exactly one slot',
  W108: 'Unknown app setting',
};
