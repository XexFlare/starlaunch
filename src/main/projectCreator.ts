import { spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import treeKill from 'tree-kill'
import type { Framework, PackageManager, ProjectCreationInput } from '../shared/types'

const SCAFFOLD_TIMEOUT_MS = 5 * 60 * 1000

export type ScaffoldProgress = (line: string) => void

export interface ScaffoldResult {
  directory: string
  gitInitialized: boolean
}

function sanitizeFolderName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/^\.+/, '')
  return cleaned.slice(0, 100) || 'new-project'
}

function slugifyPackageName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9-_.]+/g, '-').replace(/^-+/, '') || 'starlaunch-project'
}

function runCommand(command: string, cwd: string, onProgress: ScaffoldProgress): Promise<void> {
  return new Promise((resolve, reject) => {
    onProgress(`$ ${command}`)
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      if (child.pid) treeKill(child.pid, 'SIGKILL')
      reject(new Error(`Command timed out after ${SCAFFOLD_TIMEOUT_MS / 1000}s: ${command}`))
    }, SCAFFOLD_TIMEOUT_MS)

    const pipe = (buf: Buffer): void => {
      const text = buf.toString().replace(/\r\n/g, '\n')
      for (const line of text.split('\n')) {
        if (line.trim().length > 0) onProgress(line)
      }
    }
    child.stdout?.on('data', pipe)
    child.stderr?.on('data', pipe)

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(err)
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code === 0) resolve()
      else reject(new Error(`"${command}" exited with code ${code ?? 'null'}`))
    })
  })
}

function runnerPrefix(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npx'
    case 'pnpm':
      return 'pnpm dlx'
    case 'yarn':
      return 'yarn dlx'
    case 'bun':
      return 'bunx'
  }
}

function installCommand(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm install'
    case 'pnpm':
      return 'pnpm install'
    case 'yarn':
      return 'yarn install'
    case 'bun':
      return 'bun install'
  }
}

function nextPackageManagerFlag(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return '--use-npm'
    case 'pnpm':
      return '--use-pnpm'
    case 'yarn':
      return '--use-yarn'
    case 'bun':
      return '--use-bun'
  }
}

function writeNodeTemplate(directory: string, name: string): void {
  const pkg = { name, version: '1.0.0', private: true, scripts: { dev: 'node index.js', start: 'node index.js' } }
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')

  const indexJs = [
    "const http = require('http')",
    '',
    'const port = process.env.PORT || 3000',
    '',
    'const server = http.createServer((req, res) => {',
    "  res.writeHead(200, { 'Content-Type': 'text/plain' })",
    "  res.end('Hello from Node — managed by StarLaunch')",
    '})',
    '',
    'server.listen(port, () => {',
    '  console.log(`Server running at http://localhost:${port}`)',
    '})',
    ''
  ].join('\n')
  writeFileSync(join(directory, 'index.js'), indexJs, 'utf-8')
  writeFileSync(join(directory, '.gitignore'), 'node_modules\n.env\n', 'utf-8')
}

function writeEmptyTemplate(directory: string, name: string): void {
  const pkg = { name, version: '1.0.0', private: true, scripts: { dev: 'echo "Add a dev script to package.json"' } }
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
  writeFileSync(join(directory, 'README.md'), `# ${name}\n\nCreated with StarLaunch.\n`, 'utf-8')
  writeFileSync(join(directory, '.gitignore'), 'node_modules\n.env\n', 'utf-8')
}

/**
 * Framework-specific scaffolding. CLI-backed frameworks (Vite/React/Next/Express)
 * shell out to their official generators; Node/Empty/Custom are hand-authored
 * minimal templates since no universally-trusted generator exists for "nothing."
 * Kept as one small function per framework so upstream CLI flag drift is easy
 * to patch in one place without touching the rest of project creation.
 */
async function scaffoldFramework(
  framework: Framework,
  packageManager: PackageManager,
  directory: string,
  packageName: string,
  onProgress: ScaffoldProgress
): Promise<void> {
  const prefix = runnerPrefix(packageManager)

  switch (framework) {
    case 'Vite':
      await runCommand(`${prefix} create-vite@latest . --template vanilla-ts`, directory, onProgress)
      await runCommand(installCommand(packageManager), directory, onProgress)
      return
    case 'React':
      await runCommand(`${prefix} create-vite@latest . --template react-ts`, directory, onProgress)
      await runCommand(installCommand(packageManager), directory, onProgress)
      return
    case 'Next':
      await runCommand(
        `npx create-next-app@latest . --ts --eslint --app --no-tailwind --no-src-dir --import-alias "@/*" ${nextPackageManagerFlag(packageManager)}`,
        directory,
        onProgress
      )
      return
    case 'Express':
      await runCommand(`${prefix} express-generator@latest . --no-view`, directory, onProgress)
      await runCommand(installCommand(packageManager), directory, onProgress)
      return
    case 'Node':
      writeNodeTemplate(directory, packageName)
      onProgress('Wrote a minimal Node.js HTTP server template.')
      return
    case 'Empty':
    case 'Custom':
      writeEmptyTemplate(directory, packageName)
      onProgress('Wrote a minimal package.json — ready for your own setup.')
      return
  }
}

/**
 * Creates the project directory, scaffolds the chosen framework, and
 * optionally runs `git init`. Does not touch the StarLaunch store or start
 * any process — those are orchestrated by the caller (see main/index.ts),
 * keeping this service focused purely on filesystem/process scaffolding.
 */
export async function scaffoldProject(
  input: ProjectCreationInput,
  onProgress: ScaffoldProgress
): Promise<ScaffoldResult> {
  const directory = join(input.parentFolder, sanitizeFolderName(input.name))

  if (existsSync(directory) && readdirSync(directory).length > 0) {
    throw new Error(`"${directory}" already exists and is not empty.`)
  }

  mkdirSync(directory, { recursive: true })
  onProgress(`Created project directory: ${directory}`)

  const packageName = slugifyPackageName(input.name || basename(directory))
  await scaffoldFramework(input.framework, input.packageManager, directory, packageName, onProgress)

  let gitInitialized = false
  if (input.createGitRepo) {
    try {
      await runCommand('git init', directory, onProgress)
      gitInitialized = true
    } catch (err) {
      onProgress(`Could not initialize a git repository: ${(err as Error).message}`)
    }
  }

  return { directory, gitInitialized }
}
