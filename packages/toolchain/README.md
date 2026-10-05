# @emptysock/toolchain

> Deprecated. Development has stopped; kept as a reference.

The `emptysock-toolchain` CLI.

| Command           | What it does                                                                   |
| ----------------- | ------------------------------------------------------------------------------ |
| `detect`          | Report which build tools (Node, Rust, Tauri, SDKs) are installed.              |
| `export`          | Export a game for a target platform; desktop builds scaffold a Tauri v2 shell. |
| `settings`        | Read and write toolchain settings.                                             |
| `codegen-prefabs` | Generate typed prefab modules.                                                 |

```bash
pnpm --filter @emptysock/toolchain build
node packages/toolchain/dist/cli.js detect
```
