[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / getPhysicsBody

# Function: getPhysicsBody()

> **getPhysicsBody**(`entity`): [`PhysicsBodyHandle`](../type-aliases/PhysicsBodyHandle.md) \| `undefined`

Defined in: engine/src/components/PhysicsBody.ts:166

The one intended way to read/write a `PhysicsBody`, including its
callback properties: `getPhysicsBody(entity).onCollisionEnter = (other) =>
{}`. Returns `undefined` if the entity is dead or has no `PhysicsBody`.
`entity.get(PhysicsBody)` still works for the plain-data fields, but
TypeScript won't let you assign a callback through it (correctly — those
fields aren't part of the serializable shape).

## Parameters

### entity

[`Entity`](../classes/Entity.md)

## Returns

[`PhysicsBodyHandle`](../type-aliases/PhysicsBodyHandle.md) \| `undefined`
