# StarLaunch To-Do

**Status 2026-10-13:** all items below are done. See the git log for details. Remaining limitation for item 10: two projects in one folder share that folder's `.starlaunch.json`, so it describes the first one registered.

Collected on 2026-10-13 while setting StarLaunch up on the new computer (code moved from `C:\X\Code` to the `X:` drive). Each item says what's wrong and where to start looking; check the code before changing anything.

## Do first

1. **Commit the repository.** `git log` says `main` has no commits yet, so none of StarLaunch's code is backed up. Commit the current state before making the changes below.

## Bugs

2. **RAM and CPU always show 0 MB / 0.0%.** `src/main/processManager.ts` (around line 267) uses `pidtree` and `pidusage`, which both call `wmic` on Windows. WMIC is removed from new Windows 11 installs, and this PC (Windows 11 Pro, build 26200) doesn't have it, so both calls fail silently. Replace them on Windows with a hidden PowerShell / CIM query (e.g. `Get-CimInstance Win32_Process` for the process tree and memory, plus a CPU sample), run with `windowsHide: true` so no window appears. Temporary workaround: `DISM /Online /Add-Capability /CapabilityName:WMIC~~~~` as administrator.

3. **The window can only be dragged near the StarLaunch icon.** Dragging anywhere else on the header does nothing. Probably the drag region (`-webkit-app-region: drag`) only covers the logo area, or `no-drag` is applied to too much of the header. The whole empty header area should drag the window; only the buttons and the search box should be `no-drag`.

4. **A project card opens with a click anywhere, but only closes via "Collapse".** Clicking anywhere on an open card should close it too, the same way it opens. Clicks on the card's own buttons (Stop, Open, Copy, etc.) must not toggle it.

## Registry and project setup

5. **Registry import ignores the one-line format.** `parseRegistry` (`src/main/registryService.ts`) only reads `Label:` with the value on the next line. Accept `App: Name` on one line as well. The old hand-made registry used that format and the import silently found nothing.

6. **Registry auto-update overwrites the whole file.** `X:\Code\AppRegistry.txt` is hand-maintained and has a port-block and reserved-ports section at the top; auto-update would erase it. Keep a header section intact when regenerating, or write to a separate file.

7. **Add Project and Import don't write the AI files.** Only Create Project and the *Generate AI Integration Files* button (Configure Project) write `CLAUDE.md` + `.starlaunch.json`. Add Project, Import and the REST API should write them too, or at least offer to. That's what lets Claude Code know about StarLaunch as soon as a folder is opened.

8. **Port detection only checks the project's root folder.** In an npm-workspaces monorepo (e.g. ToDoMatriX: root `npm run dev` → `npm run dev -w @todomatrix/app`) the injected `-- --port N` is consumed by npm and never reaches Vite. Detect workspace roots, or let a project point to the sub-folder whose config holds the port.

9. **Categories don't match how projects are organised.** The categories are industries (Shipping, Agriculture, Games…), so every imported project shows "Other". Replace them with the port blocks in `X:\Code\PORT_REGISTRY_PLAN.md`: Apps, Tools, Toys, Customer Support AI Apps, Websites.

10. **Two projects can't share a folder.** Import skips an entry whose directory is already registered, so apps with several parts started from one folder (ShipRoutesX Web + API) have to be one entry. Low priority.

## Polish

11. **Make the console window look good.** `Run StarLaunch.bat` opens a console that must stay open while StarLaunch runs. Show a nice ASCII-art StarLaunch banner (something actually pretty, not a "hacking…" gimmick) and a clear line telling the user to keep this window open, and that closing it closes StarLaunch. Any other window StarLaunch ever needs to keep open should follow the same style.

## Context

- Port plan: `X:\Code\PORT_REGISTRY_PLAN.md`. Registry: `X:\Code\AppRegistry.txt` (old version in `X:\Code\[ARCHIVED]\AppRegistry-before-2026-10-13.txt`).
- The StarLaunch AI Integration API is being moved to port **3003**.
