// Creates a new Cluub project from a template. Shared by `cluub new` and
// `npm create cluub` (the create-cluub package).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = JSON.parse(fs.readFileSync(path.join(HOME, 'package.json'), 'utf8')).version;
export const TEMPLATES = {
  app: 'Full-stack todos: layout, components, file storage, AI summary, tests',
  'ai-chat': 'An AI chat assistant with memory and structured AI output',
  blank: 'The folder structure and one page',
};

export function validateName(name) {
  if (!name) return 'Give your project a name, e.g. my-app.';
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(name)) return 'Project names can use letters, numbers, - and _ (and must start with a letter or number).';
  return null;
}

export function createProject(name, { template = 'app', cwd = process.cwd() } = {}) {
  const problem = validateName(name);
  if (problem) throw new Error(problem);
  const src = path.join(HOME, 'templates', template);
  if (!TEMPLATES[template] || !fs.existsSync(src)) throw new Error(`Unknown template "${template}". Available: ${Object.keys(TEMPLATES).join(', ')}.`);
  const dest = path.resolve(cwd, name);
  if (fs.existsSync(dest) && fs.readdirSync(dest).length) throw new Error(`The folder "${name}" already exists and is not empty.`);
  const appName = name.replace(/(^|[-_])(\w)/g, (_, __, ch) => ch.toUpperCase()).replace(/^[^A-Za-z]+/, 'App');
  const copy = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name);
      const b = path.join(to, e.name === '_gitignore' ? '.gitignore' : e.name === '_env.example' ? '.env.example' : e.name);
      if (e.isDirectory()) copy(a, b);
      else fs.writeFileSync(b, fs.readFileSync(a, 'utf8').replaceAll('{{AppName}}', appName).replaceAll('{{name}}', name));
    }
  };
  copy(src, dest);
  // package.json, so `npm install` + `npm run dev` work without a global install.
  fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({
    name: name.toLowerCase(), private: true, type: 'module',
    scripts: { dev: 'cluub dev', test: 'cluub test', build: 'cluub build', start: 'cluub start', check: 'cluub check' },
    devDependencies: { cluub: `^${VERSION}` },
  }, null, 2) + '\n');
  // Claude skills and project rules, so every developer and AI tool works the same way.
  const skills = path.join(HOME, 'skills');
  if (fs.existsSync(skills)) fs.cpSync(skills, path.join(dest, '.claude', 'skills'), { recursive: true });
  fs.writeFileSync(path.join(dest, 'CLAUDE.md'), `# ${appName}: guide for Claude and other AI assistants

This is a Cluub app (\`.clb\` files). Language reference: https://cluub-lang.github.io/reference/language

## Rules
- Follow the folder layout and layers: page -> api -> service -> store / client / ai.
- Run \`cluub check\` (no errors) and \`cluub test\` (all pass) after every change.
- Every business rule and bug fix gets a test in \`tests/\`; never edit \`tests/generated/\`.
- Never put API keys in code; use \`cluub ai set <provider>\`.
- Commit messages follow Conventional Commits; don't push or open PRs without being asked.

## Skills
Use the skills in \`.claude/skills/\`: cluub-feature, cluub-backend, cluub-frontend, cluub-naming, cluub-tests,
cluub-code-review, cluub-review-pr, cluub-fix-issue, cluub-security, cluub-accessibility, cluub-debug.
`);
  const gi = path.join(dest, '.gitignore');
  const ignore = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^node_modules\/?$/m.test(ignore)) fs.writeFileSync(gi, ignore + 'node_modules/\n');
  return { dest, appName, template };
}
