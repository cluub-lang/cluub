import DefaultTheme from 'vitepress/theme';
import { useRoute, withBase } from 'vitepress';
import { onMounted, watch, nextTick } from 'vue';
import Playground from './Playground.vue';
import './custom.css';

// Adds a "Run in playground" button to every ```cluub sample that compiles on
// its own. Samples that depend on code shown elsewhere get no button, so the
// button never leads to an error.
async function addPlaygroundButtons() {
  const blocks = document.querySelectorAll('div.language-cluub:not([data-cluub-checked])');
  if (!blocks.length) return;
  const { compile } = await import('../../../compiler/index.js');
  for (const block of blocks) {
    block.setAttribute('data-cluub-checked', '');
    const code = block.querySelector('pre code')?.innerText;
    if (!code || !compile({ 'main.clb': code }).ok) continue;
    const a = document.createElement('a');
    a.className = 'cluub-try';
    a.textContent = '▶ Run in playground';
    a.href = withBase('/playground') + '#code=' + btoa(unescape(encodeURIComponent(code)));
    a.setAttribute('aria-label', 'Open this example in the playground');
    block.appendChild(a);
  }
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) { app.component('Playground', Playground); },
  setup() {
    const route = useRoute();
    const run = () => nextTick(() => setTimeout(addPlaygroundButtons, 0));
    onMounted(run);
    watch(() => route.path, run);
  },
};
