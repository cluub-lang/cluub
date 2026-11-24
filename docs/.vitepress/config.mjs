import { defineConfig } from 'vitepress';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
// '/' for local development; the Docs workflow builds with DOCS_BASE=/home/ for https://cluub-lang.github.io/home/
const base = process.env.DOCS_BASE || '/';
const cluubGrammar = JSON.parse(readFileSync(path.resolve(here, '../../editors/cluub.tmLanguage.json'), 'utf8'));

export default defineConfig({
  title: 'Cluub',
  description: 'One structured, AI-native language for frontend and backend.',
  base,
  cleanUrls: true,
  ignoreDeadLinks: 'localhostLinks',
  lastUpdated: false,
  head: [
    ['meta', { name: 'theme-color', content: '#0072B2' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { property: 'og:title', content: 'Cluub: one language for frontend, backend and AI' }],
    ['meta', { property: 'og:image', content: 'https://cluub-lang.github.io/home/logo-full.svg' }],
  ],
  sitemap: { hostname: 'https://cluub-lang.github.io/home/' },
  markdown: { languages: [cluubGrammar] },
  vite: { server: { fs: { allow: [path.resolve(here, '../..')] } } },
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-dark.svg', alt: 'Cluub logo' },
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Tutorial', link: '/tutorial/', activeMatch: '/tutorial/' },
      { text: 'Cookbook', link: '/cookbook/', activeMatch: '/cookbook/' },
      { text: 'Reference', link: '/reference/language', activeMatch: '/reference/' },
      { text: 'Playground', link: '/playground' },
      { text: 'FAQ', link: '/faq' },
      { text: 'More', items: [
        { text: 'Brand & logo', link: '/brand' },
        { text: 'Glossary', link: '/glossary' },
        { text: 'Changelog', link: '/changelog' },
        { text: 'Contributing', link: '/contributing' },
      ] },
    ],
    sidebar: {
      '/tutorial/': [
        { text: 'Tutorial: AI helpdesk', items: [
          { text: 'Overview', link: '/tutorial/' },
          { text: '1. Create the project', link: '/tutorial/01-setup' },
          { text: '2. The Ticket model', link: '/tutorial/02-ticket-model' },
          { text: '3. A store and a service', link: '/tutorial/03-store-and-service' },
          { text: '4. The api', link: '/tutorial/04-api' },
          { text: '5. Pages, components, layout', link: '/tutorial/05-pages-and-components' },
          { text: '6. AI features', link: '/tutorial/06-ai-features' },
          { text: '7. Testing', link: '/tutorial/07-testing' },
          { text: '8. Share and ship', link: '/tutorial/08-share-and-ship' },
        ] },
      ],
      '/cookbook/': [
        { text: 'Cookbook', items: [{ text: 'All recipes', link: '/cookbook/' }] },
        { text: 'Data & forms', items: [
          { text: 'Forms with validation', link: '/cookbook/forms-validation' },
          { text: 'CRUD list', link: '/cookbook/crud-list' },
          { text: 'Search and filtering', link: '/cookbook/search-filter' },
          { text: 'Master–detail pages', link: '/cookbook/master-detail' },
          { text: 'Pagination', link: '/cookbook/pagination' },
          { text: 'Persisting to a JSON file', link: '/cookbook/json-file-store' },
          { text: 'Calling an external API', link: '/cookbook/external-api' },
        ] },
        { text: 'AI', items: [
          { text: 'Summarizing text', link: '/cookbook/ai-summarize' },
          { text: 'Structured extraction', link: '/cookbook/ai-extraction' },
          { text: 'Classification', link: '/cookbook/ai-classification' },
          { text: 'A chat assistant', link: '/cookbook/chat-assistant' },
        ] },
        { text: 'UI & quality', items: [
          { text: 'Loading and empty states', link: '/cookbook/loading-empty-states' },
          { text: 'Reusable components', link: '/cookbook/reusable-components' },
          { text: 'Custom theme and styling', link: '/cookbook/theming' },
          { text: 'Error-handling patterns', link: '/cookbook/error-handling' },
        ] },
      ],
      '/reference/': [
        { text: 'Language', items: [
          { text: 'Overview', link: '/reference/language' },
          { text: 'Grammar', link: '/reference/grammar' },
          { text: 'Types & validation', link: '/reference/types' },
          { text: 'Expressions', link: '/reference/expressions' },
          { text: 'Statements', link: '/reference/statements' },
          { text: 'Built-ins', link: '/reference/builtins' },
        ] },
        { text: 'Declarations', items: [
          { text: 'app', link: '/reference/app' },
          { text: 'model', link: '/reference/model' },
          { text: 'store', link: '/reference/store' },
          { text: 'client', link: '/reference/client' },
          { text: 'service', link: '/reference/service' },
          { text: 'api', link: '/reference/api' },
          { text: 'page', link: '/reference/page' },
          { text: 'component', link: '/reference/component' },
          { text: 'layout', link: '/reference/layout' },
          { text: 'test', link: '/reference/test' },
        ] },
        { text: 'UI', items: [
          { text: 'View elements', link: '/reference/view-elements' },
          { text: 'Properties & events', link: '/reference/properties-events' },
        ] },
        { text: 'AI & errors', items: [
          { text: 'ask ai', link: '/reference/ask-ai' },
          { text: 'Runtime errors', link: '/reference/runtime-errors' },
          { text: 'Error codes', link: '/reference/errors' },
        ] },
        { text: 'Tools', items: [
          { text: 'CLI', link: '/reference/cli' },
          { text: 'Status & roadmap', link: '/reference/roadmap' },
        ] },
      ],
      '/': [
        { text: 'Start here', items: [
          { text: 'Why Cluub', link: '/guide/introduction' },
          { text: 'Install & first app', link: '/guide/install' },
          { text: '10-minute tour', link: '/guide/tour' },
          { text: 'Full tutorial →', link: '/tutorial/' },
        ] },
        { text: 'Build', items: [
          { text: 'Project structure & layers', link: '/guide/structure' },
          { text: 'Models & data', link: '/guide/data' },
          { text: 'Services & APIs', link: '/guide/backend' },
          { text: 'Pages & components', link: '/guide/frontend' },
          { text: 'AI', link: '/guide/ai' },
          { text: 'Your own AI keys', link: '/guide/ai-keys' },
        ] },
        { text: 'Quality', items: [
          { text: 'Automatic tests', link: '/guide/testing' },
          { text: 'Testing strategy (QA)', link: '/guide/testing-strategy' },
          { text: 'Errors & suggestions', link: '/guide/errors' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        ] },
        { text: 'Production', items: [
          { text: 'Deployment', link: '/guide/deployment' },
          { text: 'Security', link: '/guide/security' },
          { text: 'Performance', link: '/guide/performance' },
          { text: 'Accessibility', link: '/guide/accessibility' },
        ] },
        { text: 'Teams', items: [
          { text: 'POs, BAs, QAs & AI', link: '/guide/team' },
          { text: 'Voice coding', link: '/guide/voice' },
        ] },
        { text: 'More', items: [
          { text: 'FAQ', link: '/faq' },
          { text: 'Glossary', link: '/glossary' },
          { text: 'Changelog', link: '/changelog' },
          { text: 'Contributing', link: '/contributing' },
          { text: 'Brand & logo', link: '/brand' },
        ] },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/cluub-lang/cluub' }],
    editLink: { pattern: 'https://github.com/cluub-lang/cluub/edit/main/docs/:path', text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: { message: 'MIT licensed · zero dependencies · bring your own AI key', copyright: 'Cluub 0.1 (prototype)' },
  },
});
