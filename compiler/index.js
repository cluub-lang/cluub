// Public compiler API. Pure and browser-safe: give it sources, get JS + diagnostics.
import { parse } from './parser.js';
import { check } from './checker.js';
import { generate } from './codegen.js';
import { Reporter, CluubError, formatDiagnostic, CODES } from './diagnostics.js';

export { formatDiagnostic, CODES };
export { generateTests } from './testgen.js';
export { explain } from './explain.js';

// files: { "models/todo.clb": "model Todo ...", ... }
export function compile(files, opts = {}) {
  const started = (globalThis.performance ?? Date).now();
  const rep = new Reporter();
  const programs = [];
  const failed = []; // declarations that could not be parsed
  for (const [file, src] of Object.entries(files)) {
    try {
      const prog = parse(src, file);
      programs.push(prog);
      for (const d of prog.errors) rep.error(d);
      failed.push(...prog.failed);
    }
    catch (e) {
      if (e instanceof CluubError) rep.error({ ...e.diag, file: e.diag.file || file });
      else throw e;
    }
  }
  const decls = programs.flatMap((p) => p.decls);
  const apps = decls.filter((d) => d.kind === 'App');
  if (apps.length > 1) rep.error({ code: 'E101', message: 'Only one `app` declaration is allowed per project.', file: apps[1].file, line: apps[1].line, col: apps[1].col, hint: 'Keep a single `app` in app.clb.' });
  check(programs, rep, opts);
  // Don't pile "unknown name" errors on top of a declaration that failed to parse.
  if (failed.length) rep.items = rep.items.filter((d) => !(['E104', 'E105', 'E106', 'E116'].includes(d.code) && failed.some((n) => d.message.includes(`"${n}"`))));

  const result = {
    ok: !rep.hasErrors,
    diagnostics: rep.items.sort((a, b) => (a.file || '').localeCompare(b.file || '') || (a.line || 0) - (b.line || 0)),
    decls, app: apps[0] || null, sources: files,
  };
  if (result.ok) Object.assign(result, generate(decls, apps[0]));
  result.ms = Math.round(((globalThis.performance ?? Date).now() - started) * 10) / 10;
  return result;
}

export function formatAll(diags, sources, color = false) {
  return diags.map((d) => formatDiagnostic(d, sources, color)).join('\n');
}
