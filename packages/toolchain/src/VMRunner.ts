import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface VMRunOptions {
  /** Absolute host path to mount as /workspace inside the container */
  workspaceDir: string;
  /** Docker image to use */
  image: string;
  /** Command to run inside the container */
  command: string[];
  /** Extra environment variables to pass */
  env?: Record<string, string>;
  /** Extra docker flags, e.g. ['--platform', 'linux/amd64'] */
  dockerFlags?: string[];
  /** Timeout in milliseconds (default 300_000 = 5 min) */
  timeoutMs?: number;
}

export interface VMRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

function findDocker(dockerPath?: string): string | null {
  if (dockerPath !== undefined && existsSync(dockerPath)) return dockerPath;
  for (const candidate of ['/usr/bin/docker', '/usr/local/bin/docker', '/opt/homebrew/bin/docker']) {
    if (existsSync(candidate)) return candidate;
  }
  // Try PATH
  const r = spawnSync('which', ['docker'], { encoding: 'utf-8' });
  if (r.status === 0) return r.stdout.trim();
  return null;
}

/**
 * Run a command inside a Docker container with the workspace mounted.
 * Used to test Linux/Android builds without requiring the host to have
 * platform-specific toolchains installed.
 */
export function runInVM(options: VMRunOptions, dockerPath?: string): VMRunResult {
  const docker = findDocker(dockerPath);
  if (docker === null) {
    return {
      success: false,
      stdout: '',
      stderr: 'Docker not found. Install Docker Desktop or Docker Engine, then set dockerPath in emptysock.toolchain.json.',
      exitCode: 1,
    };
  }

  const absWorkspace = resolve(options.workspaceDir);
  const envFlags: string[] = [];
  if (options.env !== undefined) {
    for (const [k, v] of Object.entries(options.env)) {
      envFlags.push('-e', `${k}=${v}`);
    }
  }

  const dockerArgs = [
    'run', '--rm',
    '-v', `${absWorkspace}:/workspace`,
    '-w', '/workspace',
    ...(options.dockerFlags ?? []),
    ...envFlags,
    options.image,
    ...options.command,
  ];

  const result: SpawnSyncReturns<string> = spawnSync(docker, dockerArgs, {
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? 300_000,
    maxBuffer: 32 * 1024 * 1024,
  });

  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Pull a Docker image, streaming output to a callback.
 */
export function pullImage(image: string, dockerPath?: string): VMRunResult {
  const docker = findDocker(dockerPath);
  if (docker === null) {
    return { success: false, stdout: '', stderr: 'Docker not found', exitCode: 1 };
  }
  const result = spawnSync(docker, ['pull', image], {
    encoding: 'utf-8',
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: 'pipe',
  });
  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Check whether a Docker image is present locally (without a pull).
 */
export function imageExists(image: string, dockerPath?: string): boolean {
  const docker = findDocker(dockerPath);
  if (docker === null) return false;
  const r = spawnSync(docker, ['image', 'inspect', image], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  return r.status === 0;
}

// ---------------------------------------------------------------------------
// Convenience: run pnpm test inside a Linux container
// ---------------------------------------------------------------------------

export interface LinuxTestOptions {
  workspaceDir: string;
  image?: string;
  dockerPath?: string;
  /** pnpm filter, e.g. '@emptysock/engine' */
  filter?: string;
}

export function runLinuxTests(opts: LinuxTestOptions): VMRunResult {
  const image = opts.image ?? 'node:22-bookworm-slim';
  const cmd = ['sh', '-c',
    `npm install -g pnpm && pnpm install --frozen-lockfile && pnpm ${opts.filter !== undefined ? `--filter ${opts.filter} ` : ''}test`,
  ];
  return runInVM({
    workspaceDir: opts.workspaceDir,
    image,
    command: cmd,
    dockerFlags: ['--platform', 'linux/amd64'],
  }, opts.dockerPath);
}
