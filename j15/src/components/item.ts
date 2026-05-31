import { Component } from '../ecs';

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'currency';

export const ITEM_COMPONENT = 'item';

export class Item extends Component {
  readonly type = ITEM_COMPONENT;

  public itemId: string;
  public name: string;
  public itemType: ItemType;
  public rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  public stats: Record<string, number>;
  public description: string;
  public stackable: boolean;
  public maxStack: number;
  public value: number;

  constructor(
    itemId: string,
    name: string,
    itemType: ItemType,
    rarity: Item['rarity'] = 'common',
    stats: Record<string, number> = {},
    description: string = '',
    stackable: boolean = false,
    maxStack: number = 1,
    value: number = 0
  ) {
    super();
    this.itemId = itemId;
    this.name = name;
    this.itemType = itemType;
    this.rarity = rarity;
    this.stats = stats;
    this.description = description;
    this.stackable = stackable;
    this.maxStack = maxStack;
    this.value = value;
  }

  clone(): Item {
    return new Item(
      this.itemId,
      this.name,
      this.itemType,
      this.rarity,
      { ...this.stats },
      this.description,
      this.stackable,
      this.maxStack,
      this.value
    );
  }
}
