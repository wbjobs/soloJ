import { Component } from '../ecs';

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export const INVENTORY_COMPONENT = 'inventory';

export class Inventory extends Component {
  readonly type = INVENTORY_COMPONENT;

  public slots: number;
  public items: Map<string, ItemStack> = new Map();

  constructor(slots: number = 20) {
    super();
    this.slots = slots;
  }

  get usedSlots(): number {
    return this.items.size;
  }

  get isFull(): boolean {
    return this.usedSlots >= this.slots;
  }

  addItem(itemId: string, quantity: number = 1): boolean {
    const existing = this.items.get(itemId);
    if (existing) {
      existing.quantity += quantity;
      return true;
    }
    if (this.isFull) return false;
    this.items.set(itemId, { itemId, quantity });
    return true;
  }

  removeItem(itemId: string, quantity: number = 1): boolean {
    const existing = this.items.get(itemId);
    if (!existing) return false;
    if (existing.quantity < quantity) return false;
    existing.quantity -= quantity;
    if (existing.quantity <= 0) {
      this.items.delete(itemId);
    }
    return true;
  }

  hasItem(itemId: string, quantity: number = 1): boolean {
    const existing = this.items.get(itemId);
    return existing !== undefined && existing.quantity >= quantity;
  }

  getItemQuantity(itemId: string): number {
    return this.items.get(itemId)?.quantity ?? 0;
  }

  clear(): void {
    this.items.clear();
  }

  toArray(): ItemStack[] {
    return Array.from(this.items.values());
  }

  clone(): Inventory {
    const inv = new Inventory(this.slots);
    for (const [id, stack] of this.items) {
      inv.items.set(id, { ...stack });
    }
    return inv;
  }
}
