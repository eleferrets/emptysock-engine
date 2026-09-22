[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / generateObjectStub

# Function: generateObjectStub()

> **generateObjectStub**(`objectName`, `events`): `string`

Defined in: [toolchain/src/gms2-gml-stub.ts:38](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/gms2-gml-stub.ts#L38)

Generates a TypeScript class stub for a GMS2 object.

## Parameters

### objectName

`string`

The GMS2 object name (becomes the class name).

### events

`string`[]

List of GMS2 event names (e.g. ["Create", "Step", "Destroy"]).

## Returns

`string`

A TypeScript source string ready to be written to a .ts file.
