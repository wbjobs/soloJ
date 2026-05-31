import { Component } from '../ecs';

export const PLAYER_COMPONENT = 'player';

export class Player extends Component {
  readonly type = PLAYER_COMPONENT;

  public playerId: string;
  public name: string;
  public level: number = 1;
  public experience: number = 0;
  public gold: number = 0;
  public isOnline: boolean = true;
  public lastLogin: number = Date.now();
  public partyId: string | null = null;
  public sessionId: string | null = null;

  constructor(playerId: string, name: string) {
    super();
    this.playerId = playerId;
    this.name = name;
  }

  get expToNextLevel(): number {
    return this.level * 100;
  }

  gainExp(amount: number): { leveledUp: boolean; newLevel: number } {
    this.experience += amount;
    let leveledUp = false;
    while (this.experience >= this.expToNextLevel) {
      this.experience -= this.expToNextLevel;
      this.level++;
      leveledUp = true;
    }
    return { leveledUp, newLevel: this.level };
  }

  addGold(amount: number): void {
    this.gold += amount;
  }

  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  joinParty(partyId: string): void {
    this.partyId = partyId;
  }

  leaveParty(): void {
    this.partyId = null;
  }

  clone(): Player {
    const p = new Player(this.playerId, this.name);
    p.level = this.level;
    p.experience = this.experience;
    p.gold = this.gold;
    p.isOnline = this.isOnline;
    p.lastLogin = this.lastLogin;
    p.partyId = this.partyId;
    p.sessionId = this.sessionId;
    return p;
  }
}
