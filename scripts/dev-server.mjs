import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const readArg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const rootDir = path.resolve(projectRoot, readArg('--root', '.'))
const port = Number(readArg('--port', process.env.PORT || '5173'))
const host = readArg('--host', '127.0.0.1')

const mimes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
}

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/')
  const resolved = path.resolve(rootDir, `.${clean}`)
  return resolved.startsWith(rootDir) ? resolved : path.join(rootDir, 'index.html')
}

async function existsFile(file) {
  try { return (await stat(file)).isFile() } catch { return false }
}

const server = http.createServer(async (req, res) => {
  try {
    let file = safePath(req.url || '/')
    if (await existsFile(file)) {
      const ext = path.extname(file).toLowerCase()
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(await readFile(file))
      return
    }
    file = path.join(rootDir, 'index.html')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    res.end(await readFile(file))
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`Server error: ${error.message}`)
  }
})

server.listen(port, host, () => {
  console.log(`MediQo dev server: http://${host}:${port}`)
  console.log(`Serving: ${rootDir}`)
})
