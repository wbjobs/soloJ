import { Component } from '../ecs';

export const MANA_COMPONENT = 'mana';

export class Mana extends Component {
  readonly type = MANA_COMPONENT;

  public current: number;
  public max: number;
  public regenRate: number;

  constructor(max: number, regenRate: number = 5) {
    super();
    this.max = max;
    this.current = max;
    this.regenRate = regenRate;
  }

  get isEmpty(): boolean {
    return this.current <= 0;
  }

  spend(amount: number): boolean {
    if (this.current < amount) return false;
    this.current -= amount;
    return true;
  }

  regen(deltaTime: number): void {
    this.current = Math.min(this.max, this.current + this.regenRate * deltaTime);
  }

  restore(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  clone(): Mana {
    const m = new Mana(this.max, this.regenRate);
    m.current = this.current;
    return m;
  }
}
