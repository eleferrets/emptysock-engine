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
  .option('--format <format>', 'Output format (zip|appimage|installer|deb|flatpak)')
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

    if (opts.format === 'zip') {
      await exportZip({ platform: opts.platform, arch: opts.arch, out: opts.out });
      return;
    }

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
  opts: { entry: string; out: string; arch: string; format: string },
  _settings: ReturnType<typeof loadToolchainSettings>
): Promise<void> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const path = await import('path');
  const fs = await import('fs');
  const exec = promisify(execFile);

  if (!fs.existsSync(opts.out)) fs.mkdirSync(opts.out, { recursive: true });

  if (opts.format === 'zip') {
    await exportZip({ platform: 'linux', arch: opts.arch, out: opts.out });
    return;
  }

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

/**
 * Creates a platform-specific portable zip that needs no installer.
 *
 * linux  → zips the AppImage (chmod +x, run directly).
 * mac    → zips the .app bundle (drag-and-drop or run from anywhere).
 * windows→ zips the portable .exe directory (no registry writes).
 * web    → zips the Vite dist/ folder (serve with any static host).
 */
async function exportZip(opts: { platform: string; arch: string; out: string }): Promise<void> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const path = await import('path');
  const fs = await import('fs');
  const exec = promisify(execFile);

  if (!fs.existsSync(opts.out)) fs.mkdirSync(opts.out, { recursive: true });

  const zipName = `game-${opts.platform}-${opts.arch}-portable.zip`;
  const zipOut = path.join(opts.out, zipName);

  switch (opts.platform) {
    case 'web': {
      const distDir = path.join(opts.out, 'dist');
      if (!fs.existsSync(distDir)) {
        console.error(`Web dist/ not found at ${distDir}. Run "pnpm build" first.`);
        process.exit(1);
      }
      console.log(`Zipping web build → ${zipName}`);
      await exec('zip', ['-r', zipOut, 'dist'], { cwd: opts.out });
      console.log(`Portable web zip: ${zipOut}`);
      console.log('To serve: unzip and run: npx serve dist  (or: python3 -m http.server --directory dist)');
      break;
    }

    case 'linux': {
      // Expect an AppImage in opts.out; zip it as-is (AppImage is already installer-free).
      const appImages = fs.readdirSync(opts.out).filter(f => f.endsWith('.AppImage'));
      if (appImages.length === 0) {
        console.error('No .AppImage found in output dir. Run without --format zip first to produce the AppImage.');
        process.exit(1);
      }
      const appImage = appImages[0];
      console.log(`Zipping ${appImage} → ${zipName}`);
      await exec('zip', [zipOut, appImage], { cwd: opts.out });
      console.log(`Portable Linux zip: ${zipOut}`);
      console.log('To run: unzip, chmod +x *.AppImage, then ./game.AppImage');
      break;
    }

    case 'mac': {
      // Expect a .app bundle in opts.out.
      const apps = fs.readdirSync(opts.out).filter(f => f.endsWith('.app'));
      if (apps.length === 0) {
        console.error('No .app bundle found in output dir. Run without --format zip first to produce the .app.');
        process.exit(1);
      }
      const app = apps[0];
      console.log(`Zipping ${app} → ${zipName}`);
      await exec('zip', ['-r', zipOut, app], { cwd: opts.out });
      console.log(`Portable macOS zip: ${zipOut}`);
      console.log('To run: unzip, then open game.app (or double-click in Finder)');
      break;
    }

    case 'windows': {
      // On Windows, use PowerShell Compress-Archive. Works on all Windows 10+ machines.
      const exeDir = path.resolve(opts.out);
      const psCmd = `Compress-Archive -Path '${exeDir}\\*' -DestinationPath '${zipOut}' -Force`;
      console.log(`Zipping portable exe → ${zipName}`);
      try {
        await exec('powershell', ['-NonInteractive', '-Command', psCmd]);
        console.log(`Portable Windows zip: ${zipOut}`);
        console.log('To run: unzip and run game.exe — no installation required');
      } catch {
        // Fallback: 7-Zip if available
        try {
          await exec('7z', ['a', zipOut, path.join(exeDir, '*')]);
          console.log(`Portable Windows zip (7z): ${zipOut}`);
        } catch {
          console.error('zip failed: neither PowerShell Compress-Archive nor 7z is available');
          process.exit(1);
        }
      }
      break;
    }

    default:
      console.error(`Unknown platform "${opts.platform}" for zip format`);
      process.exit(1);
  }
}

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
