import { Component } from '../ecs';

export const COMBAT_COMPONENT = 'combat';

export class Combat extends Component {
  readonly type = COMBAT_COMPONENT;

  public attack: number;
  public defense: number;
  public speed: number;
  public critChance: number;
  public critMultiplier: number;
  public isInBattle: boolean = false;
  public currentTargetId: string | null = null;
  public turnOrder: number = 0;
  public hasActed: boolean = false;

  constructor(
    attack: number = 10,
    defense: number = 5,
    speed: number = 100,
    critChance: number = 0.05,
    critMultiplier: number = 1.5
  ) {
    super();
    this.attack = attack;
    this.defense = defense;
    this.speed = speed;
    this.critChance = critChance;
    this.critMultiplier = critMultiplier;
  }

  calculateDamage(isCrit: boolean = false): number {
    let damage = this.attack;
    if (isCrit) {
      damage *= this.critMultiplier;
    }
    return damage;
  }

  rollCrit(): boolean {
    return Math.random() < this.critChance;
  }

  resetForNewBattle(): void {
    this.isInBattle = false;
    this.currentTargetId = null;
    this.hasActed = false;
  }

  clone(): Combat {
    const c = new Combat(this.attack, this.defense, this.speed, this.critChance, this.critMultiplier);
    c.isInBattle = this.isInBattle;
    c.currentTargetId = this.currentTargetId;
    c.turnOrder = this.turnOrder;
    c.hasActed = this.hasActed;
    return c;
  }
}
