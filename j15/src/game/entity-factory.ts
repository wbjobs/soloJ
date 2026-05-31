import { World } from '../ecs';
import { Position, Health, Inventory, Skill, SkillData, Player, Combat, Mana, Transform, Npc, NPC_COMPONENT } from '../components';
import { PlayerSaveData } from '../db';

const DEFAULT_SKILLS: Omit<SkillData, 'currentCooldown'>[] = [
  { skillId: 'basic_attack', name: '普通攻击', damage: 10, cooldown: 0, manaCost: 0, range: 1.5, description: '普通的物理攻击' },
  { skillId: 'power_strike', name: '强力一击', damage: 25, cooldown: 5, manaCost: 10, range: 1.5, description: '蓄力后造成强力伤害' },
  { skillId: 'defend', name: '防御', damage: 0, cooldown: 3, manaCost: 0, range: 0, description: '进入防御姿态，减少伤害' },
];

export class EntityFactory {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  createPlayerEntity(playerId: string, name: string, saveData?: PlayerSaveData): string {
    const entityId = this.world.createEntity();

    const level = saveData?.level ?? 1;
    const baseAttack = 10 + (level - 1) * 2;
    const baseDefense = 5 + (level - 1) * 1;
    const baseHealth = 100 + (level - 1) * 20;
    const baseMana = 50 + (level - 1) * 10;

    const player = new Player(playerId, name);
    player.level = saveData?.level ?? 1;
    player.experience = saveData?.experience ?? 0;
    player.gold = saveData?.gold ?? 100;
    player.lastLogin = Date.now();
    player.partyId = saveData?.partyId ?? null;

    const position = new Position(saveData?.x ?? 0, saveData?.y ?? 0, 'main');

    const health = new Health(saveData?.healthMax ?? baseHealth);
    health.current = saveData?.healthCurrent ?? health.max;

    const mana = new Mana(saveData?.manaMax ?? baseMana, 5);
    mana.current = saveData?.manaCurrent ?? mana.max;

    const combat = new Combat(
      saveData?.attack ?? baseAttack,
      saveData?.defense ?? baseDefense,
      100,
      0.05,
      1.5
    );

    const inventory = new Inventory(20);
    if (saveData?.inventory) {
      for (const item of saveData.inventory) {
        inventory.addItem(item.itemId, item.quantity);
      }
    } else {
      inventory.addItem('potion_health', 5);
      inventory.addItem('potion_mana', 3);
    }

    const skill = new Skill();
    if (saveData?.skills && saveData.skills.length > 0) {
      for (const s of saveData.skills) {
        skill.addSkill(s);
      }
    } else {
      for (const s of DEFAULT_SKILLS) {
        skill.addSkill(s);
      }
    }

    const transform = new Transform('down', 5);

    this.world.addComponent(entityId, player);
    this.world.addComponent(entityId, position);
    this.world.addComponent(entityId, health);
    this.world.addComponent(entityId, mana);
    this.world.addComponent(entityId, combat);
    this.world.addComponent(entityId, inventory);
    this.world.addComponent(entityId, skill);
    this.world.addComponent(entityId, transform);

    console.log(`[EntityFactory] Created player entity: ${entityId} for player ${playerId}`);
    return entityId;
  }

  createNpcEntity(npcType: 'hostile' | 'friendly' | 'neutral' | 'merchant' | 'boss', npcName: string, x: number, y: number, level: number): string {
    const entityId = this.world.createEntity();

    const baseHealth = 30 + level * 15;
    const baseAttack = 5 + level * 3;
    const baseDefense = 2 + level * 1;

    const npc = new Npc(npcType, npcName, level, level * 20, level * 10, this.getLootTableForNpc(npcType, level));
    const position = new Position(x, y, 'main');
    const health = new Health(baseHealth);
    const combat = new Combat(baseAttack, baseDefense, 80 + level * 5, 0.03, 1.4);
    const inventory = new Inventory(5);
    const transform = new Transform('down', 3);

    this.world.addComponent(entityId, npc);
    this.world.addComponent(entityId, position);
    this.world.addComponent(entityId, health);
    this.world.addComponent(entityId, combat);
    this.world.addComponent(entityId, inventory);
    this.world.addComponent(entityId, transform);

    console.log(`[EntityFactory] Created NPC entity: ${entityId} (${npcName}, Lv.${level})`);
    return entityId;
  }

  createItemEntity(itemId: string, x: number, y: number, quantity: number = 1): string {
    const entityId = this.world.createEntity();
    const position = new Position(x, y, 'main');

    this.world.addComponent(entityId, position);

    console.log(`[EntityFactory] Created item entity: ${entityId} (${itemId} x${quantity})`);
    return entityId;
  }

  private getLootTableForNpc(npcType: string, level: number): string[] {
    const lootTables: Record<string, string[]> = {
      hostile: ['material_wood', 'material_iron', 'potion_health', 'sword_iron'],
      boss: ['material_steel', 'material_crystal', 'potion_health_large', 'sword_steel', 'shield_iron'],
      merchant: [],
      friendly: [],
      neutral: []
    };

    return lootTables[npcType] || [];
  }

  removeEntity(entityId: string): void {
    this.world.removeEntity(entityId);
    console.log(`[EntityFactory] Removed entity: ${entityId}`);
  }
}
