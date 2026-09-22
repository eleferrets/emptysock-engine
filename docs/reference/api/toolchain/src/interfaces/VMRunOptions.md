[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / VMRunOptions

# Interface: VMRunOptions

Defined in: [toolchain/src/VMRunner.ts:5](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L5)

## Properties

### command

> **command**: `string`[]

Defined in: [toolchain/src/VMRunner.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L11)

Command to run inside the container

***

### dockerFlags?

> `optional` **dockerFlags?**: `string`[]

Defined in: [toolchain/src/VMRunner.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L15)

Extra docker flags, e.g. ['--platform', 'linux/amd64']

***

### env?

> `optional` **env?**: `Record`\<`string`, `string`\>

Defined in: [toolchain/src/VMRunner.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L13)

Extra environment variables to pass

***

### image

> **image**: `string`

Defined in: [toolchain/src/VMRunner.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L9)

Docker image to use

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [toolchain/src/VMRunner.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L17)

Timeout in milliseconds (default 300_000 = 5 min)

***

### workspaceDir

> **workspaceDir**: `string`

Defined in: [toolchain/src/VMRunner.ts:7](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/VMRunner.ts#L7)

Absolute host path to mount as /workspace inside the container
