import { Component } from '../ecs';

export type NpcType = 'hostile' | 'friendly' | 'neutral' | 'merchant' | 'boss';

export const NPC_COMPONENT = 'npc';

export class Npc extends Component {
  readonly type = NPC_COMPONENT;

  public npcType: NpcType;
  public npcName: string;
  public level: number;
  public expReward: number;
  public goldReward: number;
  public lootTable: string[];
  public aiState: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead' = 'idle';
  public aggroRange: number = 5;
  public lastAiUpdate: number = 0;

  constructor(
    npcType: NpcType,
    npcName: string,
    level: number,
    expReward: number,
    goldReward: number,
    lootTable: string[] = []
  ) {
    super();
    this.npcType = npcType;
    this.npcName = npcName;
    this.level = level;
    this.expReward = expReward;
    this.goldReward = goldReward;
    this.lootTable = lootTable;
  }

  get isHostile(): boolean {
    return this.npcType === 'hostile' || this.npcType === 'boss';
  }

  get isMerchant(): boolean {
    return this.npcType === 'merchant';
  }

  clone(): Npc {
    const n = new Npc(this.npcType, this.npcName, this.level, this.expReward, this.goldReward, [...this.lootTable]);
    n.aiState = this.aiState;
    n.aggroRange = this.aggroRange;
    n.lastAiUpdate = this.lastAiUpdate;
    return n;
  }
}
