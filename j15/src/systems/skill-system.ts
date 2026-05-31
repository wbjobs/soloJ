import { System } from '../ecs';
import { Skill, SKILL_COMPONENT, Mana, MANA_COMPONENT } from '../components';

export class SkillSystem extends System {
  readonly name = 'SkillSystem';
  readonly requiredComponents = [SKILL_COMPONENT];

  canUseSkill(entityId: string, skillId: string): boolean {
    const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);
    const mana = this.world.getComponent<Mana>(entityId, MANA_COMPONENT);

    if (!skill || !skill.canUse(skillId)) return false;

    const skillData = skill.getSkill(skillId);
    if (!skillData) return false;

    if (mana && mana.current < skillData.manaCost) return false;

    return true;
  }

  useSkill(entityId: string, skillId: string): { damage: number; manaCost: number } | null {
    if (!this.canUseSkill(entityId, skillId)) return null;

    const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT)!;
    const mana = this.world.getComponent<Mana>(entityId, MANA_COMPONENT);
    const skillData = skill.getSkill(skillId)!;

    if (mana && !mana.spend(skillData.manaCost)) return null;

    skill.useSkill(skillId);

    return { damage: skillData.damage, manaCost: skillData.manaCost };
  }

  getSkillInfo(entityId: string, skillId: string): { name: string; damage: number; cooldown: number; manaCost: number; range: number } | null {
    const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);
    if (!skill) return null;

    const skillData = skill.getSkill(skillId);
    if (!skillData) return null;

    return {
      name: skillData.name,
      damage: skillData.damage,
      cooldown: skillData.cooldown,
      manaCost: skillData.manaCost,
      range: skillData.range
    };
  }

  getAllSkills(entityId: string): { skillId: string; name: string; cooldown: number; currentCooldown: number }[] {
    const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);
    if (!skill) return [];

    return skill.getAvailableSkills().map(s => ({
      skillId: s.skillId,
      name: s.name,
      cooldown: s.cooldown,
      currentCooldown: s.currentCooldown
    }));
  }

  update(deltaTime: number): void {
    const entities = this.getEntitiesWithRequiredComponents();
    for (const entityId of entities) {
      const skill = this.world.getComponent<Skill>(entityId, SKILL_COMPONENT);
      if (skill) {
        skill.tickCooldowns(deltaTime);
      }
    }
  }
}
