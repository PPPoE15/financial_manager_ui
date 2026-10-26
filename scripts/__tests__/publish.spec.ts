// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'

const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
const sha = 'a'.repeat(40)
const digest = `sha256:${'b'.repeat(64)}`
const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

describe('publication gate', () => {
  it('keeps all required checks and removes the independent publisher', () => {
    expect(workflow.on).toEqual({ push: { branches: ['dev', 'master'] }, pull_request: {} })
    expect(workflow.jobs.build.steps.map((step: { run?: string }) => step.run).filter(Boolean))
      .toEqual(['npm ci', 'npx eslint .', 'npm run build', 'npm run test'])
    expect(existsSync('.github/workflows/docker-image.yml')).toBe(false)
  })
  it.each(['success', 'failure', 'cancelled', 'skipped'])('gates %s of this run', result => {
    const job = workflow.jobs.publish
    expect(job?.needs).toBe('build')
    expect(job?.if).toBe("${{ success() && needs.build.result == 'success' && github.event_name == 'push' && (github.ref == 'refs/heads/dev' || github.ref == 'refs/heads/master') }}")
    // Evaluate the actual expression for the event/status matrix, without registry credentials.
    for (const event of ['push', 'pull_request']) {
      for (const ref of ['refs/heads/dev', 'refs/heads/master', 'refs/heads/feature']) {
        const condition = job.if.slice(3, -2)
        const allowed = new Function('success', 'needs', 'github', `return (${condition})`)(
          () => result === 'success', { build: { result } }, { event_name: event, ref },
        )
        expect(allowed).toBe(result === 'success' && event === 'push' && ref !== 'refs/heads/feature')
      }
    }
  })
  it('checks out the same SHA, isolates credentials and serializes all publishers', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(JSON.stringify(workflow.jobs.build)).not.toContain('secrets.')
    expect(workflow.jobs.build.steps[0].with.ref).toBe('${{ github.sha }}')
    const job = workflow.jobs.publish
    expect(job.steps[0].with.ref).toBe('${{ github.sha }}')
    expect(JSON.stringify(job)).not.toContain('secrets.DOCKERHUB_USERNAME')
    expect(job.concurrency).toEqual({ group: 'fm-ui-publication', 'cancel-in-progress': false })
    expect(job.outputs.image).toBe('${{ steps.publish.outputs.image }}')
    expect(job.outputs.sha).toBe('${{ github.sha }}')
    expect(job.outputs.environment).toBe('${{ github.ref_name }}')
    expect(job.steps.find((step: { id?: string }) => step.id === 'publish').env).toMatchObject({
      GIT_SHA: '${{ github.sha }}', ENVIRONMENT: '${{ github.ref_name }}',
    })
  })
})

/** Запустить скрипт публикации с управляемыми ответами реестра без сетевого доступа. */
function run(mode: string, environment = 'dev') {
  const dir = mkdtempSync(resolve(tmpdir(), 'fm63-'))
  dirs.push(dir)
  writeFileSync(resolve(dir, 'docker'), `#!/bin/bash
printf '%s\\n' "$*" >> "$CALLS"
if [[ "$*" == 'buildx imagetools inspect '* ]]; then
  if [[ "$MODE" == existing || "$MODE" == alias-error || -f "$BUILT" ]]; then
    echo '{"digest":"${digest}"}'
  elif [[ "$MODE" == missing ]]; then
    echo 'ERROR: registry/image:tag: not found' >&2; exit 1
  else
    echo 'ERROR: unauthorized or network failure' >&2; exit 1
  fi
elif [[ "$*" == 'buildx build '* ]]; then
  touch "$BUILT"
elif [[ "$*" == 'buildx imagetools create '* && "$MODE" == alias-error ]]; then
  echo 'alias update failed' >&2; exit 1
fi
`, { mode: 0o755 })
  const result = spawnSync('bash', ['scripts/publish-image.sh'], {
    encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`,
      MODE: mode, CALLS: resolve(dir, 'calls'), BUILT: resolve(dir, 'built'),
      IMAGE_REPOSITORY: 'example/fm-ui', GIT_SHA: sha, ENVIRONMENT: environment,
      GITHUB_OUTPUT: resolve(dir, 'output'), GITHUB_STEP_SUMMARY: resolve(dir, 'summary'),
      PUBLICATION_METADATA: resolve(dir, 'publication.json'),
    },
  })
  return { result, calls: existsSync(resolve(dir, 'calls')) ? readFileSync(resolve(dir, 'calls'), 'utf8') : '',
    metadata: existsSync(resolve(dir, 'publication.json')) ? JSON.parse(readFileSync(resolve(dir, 'publication.json'), 'utf8')) : null,
    output: existsSync(resolve(dir, 'output')) ? readFileSync(resolve(dir, 'output'), 'utf8') : '',
  }
}

describe('publication script with a simulated registry', () => {
  it.each(['dev', 'master'])('publishes a new full-SHA version and metadata for %s', environment => {
    const { result, calls, metadata, output } = run('missing', environment)
    expect(result.status, result.stderr).toBe(0)
    expect(calls).toContain(`buildx build --platform linux/amd64 --file Dockerfile --tag example/fm-ui:${sha} --push .`)
    expect(calls).toContain(`--tag example/fm-ui:${environment} example/fm-ui@${digest}`)
    expect(metadata).toEqual({ image: `example/fm-ui@${digest}`, tag: `example/fm-ui:${sha}`, sha, environment })
    expect(output).toContain(`image=example/fm-ui@${digest}`)
  })
  it('reuses a published version without rebuilding or overwriting its tag', () => {
    const { result, calls, metadata } = run('existing')
    expect(result.status, result.stderr).toBe(0)
    expect(calls).not.toContain('buildx build')
    expect(calls).not.toContain(`--tag example/fm-ui:${sha}`)
    expect(calls).toContain(`--tag example/fm-ui:dev example/fm-ui@${digest}`)
    expect(metadata.image).toBe(`example/fm-ui@${digest}`)
  })
  it.each(['dev', 'master'])('fails publication if the %s tag cannot be updated',
    /** Проверить, что ошибка обновления тега не создаёт успешные метаданные публикации. */
    environment => {
      const { result, metadata, output } = run('alias-error', environment)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('alias update failed')
      expect(metadata).toBeNull()
      expect(output).toBe('')
    })
  it('fails closed on registry errors', () => {
    const { result, calls, metadata } = run('error')
    expect(result.status).not.toBe(0)
    expect(calls).toContain('imagetools inspect')
    expect(calls).not.toContain('buildx build')
    expect(calls).not.toContain('imagetools create')
    expect(metadata).toBeNull()
  })
})
