import { Component } from '../ecs';

export const HEALTH_COMPONENT = 'health';

export class Health extends Component {
  readonly type = HEALTH_COMPONENT;

  public current: number;
  public max: number;
  public shield: number = 0;

  constructor(max: number) {
    super();
    this.max = max;
    this.current = max;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  takeDamage(amount: number): { actualDamage: number; isDead: boolean } {
    let remaining = amount;
    if (this.shield > 0) {
      const shieldAbsorb = Math.min(this.shield, remaining);
      this.shield -= shieldAbsorb;
      remaining -= shieldAbsorb;
    }
    this.current = Math.max(0, this.current - remaining);
    return { actualDamage: remaining, isDead: this.isDead };
  }

  heal(amount: number): number {
    const old = this.current;
    this.current = Math.min(this.max, this.current + amount);
    return this.current - old;
  }

  revive(): void {
    this.current = this.max;
    this.shield = 0;
  }

  clone(): Health {
    const h = new Health(this.max);
    h.current = this.current;
    h.shield = this.shield;
    return h;
  }
}
