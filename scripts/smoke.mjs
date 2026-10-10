import { spawn } from 'node:child_process'

const child = spawn(process.execPath, ['scripts/dev-server.mjs', '--root', 'dist', '--port', '4173'], { stdio: ['ignore', 'pipe', 'pipe'] })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let stderr = ''
child.stderr.on('data', (data) => { stderr += data })

try {
  await wait(500)
  const routes = ['/', '/accreditation', '/accreditation/requirements', '/accreditation/requirements/GP3.1A', '/accreditation/evidence', '/policies', '/alerts', '/products/ai-receptionist']
  for (const route of routes) {
    const response = await fetch(`http://127.0.0.1:4173${route}`)
    const text = await response.text()
    if (!response.ok || !text.includes('MediQo')) throw new Error(`Smoke failed for ${route}`)
    console.log(`OK ${route} ${response.status}`)
  }
} finally {
  child.kill('SIGTERM')
}
if (stderr) console.error(stderr)
