import { execSync } from 'node:child_process'

function run(command) {
  execSync(command, {
    stdio: 'inherit',
  })
}

try {
  const insideWorkTree = execSync('git rev-parse --is-inside-work-tree', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

  if (insideWorkTree !== 'true') {
    process.exit(0)
  }
} catch {
  console.log('Skipped Git hook setup: Git repository not available')
  process.exit(0)
}

try {
  run('git config core.hooksPath .githooks')
  console.log('Configured Git hooks: .githooks')
} catch {
  console.log('Skipped Git hook setup: Could not write Git config. Run `git config core.hooksPath .githooks` manually.')
}
