import { System } from '../ecs';
import { Position, POSITION_COMPONENT, Health, HEALTH_COMPONENT, Npc, NPC_COMPONENT, Player, PLAYER_COMPONENT, Inventory, INVENTORY_COMPONENT, Item, ITEM_COMPONENT } from '../components';

export interface GroundItem {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  createdAt: number;
  pickupRadius: number;
}

export class DropSystem extends System {
  readonly name = 'DropSystem';
  readonly requiredComponents = [];

  private groundItems: Map<string, GroundItem> = new Map();
  private despawnTime: number = 300000;

  protected onInit(): void {
    this.world['dropSystem'] = this;
  }

  spawnDropsFromNpc(npcId: string, x: number, y: number): GroundItem[] {
    const npc = this.world.getComponent<Npc>(npcId, NPC_COMPONENT);
    if (!npc) return [];

    const drops: GroundItem[] = [];

    if (npc.lootTable.length > 0) {
      const dropCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < dropCount; i++) {
        const itemId = npc.lootTable[Math.floor(Math.random() * npc.lootTable.length)];
        const quantity = Math.floor(Math.random() * 2) + 1;

        if (Math.random() < 0.6) {
          const groundItem: GroundItem = {
            id: `drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            itemId,
            quantity,
            x: x + (Math.random() - 0.5) * 2,
            y: y + (Math.random() - 0.5) * 2,
            createdAt: Date.now(),
            pickupRadius: 1.5
          };
          this.groundItems.set(groundItem.id, groundItem);
          drops.push(groundItem);
        }
      }
    }

    if (npc.goldReward > 0 && Math.random() < 0.8) {
      const goldAmount = Math.max(1, Math.floor(npc.goldReward * (0.5 + Math.random())));
      const goldItem: GroundItem = {
        id: `drop_gold_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId: 'gold',
        quantity: goldAmount,
        x: x + (Math.random() - 0.5) * 2,
        y: y + (Math.random() - 0.5) * 2,
        createdAt: Date.now(),
        pickupRadius: 1.5
      };
      this.groundItems.set(goldItem.id, goldItem);
      drops.push(goldItem);
    }

    return drops;
  }

  getNearbyItems(x: number, y: number, range: number): GroundItem[] {
    const result: GroundItem[] = [];
    for (const item of this.groundItems.values()) {
      const dx = item.x - x;
      const dy = item.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) {
        result.push(item);
      }
    }
    return result;
  }

  pickupItem(entityId: string, dropId: string): { success: boolean; itemId: string; quantity: number } {
    const groundItem = this.groundItems.get(dropId);
    if (!groundItem) return { success: false, itemId: '', quantity: 0 };

    const entityPos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    if (!entityPos) return { success: false, itemId: '', quantity: 0 };

    const dx = groundItem.x - entityPos.x;
    const dy = groundItem.y - entityPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > groundItem.pickupRadius) {
      return { success: false, itemId: '', quantity: 0 };
    }

    if (groundItem.itemId === 'gold') {
      const player = this.world.getComponent<Player>(entityId, PLAYER_COMPONENT);
      if (player) {
        player.addGold(groundItem.quantity);
        this.groundItems.delete(dropId);
        return { success: true, itemId: 'gold', quantity: groundItem.quantity };
      }
    }

    const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
    if (inventory && inventory.addItem(groundItem.itemId, groundItem.quantity)) {
      this.groundItems.delete(dropId);
      return { success: true, itemId: groundItem.itemId, quantity: groundItem.quantity };
    }

    return { success: false, itemId: '', quantity: 0 };
  }

  autoPickup(entityId: string): { itemId: string; quantity: number }[] {
    const entityPos = this.world.getComponent<Position>(entityId, POSITION_COMPONENT);
    if (!entityPos) return [];

    const nearbyItems = this.getNearbyItems(entityPos.x, entityPos.y, 1.5);
    const pickedUp: { itemId: string; quantity: number }[] = [];

    for (const item of nearbyItems) {
      const result = this.pickupItem(entityId, item.id);
      if (result.success) {
        pickedUp.push({ itemId: result.itemId, quantity: result.quantity });
      }
    }

    return pickedUp;
  }

  getGroundItem(dropId: string): GroundItem | undefined {
    return this.groundItems.get(dropId);
  }

  getAllGroundItems(): GroundItem[] {
    return Array.from(this.groundItems.values());
  }

  getGroundItemCount(): number {
    return this.groundItems.size;
  }

  update(deltaTime: number): void {
    const now = Date.now();
    for (const [id, item] of this.groundItems) {
      if (now - item.createdAt > this.despawnTime) {
        this.groundItems.delete(id);
      }
    }
  }
}
