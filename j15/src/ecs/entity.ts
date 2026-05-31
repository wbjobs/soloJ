export type EntityId = string;

let nextEntityId = 0;

export function createEntityId(): EntityId {
  return `entity_${Date.now()}_${nextEntityId++}`;
}
