import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { randomBytes, timingSafeEqual } from 'crypto'
import type { AppSettings } from '../shared/types'
import type { AiIntegrationLayer } from './aiIntegrationLayer'

export function generateAiIntegrationToken(): string {
  return randomBytes(24).toString('hex')
}

const PROJECT_ACTION_RE = /^\/projects\/([^/]+)(\/(start|stop|restart|status|logs|open|copy-url))?$/

/**
 * The one concrete transport implemented today for the AI Integration Layer:
 * a loopback-only (127.0.0.1, never 0.0.0.0), bearer-token-gated HTTP/REST
 * server. It only ever calls methods on an AiIntegrationLayer instance, so a
 * future transport (named pipe, MCP server, CLI) can be added without this
 * file changing, and without the layer changing either.
 */
class AiHttpServer {
  private server: Server | null = null
  private layer: AiIntegrationLayer | null = null
  private token = ''
  private port = 3003

  bind(layer: AiIntegrationLayer): void {
    this.layer = layer
  }

  applySettings(settings: AppSettings): void {
    this.token = settings.aiIntegrationToken
    this.port = settings.aiIntegrationPort
    if (settings.aiIntegrationEnabled && settings.aiIntegrationToken) {
      this.start()
    } else {
      this.stop()
    }
  }

  getState(): { running: boolean; port: number } {
    return { running: this.server != null, port: this.port }
  }

  private start(): void {
    this.stop()
    const server = createServer((req, res) => {
      this.handle(req, res).catch((err) => this.send(res, 500, { ok: false, error: (err as Error).message }))
    })
    server.on('error', (err) => {
      console.error('[StarLaunch] AI integration server failed to start:', err.message)
      this.server = null
    })
    server.listen(this.port, '127.0.0.1')
    this.server = server
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }

  private authorized(req: IncomingMessage): boolean {
    if (!this.token) return false
    const header = req.headers.authorization ?? ''
    const expected = `Bearer ${this.token}`
    const a = Buffer.from(header)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  private send(res: ServerResponse, status: number, body: unknown): void {
    const json = JSON.stringify(body)
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(json)
  }

  private readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = ''
      req.on('data', (chunk: Buffer) => {
        data += chunk.toString()
        if (data.length > 1_000_000) req.destroy(new Error('Request body too large'))
      })
      req.on('end', () => {
        if (!data) {
          resolve({})
          return
        }
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid JSON body'))
        }
      })
      req.on('error', reject)
    })
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const layer = this.layer
    if (!layer) {
      this.send(res, 503, { ok: false, error: 'AI integration layer is not ready yet' })
      return
    }

    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname.replace(/\/+$/, '') || '/'

    // Health is intentionally unauthenticated — a client should be able to
    // confirm the server is reachable before it has a token configured.
    if (path === '/health' && req.method === 'GET') {
      this.send(res, 200, layer.healthCheck())
      return
    }

    if (!this.authorized(req)) {
      this.send(res, 401, { ok: false, error: 'Missing or invalid bearer token' })
      return
    }

    if (path === '/projects' && req.method === 'GET') {
      this.send(res, 200, layer.listProjects())
      return
    }
    if (path === '/projects' && req.method === 'POST') {
      const body = await this.readBody(req)
      const project = layer.registerProject(body as never)
      this.send(res, 201, project)
      return
    }

    const match = path.match(PROJECT_ACTION_RE)
    if (match) {
      const id = decodeURIComponent(match[1])
      const action = match[3]

      if (!action && req.method === 'GET') {
        const result = layer.readProject(id)
        this.respondOrNotFound(res, result)
        return
      }
      if (action === 'start' && req.method === 'POST') {
        this.send(res, 200, { ok: await layer.startProject(id) })
        return
      }
      if (action === 'stop' && req.method === 'POST') {
        this.send(res, 200, { ok: layer.stopProject(id) })
        return
      }
      if (action === 'restart' && req.method === 'POST') {
        this.send(res, 200, { ok: layer.restartProject(id) })
        return
      }
      if (action === 'status' && req.method === 'GET') {
        this.respondOrNotFound(res, layer.getStatus(id))
        return
      }
      if (action === 'logs' && req.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? '200')
        this.respondOrNotFound(res, layer.getLogs(id, Number.isFinite(limit) ? limit : 200))
        return
      }
      if (action === 'open' && req.method === 'POST') {
        this.send(res, 200, { ok: layer.openUrl(id) })
        return
      }
      if (action === 'copy-url' && req.method === 'POST') {
        this.send(res, 200, { ok: layer.copyUrl(id) })
        return
      }
    }

    this.send(res, 404, { ok: false, error: 'Not found' })
  }

  private respondOrNotFound(res: ServerResponse, value: unknown): void {
    if (value == null) {
      this.send(res, 404, { ok: false, error: 'Project not found' })
    } else {
      this.send(res, 200, value)
    }
  }
}

export const aiHttpServer = new AiHttpServer()
