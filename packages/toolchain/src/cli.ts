#!/usr/bin/env node
import { program } from 'commander';
import { detectToolchain, formatToolchainReport } from './ToolchainDetector.js';
import { loadToolchainSettings, saveToolchainSettings } from './ToolchainSettings.js';

program
  .name('emptysock-toolchain')
  .description('EmptySock Engine toolchain CLI')
  .version('0.1.0');

program
  .command('detect')
  .description('Detect installed toolchain tools')
  .action(async () => {
    const report = await detectToolchain();
    console.log(formatToolchainReport(report));
  });

program
  .command('export')
  .description('Export a game build')
  .requiredOption('--platform <platform>', 'Target platform (web|linux|windows|mac)')
  .requiredOption('--format <format>', 'Output format')
  .requiredOption('--entry <path>', 'Entry file path')
  .requiredOption('--out <path>', 'Output directory')
  .option('--minify', 'Minify output', false)
  .option('--drop-console', 'Remove console calls', false)
  .option('--sourcemap', 'Emit sourcemaps', false)
  .option('--aggressive', 'Aggressive minification (tree-shaking + identifier minification)', false)
  .option('--arch <arch>', 'Target architecture (x86_64|aarch64)', 'x86_64')
  .action(async (opts: {
    platform: string; format: string; entry: string; out: string;
    minify: boolean; dropConsole: boolean; sourcemap: boolean;
    aggressive: boolean; arch: string;
  }) => {
    const settings = loadToolchainSettings();
    console.log(`Exporting for ${opts.platform} (${opts.arch}) — format: ${opts.format}`);
    if (opts.platform === 'linux') {
      await exportLinux(opts, settings);
    } else {
      console.log(`Entry: ${opts.entry}`);
      console.log(`Output: ${opts.out}`);
      console.log('Done.');
    }
  });

program
  .command('settings')
  .description('Manage toolchain settings')
  .option('--show', 'Print current settings')
  .option('--set <key=value>', 'Set a key=value pair')
  .action((opts: { show?: boolean; set?: string }) => {
    const settings = loadToolchainSettings();
    if (opts.show) {
      console.log(JSON.stringify(settings, null, 2));
    } else if (opts.set) {
      const eqIdx = opts.set.indexOf('=');
      if (eqIdx < 1) { console.error('--set requires key=value'); process.exit(1); }
      const key = opts.set.slice(0, eqIdx);
      const val = opts.set.slice(eqIdx + 1);
      (settings as Record<string, unknown>)[key] = val;
      saveToolchainSettings(settings);
      console.log(`Set ${key} = ${val}`);
    } else {
      console.log(JSON.stringify(settings, null, 2));
    }
  });

async function exportLinux(
  opts: { entry: string; out: string; arch: string },
  _settings: ReturnType<typeof loadToolchainSettings>
): Promise<void> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const path = await import('path');
  const fs = await import('fs');
  const exec = promisify(execFile);

  if (!fs.existsSync(opts.out)) fs.mkdirSync(opts.out, { recursive: true });

  // AppImage
  console.log('Building AppImage...');
  try {
    await exec('linuxdeploy', ['--appimage-extract-and-run', '--output', 'appimage', '--appdir', opts.out]);
    console.log(`AppImage written to: ${opts.out}`);
  } catch {
    console.warn('linuxdeploy not found — skipping AppImage (install from https://github.com/linuxdeploy/linuxdeploy)');
  }

  // tar.gz
  console.log('Building tar.gz...');
  const tarOut = path.join(opts.out, `game-linux-${opts.arch}.tar.gz`);
  try {
    await exec('tar', ['-czf', tarOut, '-C', path.dirname(opts.out), path.basename(opts.out)]);
    console.log(`tar.gz: ${tarOut}`);
  } catch (e) {
    console.error('tar.gz failed:', e);
  }

  // Flatpak manifest
  console.log('Emitting Flatpak manifest...');
  const manifest = {
    'app-id': 'io.emptysock.Game',
    runtime: 'org.freedesktop.Platform',
    'runtime-version': '23.08',
    sdk: 'org.freedesktop.Sdk',
    command: 'game',
    modules: [{
      name: 'game',
      buildsystem: 'simple',
      'build-commands': [`install -Dm755 game /app/bin/game`],
      sources: [{ type: 'dir', path: '.' }],
    }],
  };
  const manifestPath = path.join(opts.out, 'io.emptysock.Game.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Flatpak manifest: ${manifestPath}`);
  console.log(`Run: flatpak-builder --user --install build-dir ${manifestPath}`);
}

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
