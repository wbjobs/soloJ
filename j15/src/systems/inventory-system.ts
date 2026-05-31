import { System } from '../ecs';
import { Inventory, INVENTORY_COMPONENT, Item, ITEM_COMPONENT } from '../components';

export interface TradeSession {
  id: string;
  initiatorId: string;
  targetId: string;
  initiatorOffers: { itemId: string; quantity: number; gold: number }[];
  targetOffers: { itemId: string; quantity: number; gold: number }[];
  initiatorConfirmed: boolean;
  targetConfirmed: boolean;
  createdAt: number;
}

export class InventorySystem extends System {
  readonly name = 'InventorySystem';
  readonly requiredComponents = [INVENTORY_COMPONENT];

  private trades: Map<string, TradeSession> = new Map();
  private entityTrades: Map<string, string> = new Map();

  addItem(entityId: string, itemId: string, quantity: number = 1): boolean {
    const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
    if (!inventory) return false;
    return inventory.addItem(itemId, quantity);
  }

  removeItem(entityId: string, itemId: string, quantity: number = 1): boolean {
    const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
    if (!inventory) return false;
    return inventory.removeItem(itemId, quantity);
  }

  hasItem(entityId: string, itemId: string, quantity: number = 1): boolean {
    const inventory = this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
    if (!inventory) return false;
    return inventory.hasItem(itemId, quantity);
  }

  getInventory(entityId: string): Inventory | undefined {
    return this.world.getComponent<Inventory>(entityId, INVENTORY_COMPONENT);
  }

  transferItem(fromId: string, toId: string, itemId: string, quantity: number): boolean {
    if (!this.hasItem(fromId, itemId, quantity)) return false;
    if (!this.addItem(toId, itemId, quantity)) return false;
    this.removeItem(fromId, itemId, quantity);
    return true;
  }

  requestTrade(initiatorId: string, targetId: string): TradeSession | null {
    if (this.entityTrades.has(initiatorId) || this.entityTrades.has(targetId)) return null;

    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const session: TradeSession = {
      id: tradeId,
      initiatorId,
      targetId,
      initiatorOffers: [],
      targetOffers: [],
      initiatorConfirmed: false,
      targetConfirmed: false,
      createdAt: Date.now()
    };

    this.trades.set(tradeId, session);
    this.entityTrades.set(initiatorId, tradeId);
    this.entityTrades.set(targetId, tradeId);
    return session;
  }

  addTradeOffer(tradeId: string, entityId: string, itemId: string, quantity: number, gold: number = 0): boolean {
    const trade = this.trades.get(tradeId);
    if (!trade) return false;

    const isInitiator = entityId === trade.initiatorId;
    const offers = isInitiator ? trade.initiatorOffers : trade.targetOffers;
    offers.push({ itemId, quantity, gold });
    trade.initiatorConfirmed = false;
    trade.targetConfirmed = false;
    return true;
  }

  confirmTrade(tradeId: string, entityId: string): boolean {
    const trade = this.trades.get(tradeId);
    if (!trade) return false;

    if (entityId === trade.initiatorId) {
      trade.initiatorConfirmed = true;
    } else if (entityId === trade.targetId) {
      trade.targetConfirmed = true;
    }

    if (trade.initiatorConfirmed && trade.targetConfirmed) {
      return this.executeTrade(trade);
    }
    return true;
  }

  cancelTrade(tradeId: string, entityId: string): boolean {
    const trade = this.trades.get(tradeId);
    if (!trade) return false;

    this.trades.delete(tradeId);
    this.entityTrades.delete(trade.initiatorId);
    this.entityTrades.delete(trade.targetId);
    return true;
  }

  private executeTrade(trade: TradeSession): boolean {
    for (const offer of trade.initiatorOffers) {
      if (offer.itemId && !this.hasItem(trade.initiatorId, offer.itemId, offer.quantity)) {
        return false;
      }
    }
    for (const offer of trade.targetOffers) {
      if (offer.itemId && !this.hasItem(trade.targetId, offer.itemId, offer.quantity)) {
        return false;
      }
    }

    for (const offer of trade.initiatorOffers) {
      if (offer.itemId) {
        this.transferItem(trade.initiatorId, trade.targetId, offer.itemId, offer.quantity);
      }
      if (offer.gold > 0) {
        this.transferGold(trade.initiatorId, trade.targetId, offer.gold);
      }
    }
    for (const offer of trade.targetOffers) {
      if (offer.itemId) {
        this.transferItem(trade.targetId, trade.initiatorId, offer.itemId, offer.quantity);
      }
      if (offer.gold > 0) {
        this.transferGold(trade.targetId, trade.initiatorId, offer.gold);
      }
    }

    this.trades.delete(trade.id);
    this.entityTrades.delete(trade.initiatorId);
    this.entityTrades.delete(trade.targetId);
    return true;
  }

  transferGold(fromId: string, toId: string, amount: number): boolean {
    const fromPlayer = this.world.getComponent<any>(fromId, 'player');
    const toPlayer = this.world.getComponent<any>(toId, 'player');
    if (!fromPlayer || !toPlayer) return false;
    if (!fromPlayer.spendGold(amount)) return false;
    toPlayer.addGold(amount);
    return true;
  }

  getEntityTrade(entityId: string): TradeSession | undefined {
    const tradeId = this.entityTrades.get(entityId);
    return tradeId ? this.trades.get(tradeId) : undefined;
  }

  update(deltaTime: number): void {
    const now = Date.now();
    const timeout = 120000;

    for (const [tradeId, trade] of this.trades) {
      if (now - trade.createdAt > timeout) {
        this.trades.delete(tradeId);
        this.entityTrades.delete(trade.initiatorId);
        this.entityTrades.delete(trade.targetId);
      }
    }
  }
}
