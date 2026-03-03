import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Dev-only plugin: exposes GET /api/dev/data-files that walks data/user_*/
// so the app can detect locally placed brokerage exports and offer to import them.
// This endpoint only exists during `npm run dev` — the production build is static
// and has no server-side runtime, so this feature is silently absent in production.
function listSubdirs(dir) {
  return readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory())
}

function listDataFiles(dir) {
  return readdirSync(dir).filter(name => /\.(csv|xlsx)$/i.test(name))
}

function scanDataDir(dataDir) {
  const files = []
  for (const userDir of listSubdirs(dataDir)) {
    if (!userDir.startsWith('user_')) continue
    for (const providerDir of listSubdirs(join(dataDir, userDir))) {
      for (const filename of listDataFiles(join(dataDir, userDir, providerDir))) {
        files.push({ user: userDir, provider: providerDir, filename })
      }
    }
  }
  return files
}

function devDataFilesPlugin() {
  return {
    name: 'dev-data-files',
    configureServer(server) {
      server.middlewares.use('/api/dev/data-files', (_req, res) => {
        const dataDir = join(process.cwd(), 'data')
        const files = existsSync(dataDir) ? scanDataDir(dataDir) : []
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(files))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devDataFilesPlugin()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
      '/api/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, ''),
      },
      '/api/finnhub': {
        target: 'https://finnhub.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/finnhub/, ''),
      },
      '/api/fred': {
        target: 'https://api.stlouisfed.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fred/, ''),
      },
    },
  },
})
