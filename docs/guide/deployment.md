# Deployment

This page covers running a Cluub app outside your laptop: what `cluub build` produces, how to start it, where configuration and data live, and how to put it behind a reverse proxy, a process manager or a container. Cluub 0.1 is a prototype, so the last section lists the limits you should know before you deploy anything people depend on.

## What `cluub build` produces

`cluub build` compiles the project, stops with exit code 1 if there is any error, and writes a fresh `dist/` folder (the old one is deleted first). This is the real output for the `app` template:

```text
dist/
├── start.mjs                      entry point: node dist/start.mjs
├── server.js                      your models, stores, services and apis
├── runtime/                       node.js, core.js, ai.js, errors.js, messages.js
├── compiler/diagnostics.js        "did you mean" hints used by the runtime
└── public/                        everything the browser can download
    ├── index.html                 page shell (no inline script)
    ├── assets/                    copy of your assets/ folder and theme.css (if present)
    └── _cluub/
        ├── boot.js                starts the client
        ├── app.client.js          your pages, components, layouts and api client
        ├── theme.css              the built-in theme
        ├── runtime/               client.js, core.js, errors.js, messages.js, ai.js
        └── compiler/diagnostics.js
```

The whole `dist/` folder is 144 KB on disk. The browser downloads 10 files, about 51 KB uncompressed, with no minification or bundling.

**`dist/` is standalone.** It contains its own copy of the runtime, so a server only needs Node.js 18 or newer, not the Cluub toolchain:

```bash
node dist/start.mjs
```

`dist/start.mjs` treats the folder *above* `dist/` as the project root: `.env` and file stores (`storage/...`) are read from there. To ship only the build, copy `dist/` into an empty folder and run it from there. The [Docker example](#docker) does exactly this.

`cluub dev` writes to the same `dist/` folder, adding live reload. Run `cluub build` before deploying, so you don't ship a dev build.

## Starting the server

```bash
cluub start                 # inside the project, with the toolchain installed
cluub start --port 8080
PORT=8080 node dist/start.mjs
```

The port comes from `--port` (only for `cluub start`), then the `PORT` environment variable, then the `port` setting in `app.clb`, then 3000. `PORT` must be set in the real process environment; a `PORT` line in `.env` isn't used for the port.

The server:

* answers your api routes (JSON in, JSON out),
* serves files from `dist/public/`,
* returns `index.html` with status 200 for any other path, so client-side routes like `/about` work on reload,
* listens on all network interfaces. There is no option to bind to `127.0.0.1` only, so use a firewall when a proxy sits in front.

Production mode simply means `cluub start` or `node dist/start.mjs` instead of `cluub dev`. `NODE_ENV` isn't used.

## Environment variables and `.env`

On startup the server reads `.env` from the project root and merges it with the process environment. **Real environment variables win** over `.env` lines with the same name, so a value set by systemd, Docker or your platform always takes effect. Services read these values with `env.NAME`, and the AI providers use them too.

| Variable | Used for |
|---|---|
| `PORT` | server port (process environment only) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | AI providers |
| `CLUUB_AI` | default provider. It beats the `ai` line in `app.clb`, so you can switch providers per environment |
| `CLUUB_CLAUDE_MODEL`, `CLUUB_OPENAI_MODEL`, `CLUUB_GEMINI_MODEL`, `CLUUB_OLLAMA_MODEL` | default model per provider |
| `OLLAMA_HOST` | Ollama address, default `http://localhost:11434` |
| `NO_COLOR` | plain output for the CLI and the server log |
| `CLUUB_DEBUG` | print a stack trace when a CLI command fails |

The `.env` format:

```ini
# Lines starting with # are ignored
ANTHROPIC_API_KEY=sk-ant-...
export CLUUB_AI=claude          # "export" is allowed, and so are comments after unquoted values
GREETING="Hello # not a comment"
```

Quotes around a whole value are removed, and everything inside the quotes is kept. In production, prefer real environment variables (systemd `Environment=`, Docker `-e`, your platform's secret store). The templates list `.env` in `.gitignore`.

## Data: file stores and backups

A store declared with `saved in` writes a JSON file **relative to the project root**:

```cluub
store Todos holds Todo saved in "storage/todos.json"
```

How the file store works:

* Every file store is loaded **when the server starts**, and every record is validated against the model. A broken file, or a record that no longer matches the model, stops startup with `✗ Could not load storage/todos.json for store Todos: <reason>. Fix the file, or move it away to start empty.`
* All records stay in memory. Every write rewrites the whole file: first to `todos.json.tmp`, then an atomic rename over `todos.json`. A crash can leave a stray `.tmp` file, but never a half-written `todos.json`.
* Changes you make to the file while the server runs are ignored, and the next write overwrites them.

**Backups.** Because writes are atomic renames, copying `storage/*.json` while the server runs gives a consistent snapshot of each file:

```bash
tar czf backup-$(date +%F).tar.gz storage/
```

To restore, stop the server, put the files back, and start it again. Each store is its own file, so a backup across several stores isn't one transaction.

**One process only.** Each server process keeps its own in-memory copy. Two processes writing the same file overwrite each other's changes, so run one instance per data folder.

## Static assets and theme.css

| You add | It is served at |
|---|---|
| `assets/logo.png` | `/assets/logo.png` |
| `theme.css` in the project root | `/assets/theme.css`, linked after the built-in theme |

Reference assets with absolute paths, for example `image "/assets/logo.png", alt "Company logo"`. Content types are set for `.html .js .mjs .css .json .svg .png .jpg .jpeg .gif .ico .webp .woff2`. Other extensions are sent as `application/octet-stream`. A missing file returns `index.html` with status 200, not a 404, so a broken image path shows up as HTML in the network tab.

The page's Content-Security-Policy only allows images from the app itself, `data:` URLs and `https:` URLs, and only styles and scripts from the app itself. Put fonts and stylesheets in `assets/` rather than loading them from a CDN.

Static files are sent with `cache-control: public, max-age=300`, so browsers may keep an old `app.client.js` for up to five minutes after a deploy. The server doesn't compress responses: put gzip in the proxy (in our test, nginx shrank `core.js` from 15,028 to 5,621 bytes).

## Health checks

There is no built-in health route. `GET /health` returns 200 with `index.html` even when the backend is broken, so don't use it. Add an api route that touches your data:

```cluub
service HealthService
  about "Tells a load balancer whether the app can read its data"
  uses Todos

  action check() -> any
    let probe = Todos.find("health-check")
    return {status: "ok", time: now(), todos: Todos.count()}
```

```cluub
api HealthApi at "/api/health"
  about "Liveness and readiness probe"
  uses HealthService

  get check at "/"
    return HealthService.check()
```

`GET /api/health` returns 200 with `{"status":"ok", ...}`, and `cluub test` generates a "responds" test for it. A broken data file already stops the server at startup, so the probe failing to connect is also a signal.

## Behind a reverse proxy (nginx)

The Cluub server already sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, and a strict Content-Security-Policy on HTML pages. It doesn't terminate HTTPS, compress responses or rate-limit. A reverse proxy covers those. We checked an earlier version of this configuration with `nginx -t` and ran it in `nginx:1.30-alpine` in front of the app: pages loaded, gzip worked, and the rate limit returned 503s after the burst.

```nginx
# /etc/nginx/conf.d/cluub.conf
limit_req_zone $binary_remote_addr zone=cluub_api:10m rate=10r/s;

upstream cluub_app {
  server 127.0.0.1:3000;
  keepalive 16;
}

server {
  listen 80;                       # add "listen 443 ssl" + certificates for HTTPS
  server_name example.com;

  client_max_body_size 1m;         # Cluub rejects bodies over 1 MB anyway
  gzip on;
  gzip_types text/css text/javascript application/javascript application/json;
  # add_header Strict-Transport-Security "max-age=31536000" always;   # once HTTPS works

  location /api/ {
    limit_req zone=cluub_api burst=20 nodelay;
    proxy_pass http://cluub_app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    proxy_pass http://cluub_app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
  }
}
```

The rate-limit block assumes your apis live under `/api/`, as in the templates. Cluub serves everything from `/`, so a path prefix like `/myapp/` would need URL rewriting and isn't supported.

## Process managers (systemd)

Neither `cluub start` nor `dist/start.mjs` restarts itself after a crash. Run it under a supervisor. This unit is an **untested example** (we didn't test on a systemd machine). Adjust the paths:

```ini
# /etc/systemd/system/my-app.service
[Unit]
Description=My Cluub app
After=network.target

[Service]
Type=simple
User=cluub
WorkingDirectory=/srv/my-app
ExecStart=/usr/bin/node /srv/my-app/dist/start.mjs
Environment=PORT=3000
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/srv/my-app/storage

[Install]
WantedBy=multi-user.target
```

Build before `systemctl restart my-app` (on a build machine or in CI, then copy `dist/`). `ProtectSystem=strict` makes everything except `storage/` read-only, which works because the server only writes store files.

## Docker

We built and ran this two-stage Dockerfile with Docker 29.8 and `node:24-alpine`. The build stage needs the Cluub toolchain. It isn't on npm yet, so first make a tarball with `npm pack` and put it next to the Dockerfile:

```bash
npm pack /path/to/cluub --pack-destination .     # creates cluub-0.1.0.tgz
```

```dockerfile
# Build stage: install the Cluub toolchain, test and build
FROM node:24-alpine AS build
WORKDIR /app
COPY cluub-0.1.0.tgz /tmp/
RUN npm install -g /tmp/cluub-0.1.0.tgz
COPY . .
RUN cluub test && cluub build

# Run stage: plain Node and the built app only
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN mkdir -p storage && chown node:node storage
VOLUME ["/app/storage"]
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/start.mjs"]
```

```text
# .dockerignore
dist
storage
.env
node_modules
tests/generated
```

```bash
docker build -t my-app .
docker run -d --init -p 3000:3000 -v my-app-data:/app/storage -e ANTHROPIC_API_KEY=... my-app
```

The image was 239 MB, almost all of it the Node base image, and the running container used 21 MiB according to `docker stats`. Data written through the api survived removing and recreating the container. Use `--init` (or `init: true` in Compose): without it, `docker stop` took 4 seconds in our test, and with it, under 1 second. The build fails if any test fails, so the image doubles as a quality gate.

## Limits

| Limit | Detail |
|---|---|
| Request body | 1,000,000 bytes per api request; larger bodies get `413` |
| Body format | JSON only: a body without `Content-Type: application/json` gets `415` |
| Instances | one process per data folder (in-memory file stores) |
| Store size | the whole store is held in memory and rewritten on every write. Reads slow down as it grows: about 650 req/s for 2,100 records, see [Performance](/guide/performance) |
| HTTPS, compression, rate limiting, CORS | not built in. Use a proxy |
| Authentication | none. See [Security](/guide/security) |
| Outgoing calls | `client` calls time out after 15 s, AI calls after 120 s |
| Graceful shutdown | none. In-flight requests are dropped on stop, but store files stay whole |
| Logs | api requests and server errors go to stdout/stderr (colored only in a terminal without `NO_COLOR`). Static files aren't logged |

## See also

* [CLI reference](/reference/cli)
* [Security](/guide/security)
* [Performance](/guide/performance)
* [Troubleshooting](/guide/troubleshooting)
* [Models & data](/guide/data)
* [Status & roadmap](/reference/roadmap)
