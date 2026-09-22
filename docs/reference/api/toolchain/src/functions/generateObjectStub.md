[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / generateObjectStub

# Function: generateObjectStub()

> **generateObjectStub**(`objectName`, `events`): `string`

Defined in: [toolchain/src/gms2-gml-stub.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/toolchain/src/gms2-gml-stub.ts#L38)

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
