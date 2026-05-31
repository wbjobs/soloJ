import { Component } from '../ecs';

export interface SkillData {
  skillId: string;
  name: string;
  damage: number;
  cooldown: number;
  currentCooldown: number;
  manaCost: number;
  range: number;
  description: string;
}

export const SKILL_COMPONENT = 'skill';

export class Skill extends Component {
  readonly type = SKILL_COMPONENT;

  public skills: Map<string, SkillData> = new Map();

  constructor() {
    super();
  }

  addSkill(skill: Omit<SkillData, 'currentCooldown'>): void {
    this.skills.set(skill.skillId, { ...skill, currentCooldown: 0 });
  }

  removeSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  hasSkill(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  getSkill(skillId: string): SkillData | undefined {
    return this.skills.get(skillId);
  }

  canUse(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    return skill !== undefined && skill.currentCooldown <= 0;
  }

  useSkill(skillId: string): SkillData | undefined {
    const skill = this.skills.get(skillId);
    if (!skill || skill.currentCooldown > 0) return undefined;
    skill.currentCooldown = skill.cooldown;
    return skill;
  }

  tickCooldowns(deltaTime: number): void {
    for (const skill of this.skills.values()) {
      if (skill.currentCooldown > 0) {
        skill.currentCooldown = Math.max(0, skill.currentCooldown - deltaTime);
      }
    }
  }

  getAvailableSkills(): SkillData[] {
    return Array.from(this.skills.values());
  }

  clone(): Skill {
    const s = new Skill();
    for (const [id, data] of this.skills) {
      s.skills.set(id, { ...data });
    }
    return s;
  }
}
