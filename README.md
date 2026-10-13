# StarLaunch

**A local development command center.** StarLaunch keeps every dev server on your machine in one place: register your projects once, then start, stop, restart and watch them from a single window instead of a dozen terminals.

Built with Electron, React, TypeScript and Tailwind.

## Features

- **One dashboard for all your projects.** Start, stop, restart or force-kill any registered dev server. See status, port, uptime, CPU and memory for each one.
- **Live logs.** Every project's stdout and stderr streams into a built-in console with ANSI colour support.
- **Smart port management.** Before launching, StarLaunch reads the port your project already declares (`.env` files, `vite.config`, `package.json` scripts, including npm-workspaces monorepos). It falls back to a port you pinned, then to a free one, and if the port is busy it moves to the next free port and tells you why.
- **Add, scan or create projects.** Register an existing folder, auto-detect every `package.json` project under a directory, or scaffold a new Vite, React, Next, Express or Node project from the Create Project wizard.
- **Categories and favourites.** Group projects into Apps, Tools, Toys, Customer Support AI Apps and Websites, pin favourites to the top, and search everything.
- **Plain-text project registry (optional).** StarLaunch can keep a human- and AI-readable file listing every project, its port, path and start command. It can also import an existing registry, and it keeps any hand-written header at the top of the file intact when it regenerates.
- **AI assistant integration (optional).** A loopback-only REST API lets tools like Claude Code, Cursor or Gemini CLI list projects, read logs and start or stop dev servers without spawning duplicate processes. Destructive actions (delete, unregister, changing settings) do not exist in the API at all. See [AI_INTEGRATION.md](AI_INTEGRATION.md).
- **AI integration files.** When you add a project, StarLaunch can drop a `CLAUDE.md` (only if one doesn't exist) and a `.starlaunch.json` into the folder, so an AI assistant knows StarLaunch manages that project the moment it opens it.

## Getting started

Requirements: [Node.js](https://nodejs.org/) 20 or newer and npm. StarLaunch is developed and tested on Windows 11; macOS and Linux should work but are less tested.

```bash
git clone https://github.com/XexFlare/starlaunch.git
cd starlaunch
npm install
npm run dev
```

On Windows you can also double-click **`Run StarLaunch.bat`**. It opens a console window that must stay open while StarLaunch runs; closing it closes StarLaunch.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run StarLaunch in development mode with hot reload |
| `npm run build` | Production build into `out/` |
| `npm start` | Preview the production build |
| `npm run build:win` | Build a Windows installer with electron-builder |
| `npm run typecheck` | Type-check the main, preload and renderer code |

## How it works

```
src/
├── main/        Electron main process
│   ├── processManager.ts    spawns, tracks and stops dev servers
│   ├── processStats.ts      CPU and memory per process tree (no WMIC needed)
│   ├── portManager.ts       port discovery, conflict handling, launch commands
│   ├── registryService.ts   reads and writes the plain-text registry
│   ├── configManager.ts     writes CLAUDE.md and .starlaunch.json
│   ├── aiIntegrationLayer.ts + aiHttpServer.ts   the optional REST API
│   └── store.ts             persisted projects and settings
├── preload/     the typed bridge the UI uses to talk to the main process
├── renderer/    the React UI
└── shared/      types shared by both sides
```

Projects and settings are stored as JSON in Electron's user data folder. StarLaunch never edits your project's own config files; it only reads them to work out the right port.

For a deeper tour of the port and registry design, see [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md).

## Contributing

Issues and pull requests are welcome. Please run `npm run typecheck` and `npm run build` before opening a PR.

If StarLaunch saves you a few terminal tabs, a star on GitHub is much appreciated.

## License

[MIT](LICENSE) © Xexin Alick Kansichi ([XexFlare](https://github.com/XexFlare))
