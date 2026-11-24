#!/usr/bin/env node
// Entry point. Kept deliberately simple so even old Node versions can run it
// and print a clear message instead of a syntax error.
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`Cluub needs Node.js 18 or newer, but this is Node ${process.versions.node}.\nInstall a newer version from https://nodejs.org (or run: nvm install 22 && nvm use 22), then try again.`);
  process.exit(1);
}
import('./main.js');
