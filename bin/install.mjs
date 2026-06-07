#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_NAME = 'minecraft-builder-skill'
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageItems = [
  'SKILL.md',
  'README.md',
  'LICENSE',
  'package.json',
  'npm-shrinkwrap.json',
  'agents',
  'scripts',
  'assets',
  'references',
  'bin',
]

function usage() {
  return `Minecraft Builder Skill installer

Usage:
  npx --yes github:mattzh72/minecraft-builder-skill
  npx --yes github:mattzh72/minecraft-builder-skill install [--target <skills-dir>] [--force] [--no-deps]

Options:
  --target <skills-dir>  Install into this skills directory.
  --force                Replace an existing minecraft-builder-skill install.
  --no-deps              Copy files only; skip npm install --omit=dev.
  -h, --help             Show this help text.
`
}

function parseArgs(argv) {
  const args = [...argv]
  let command = 'install'
  if (args[0] && !args[0].startsWith('-')) {
    command = args.shift()
  }

  const options = {
    command,
    target: undefined,
    force: false,
    deps: true,
    help: false,
  }

  const readValue = (arg, index) => {
    const value = args[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`${arg} requires a path`)
    return value
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--no-deps') {
      options.deps = false
    } else if (arg === '--target') {
      options.target = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

async function exists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

function defaultSkillsDir() {
  const codexHome = process.env.CODEX_HOME
  if (codexHome) return path.resolve(codexHome, 'skills')
  return path.resolve(os.homedir(), '.codex', 'skills')
}

async function copyItem(name, destinationRoot) {
  const source = path.join(packageRoot, name)
  if (!(await exists(source))) return
  const destination = path.join(destinationRoot, name)
  await fs.cp(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
    verbatimSymlinks: true,
  })
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: 'inherit',
      shell: false,
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      }
    })
  })
}

async function install(options) {
  const skillsDir = path.resolve(options.target ?? defaultSkillsDir())
  const installDir = path.join(skillsDir, SKILL_NAME)

  if (await exists(installDir)) {
    if (!options.force) {
      throw new Error(`Install already exists at ${installDir}. Re-run with --force to replace it.`)
    }
    await fs.rm(installDir, { recursive: true, force: true })
  }

  await fs.mkdir(installDir, { recursive: true })
  for (const item of packageItems) {
    await copyItem(item, installDir)
  }

  await fs.chmod(path.join(installDir, 'bin', 'install.mjs'), 0o755).catch(() => undefined)

  if (options.deps) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    await run(npmCommand, ['install', '--omit=dev'], { cwd: installDir })
  }

  console.log(`\nInstalled ${SKILL_NAME} at:`)
  console.log(`  ${installDir}`)
  console.log('\nTry it with:')
  console.log('  Use minecraft-builder-skill to create a small medieval watchtower, export the .nbt file, and open a preview.')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || options.command === 'help') {
    console.log(usage())
    return
  }
  if (options.command !== 'install') {
    throw new Error(`Unknown command: ${options.command}`)
  }
  await install(options)
}

main().catch(err => {
  console.error(`minecraft-builder-skill: ${err.message}`)
  process.exitCode = 1
})
