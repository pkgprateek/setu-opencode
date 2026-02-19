import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const postinstallPath = resolve(process.cwd(), 'dist', 'postinstall.js')

if (!existsSync(postinstallPath)) {
  process.exit(0)
}

await import(pathToFileURL(postinstallPath).href)
