import { EntityId, createEntityId } from './entity';
import { Component } from './component';
import { System } from './system';

type ComponentMap = Map<string, Map<EntityId, Component>>;

export class World {
  [key: string]: any;
  private entities: Set<EntityId> = new Set();
  private components: ComponentMap = new Map();
  private entityComponents: Map<EntityId, Set<string>> = new Map();
  private systems: System[] = [];

  createEntity(): EntityId {
    const id = createEntityId();
    this.entities.add(id);
    this.entityComponents.set(id, new Set());
    return id;
  }

  removeEntity(id: EntityId): void {
    if (!this.entities.has(id)) return;
    this.entities.delete(id);
    const comps = this.entityComponents.get(id);
    if (comps) {
      for (const compType of comps) {
        this.components.get(compType)?.delete(id);
      }
    }
    this.entityComponents.delete(id);
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  addComponent(id: EntityId, component: Component): void {
    if (!this.entities.has(id)) return;
    const type = component.type;
    if (!this.components.has(type)) {
      this.components.set(type, new Map());
    }
    this.components.get(type)!.set(id, component);
    this.entityComponents.get(id)!.add(type);
  }

  removeComponent(id: EntityId, componentType: string): void {
    if (!this.entities.has(id)) return;
    this.components.get(componentType)?.delete(id);
    this.entityComponents.get(id)?.delete(componentType);
  }

  getComponent<T extends Component>(id: EntityId, componentType: string): T | undefined {
    return this.components.get(componentType)?.get(id) as T | undefined;
  }

  hasComponent(id: EntityId, componentType: string): boolean {
    return this.components.get(componentType)?.has(id) ?? false;
  }

  getEntitiesWithComponents(componentTypes: string[]): EntityId[] {
    const result: EntityId[] = [];
    for (const id of this.entities) {
      const comps = this.entityComponents.get(id);
      if (!comps) continue;
      if (componentTypes.every(t => comps.has(t))) {
        result.push(id);
      }
    }
    return result;
  }

  getEntitiesWithAnyComponent(componentTypes: string[]): EntityId[] {
    const result: EntityId[] = [];
    for (const id of this.entities) {
      const comps = this.entityComponents.get(id);
      if (!comps) continue;
      if (componentTypes.some(t => comps.has(t))) {
        result.push(id);
      }
    }
    return result;
  }

  getAllEntities(): EntityId[] {
    return Array.from(this.entities);
  }

  registerSystem(system: System): void {
    this.systems.push(system);
    system.init(this);
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }

  getEntitiesCount(): number {
    return this.entities.size;
  }

  getSystemsCount(): number {
    return this.systems.length;
  }

  clear(): void {
    this.entities.clear();
    this.components.clear();
    this.entityComponents.clear();
    this.systems = [];
  }
}
