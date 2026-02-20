import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const postinstallPath = resolve(scriptDir, '..', 'dist', 'postinstall.js')

if (!existsSync(postinstallPath)) {
  process.exit(0)
}

await import(pathToFileURL(postinstallPath).href)
