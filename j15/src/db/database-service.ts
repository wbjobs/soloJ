import Database from 'better-sqlite3';
import path from 'path';
import { Player, Position, Health, Inventory, Skill, Combat, Mana } from '../components';

export interface PlayerSaveData {
  playerId: string;
  name: string;
  level: number;
  experience: number;
  gold: number;
  x: number;
  y: number;
  healthCurrent: number;
  healthMax: number;
  manaCurrent: number;
  manaMax: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critMultiplier: number;
  inventory: { itemId: string; quantity: number }[];
  skills: { skillId: string; name: string; damage: number; cooldown: number; manaCost: number; range: number; description: string }[];
  lastLogin: number;
  partyId: string | null;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string = './data/game.db') {
    const dir = path.dirname(dbPath);
    require('fs').mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeSchema();
    console.log('[DatabaseService] Database initialized');
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        player_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        gold INTEGER DEFAULT 0,
        x REAL DEFAULT 0,
        y REAL DEFAULT 0,
        health_current REAL DEFAULT 100,
        health_max REAL DEFAULT 100,
        mana_current REAL DEFAULT 50,
        mana_max REAL DEFAULT 50,
        attack REAL DEFAULT 10,
        defense REAL DEFAULT 5,
        speed REAL DEFAULT 100,
        crit_chance REAL DEFAULT 0.05,
        crit_multiplier REAL DEFAULT 1.5,
        last_login INTEGER,
        party_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now'))
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS player_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        name TEXT NOT NULL,
        damage REAL DEFAULT 0,
        cooldown REAL DEFAULT 0,
        mana_cost REAL DEFAULT 0,
        range REAL DEFAULT 1,
        description TEXT,
        FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS item_definitions (
        item_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        rarity TEXT DEFAULT 'common',
        stats TEXT DEFAULT '{}',
        description TEXT,
        stackable INTEGER DEFAULT 0,
        max_stack INTEGER DEFAULT 1,
        value INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory_items(player_id);
      CREATE INDEX IF NOT EXISTS idx_skills_player ON player_skills(player_id);
    `);

    this.seedItemDefinitions();
  }

  private seedItemDefinitions(): void {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM item_definitions').get() as { count: number };
    if (count.count > 0) return;

    type ItemSeed = { item_id: string; name: string; item_type: string; rarity: string; stats: string; description: string; stackable: number; max_stack: number; value: number };

    const items: ItemSeed[] = [
      { item_id: 'sword_wooden', name: '木剑', item_type: 'weapon', rarity: 'common', stats: '{"attack":5}', description: '一把简单的木剑', stackable: 0, max_stack: 1, value: 10 },
      { item_id: 'sword_iron', name: '铁剑', item_type: 'weapon', rarity: 'uncommon', stats: '{"attack":15}', description: '一把锋利的铁剑', stackable: 0, max_stack: 1, value: 50 },
      { item_id: 'sword_steel', name: '钢剑', item_type: 'weapon', rarity: 'rare', stats: '{"attack":30}', description: '一把坚固的钢剑', stackable: 0, max_stack: 1, value: 200 },
      { item_id: 'shield_wooden', name: '木盾', item_type: 'armor', rarity: 'common', stats: '{"defense":3}', description: '一面简单的木盾', stackable: 0, max_stack: 1, value: 15 },
      { item_id: 'shield_iron', name: '铁盾', item_type: 'armor', rarity: 'uncommon', stats: '{"defense":10}', description: '一面坚固的铁盾', stackable: 0, max_stack: 1, value: 75 },
      { item_id: 'potion_health', name: '生命药水', item_type: 'consumable', rarity: 'common', stats: '{"heal":30}', description: '恢复30点生命', stackable: 1, max_stack: 20, value: 20 },
      { item_id: 'potion_mana', name: '魔法药水', item_type: 'consumable', rarity: 'common', stats: '{"manaRestore":20}', description: '恢复20点法力', stackable: 1, max_stack: 20, value: 15 },
      { item_id: 'potion_health_large', name: '大型生命药水', item_type: 'consumable', rarity: 'uncommon', stats: '{"heal":100}', description: '恢复100点生命', stackable: 1, max_stack: 20, value: 60 },
      { item_id: 'material_wood', name: '木材', item_type: 'material', rarity: 'common', stats: '{}', description: '普通的木材', stackable: 1, max_stack: 99, value: 2 },
      { item_id: 'material_iron', name: '铁矿', item_type: 'material', rarity: 'common', stats: '{}', description: '铁矿石', stackable: 1, max_stack: 99, value: 5 },
      { item_id: 'material_steel', name: '钢材', item_type: 'material', rarity: 'uncommon', stats: '{}', description: '精炼的钢材', stackable: 1, max_stack: 99, value: 20 },
      { item_id: 'material_crystal', name: '魔法水晶', item_type: 'material', rarity: 'rare', stats: '{}', description: '蕴含魔力的水晶', stackable: 1, max_stack: 99, value: 100 },
      { item_id: 'quest_first_blood', name: '初战告捷', item_type: 'quest', rarity: 'common', stats: '{}', description: '击败第一个敌人的证明', stackable: 0, max_stack: 1, value: 0 },
      { item_id: 'quest_dragon_slayer', name: '屠龙勇士', item_type: 'quest', rarity: 'legendary', stats: '{}', description: '击败巨龙的证明', stackable: 0, max_stack: 1, value: 0 },
    ];

    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO item_definitions (item_id, name, item_type, rarity, stats, description, stackable, max_stack, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = this.db.transaction((seedItems: ItemSeed[]) => {
      for (const item of seedItems) {
        insert.run(item.item_id, item.name, item.item_type, item.rarity, item.stats, item.description, item.stackable, item.max_stack, item.value);
      }
    });

    tx(items);
    console.log('[DatabaseService] Seeded item definitions');
  }

  savePlayer(saveData: PlayerSaveData): void {
    const tx = this.db.transaction((data: PlayerSaveData) => {
      this.db.prepare(`
        INSERT OR REPLACE INTO players (
          player_id, name, level, experience, gold, x, y,
          health_current, health_max, mana_current, mana_max,
          attack, defense, speed, crit_chance, crit_multiplier,
          last_login, party_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
      `).run(
        data.playerId, data.name, data.level, data.experience, data.gold,
        data.x, data.y, data.healthCurrent, data.healthMax,
        data.manaCurrent, data.manaMax, data.attack, data.defense,
        data.speed, data.critChance, data.critMultiplier,
        data.lastLogin, data.partyId
      );

      this.db.prepare('DELETE FROM inventory_items WHERE player_id = ?').run(data.playerId);
      this.db.prepare('DELETE FROM player_skills WHERE player_id = ?').run(data.playerId);

      const invInsert = this.db.prepare(
        'INSERT INTO inventory_items (player_id, item_id, quantity) VALUES (?, ?, ?)'
      );
      for (const item of data.inventory) {
        invInsert.run(data.playerId, item.itemId, item.quantity);
      }

      const skillInsert = this.db.prepare(
        'INSERT INTO player_skills (player_id, skill_id, name, damage, cooldown, mana_cost, range, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const skill of data.skills) {
        skillInsert.run(data.playerId, skill.skillId, skill.name, skill.damage, skill.cooldown, skill.manaCost, skill.range, skill.description);
      }
    });

    tx(saveData);
  }

  loadPlayer(playerId: string): PlayerSaveData | null {
    const player = this.db.prepare('SELECT * FROM players WHERE player_id = ?').get(playerId) as any;
    if (!player) return null;

    const inventoryItems = this.db.prepare(
      'SELECT item_id, quantity FROM inventory_items WHERE player_id = ?'
    ).all(playerId) as { item_id: string; quantity: number }[];

    const skills = this.db.prepare(
      'SELECT skill_id, name, damage, cooldown, mana_cost, range, description FROM player_skills WHERE player_id = ?'
    ).all(playerId) as { skill_id: string; name: string; damage: number; cooldown: number; mana_cost: number; range: number; description: string }[];

    return {
      playerId: player.player_id,
      name: player.name,
      level: player.level,
      experience: player.experience,
      gold: player.gold,
      x: player.x,
      y: player.y,
      healthCurrent: player.health_current,
      healthMax: player.health_max,
      manaCurrent: player.mana_current,
      manaMax: player.mana_max,
      attack: player.attack,
      defense: player.defense,
      speed: player.speed,
      critChance: player.crit_chance,
      critMultiplier: player.crit_multiplier,
      inventory: inventoryItems.map(i => ({ itemId: i.item_id, quantity: i.quantity })),
      skills: skills.map(s => ({
        skillId: s.skill_id,
        name: s.name,
        damage: s.damage,
        cooldown: s.cooldown,
        manaCost: s.mana_cost,
        range: s.range,
        description: s.description
      })),
      lastLogin: player.last_login,
      partyId: player.party_id
    };
  }

  playerExists(playerId: string): boolean {
    const result = this.db.prepare('SELECT 1 FROM players WHERE player_id = ?').get(playerId);
    return !!result;
  }

  deletePlayer(playerId: string): void {
    this.db.prepare('DELETE FROM players WHERE player_id = ?').run(playerId);
  }

  getAllPlayers(): { playerId: string; name: string; level: number; lastLogin: number }[] {
    const rows = this.db.prepare('SELECT player_id, name, level, last_login FROM players ORDER BY last_login DESC').all() as any[];
    return rows.map(r => ({
      playerId: r.player_id,
      name: r.name,
      level: r.level,
      lastLogin: r.last_login
    }));
  }

  getItemDefinition(itemId: string): any | null {
    return this.db.prepare('SELECT * FROM item_definitions WHERE item_id = ?').get(itemId) || null;
  }

  getAllItemDefinitions(): any[] {
    return this.db.prepare('SELECT * FROM item_definitions').all() as any[];
  }

  close(): void {
    this.db.close();
    console.log('[DatabaseService] Database closed');
  }
}
