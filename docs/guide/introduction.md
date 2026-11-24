# Why Cluub

Today a web feature means learning JavaScript, TypeScript, React, a router, a state library, an HTTP framework, an ORM, a validation library, a test runner and an AI SDK, and then wiring them together. Every team wires them differently, and AI tools copy whichever style they saw last.

**Cluub is one small language that covers all of it.** You describe *what* the feature is; Cluub produces the frontend, the backend and the tests.

## Why the name Cluub

**Cluub** *clubs together* the three things every modern app needs: the **frontend**, the **backend** and **AI**. Instead of three languages, three frameworks and the glue between them, you write one structured language and Cluub builds all three.

The logo hides a small joke: the **uu** in the middle of *cluub* becomes a cat's smile, **ω**. Friendly, curious and quick is how Cluub should feel. See [Brand & logo](/brand).

Cluub files end in **`.clb`**, the command is **`cluub`**, the code lives at **[github.com/cluub-lang/cluub](https://github.com/cluub-lang/cluub)** and these docs at **[cluub-lang.github.io](https://cluub-lang.github.io/)**.

## Principles

1. **Reads like a prompt.** Words instead of symbols: `is not empty`, `ask ai`, `on click save`. If you can write a clear request to an AI assistant, you can read Cluub.
2. **One way to do things.** One folder layout, one layer architecture, one naming style, all enforced by the compiler. Code written by a senior developer, a junior, a product owner or an AI looks the same.
3. **Safe by default.** Data is validated at every boundary, secrets can't reach the browser, and errors are precise with a hint to fix them.
4. **AI-native.** AI calls, structured AI output and AI-written code are first-class, and the compiler checks AI-written code like any other.
5. **Zero dependencies.** Your app doesn't need `npm install`. The output is plain JavaScript.

## What you get in the box

| You'd normally need | Cluub |
|---|---|
| React / Vue + router + state lib | `page`, `component`, `layout`, `state` |
| Express / Fastify + validation | `api` with typed, validated parameters |
| ORM / repository layer | `store` (memory or file today, databases on the roadmap) |
| Axios / fetch wrappers | `client` (network layer) |
| OpenAI / Anthropic SDKs | `ask ai` for Claude, OpenAI, Gemini and Ollama |
| Jest / Vitest / Playwright | `test`, plus automatically generated tests |
| Docs for non-developers | `cluub explain --for po|ba|qa|dev` |

## Shorter learning curve than React

To be productive in React you need JSX, hooks and their rules, effects, props vs state, a router, data fetching, async/await, a bundler and TypeScript. In Cluub, a beginner learns **6 ideas**: `model`, `service`, `api`, `page`, `state` + `action`, and `view`. Everything else (awaiting, re-rendering, validation, error display, wiring dependencies) is automatic.

## SOLID, OOP and design patterns, built in

You don't have to remember them, because the structure applies them for you:

| Principle / pattern | How Cluub applies it |
|---|---|
| **Single Responsibility** | Each declaration kind does one job; warnings W102/W103 flag oversized actions and services |
| **Open/Closed** | Add behavior by adding services or components, not by editing others |
| **Liskov / Interface Segregation** | Small typed actions; `uses` names the exact dependencies |
| **Dependency Inversion** | `uses` declares dependencies; a container injects them, and tests swap in fakes (in-memory stores, fake AI) |
| **Encapsulation (OOP)** | Models validate themselves; services hide stores from apis and pages |
| **Repository pattern** | `store` |
| **Service layer / Facade** | `service` |
| **Adapter / Gateway** | `client`, and the AI provider abstraction |
| **MVC / MVVM** | `model` + `page` state/actions + `view` |
| **Container / Presentational** | Pages own data; components only display it (`takes`) |
| **Observer** | Reactive state: change it and the view updates |
| **Strategy** | `ask ai ... using "openai"` swaps providers without code changes |
| **Composite** | Layouts, pages and components nest |
