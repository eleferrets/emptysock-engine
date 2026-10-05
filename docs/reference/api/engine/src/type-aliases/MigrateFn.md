[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / MigrateFn

# Type Alias: MigrateFn

> **MigrateFn** = (`oldData`, `oldVersion`) => [`SerializableRecord`](SerializableRecord.md)

Defined in: engine/src/systems/SaveSystem.ts:116

Migrates one component's saved data forward from the version it was saved
under to the currently-registered def's version. Register with
`SaveSystem.registerMigration`. Whatever it returns is trusted as-is and
handed straight to `entity.add()` — it is the component author's job to
return a value matching the *current* shape.

## Parameters

### oldData

[`SerializableRecord`](SerializableRecord.md)

### oldVersion

`number`

## Returns

[`SerializableRecord`](SerializableRecord.md)
