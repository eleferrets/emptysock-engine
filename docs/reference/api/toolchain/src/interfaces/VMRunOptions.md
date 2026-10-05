[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / VMRunOptions

# Interface: VMRunOptions

Defined in: toolchain/src/VMRunner.ts:5

## Properties

### command

> **command**: `string`[]

Defined in: toolchain/src/VMRunner.ts:11

Command to run inside the container

***

### dockerFlags?

> `optional` **dockerFlags?**: `string`[]

Defined in: toolchain/src/VMRunner.ts:15

Extra docker flags, e.g. ['--platform', 'linux/amd64']

***

### env?

> `optional` **env?**: `Record`\<`string`, `string`\>

Defined in: toolchain/src/VMRunner.ts:13

Extra environment variables to pass

***

### image

> **image**: `string`

Defined in: toolchain/src/VMRunner.ts:9

Docker image to use

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: toolchain/src/VMRunner.ts:17

Timeout in milliseconds (default 300_000 = 5 min)

***

### workspaceDir

> **workspaceDir**: `string`

Defined in: toolchain/src/VMRunner.ts:7

Absolute host path to mount as /workspace inside the container
