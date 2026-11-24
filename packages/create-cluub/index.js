#!/usr/bin/env node
// npm create cluub@latest [name] [--template app|ai-chat|blank]
// Also works with: pnpm create cluub, yarn create cluub, bun create cluub.
import { stdin, stdout, argv, env, exit, versions } from 'node:process';

// Check the Node version before loading anything that needs a modern Node.
if (Number(versions.node.split('.')[0]) < 18) {
  console.error(`Cluub needs Node.js 18 or newer, but this is Node ${versions.node}.\nInstall a newer version from https://nodejs.org (or run: nvm install 22 && nvm use 22), then try again.`);
  exit(1);
}
const readline = await import('node:readline/promises');
const { createProject, validateName, TEMPLATES, VERSION } = await import('cluub/new');

const useColor = stdout.isTTY && !env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint(1), dim = paint(2), green = paint(32), cyan = paint(36), red = paint(31);

const args = argv.slice(2);
let name = args.find((a) => !a.startsWith('-'));
const tIndex = args.findIndex((a) => a === '--template' || a === '-t');
let template = tIndex >= 0 ? args[tIndex + 1] : (args.find((a) => a.startsWith('--template=')) || '').split('=')[1];

const pm = (env.npm_config_user_agent || 'npm').split('/')[0];
const run = (script) => (pm === 'npm' ? `npm run ${script}` : `${pm} ${script}`);

async function main() {
  console.log(`\n${bold('Cluub')} ${dim(`v${VERSION}`)}: one language for frontend, backend and AI\n`);
  const interactive = stdin.isTTY && stdout.isTTY;
  const rl = interactive ? readline.createInterface({ input: stdin, output: stdout }) : null;
  try {
    while (!name || validateName(name)) {
      if (name) console.log(red(`  ${validateName(name)}`));
      if (!rl) { name = name && !validateName(name) ? name : 'my-cluub-app'; break; }
      name = (await rl.question(`${cyan('?')} Project name ${dim('(my-cluub-app)')}: `)).trim() || 'my-cluub-app';
    }
    if (!template) {
      const keys = Object.keys(TEMPLATES);
      if (rl) {
        console.log(`${cyan('?')} Pick a template:`);
        keys.forEach((k, i) => console.log(`  ${bold(String(i + 1))}. ${k.padEnd(8)} ${dim(TEMPLATES[k])}`));
        const answer = (await rl.question(`  Number ${dim('(1)')}: `)).trim() || '1';
        template = keys[Number(answer) - 1] || (keys.includes(answer) ? answer : 'app');
      } else template = 'app';
    }
  } finally { rl?.close(); }

  const { dest } = createProject(name, { template });
  console.log(`\n${green('✓')} Created ${bold(name)} with the ${cyan(template)} template in ${dim(dest)}\n`);
  console.log(`Next steps:\n\n  cd ${name}\n  ${pm} install\n  ${run('dev')}\n`);
  console.log(`Then open ${cyan('http://localhost:3000')}. Edit any .clb file and the page reloads.`);
  if (template !== 'blank') console.log(`AI features use ${bold('your own key')}: ${cyan('npx cluub ai set claude')} (or openai / gemini).`);
  console.log(`\nDocs: ${cyan('https://cluub-lang.github.io/')}\n`);
}

main().catch((e) => { console.error(red(`✗ ${e.message}`)); exit(1); });
