import { cp, mkdir, rm, copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvironment, runtimeConfigScript } from './runtime-config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'))
await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true })
await cp(path.join(root, 'public'), dist, { recursive: true })
const environment = await loadEnvironment(root)
await writeFile(path.join(dist, 'runtime-config.js'), runtimeConfigScript(environment), 'utf8')
console.log('Built MediQo prototype to dist/')
