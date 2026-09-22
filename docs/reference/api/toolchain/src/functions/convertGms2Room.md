[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / convertGms2Room

# Function: convertGms2Room()

> **convertGms2Room**(`roomYyPath`): `Promise`\<[`RoomData`](../interfaces/RoomData.md)\>

Defined in: [toolchain/src/gms2-room-import.ts:110](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/toolchain/src/gms2-room-import.ts#L110)

Convert a GMS2 room .yy file path into a RoomData object.
Throws a descriptive Error on missing file, unreadable file, or invalid JSON.

## Parameters

### roomYyPath

`string`

## Returns

`Promise`\<[`RoomData`](../interfaces/RoomData.md)\>
