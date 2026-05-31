class Component {
  constructor(name) {
    this.name = name;
  }
}

class PositionComponent extends Component {
  constructor(x, y) {
    super('position');
    this.x = x;
    this.y = y;
  }
}

class HealthComponent extends Component {
  constructor(maxHp) {
    super('health');
    this.maxHp = maxHp;
    this.currentHp = maxHp;
  }

  takeDamage(amount) {
    this.currentHp -= amount;
    return this.currentHp <= 0;
  }

  isDead() {
    return this.currentHp <= 0;
  }
}

class MovementComponent extends Component {
  constructor(speed) {
    super('movement');
    this.speed = speed;
    this.lastMoveTime = 0;
  }
}

class AttackComponent extends Component {
  constructor(damage, attackInterval) {
    super('attack');
    this.damage = damage;
    this.attackInterval = attackInterval;
    this.lastAttackTime = 0;
  }
}

class PlantComponent extends Component {
  constructor(plantType) {
    super('plant');
    this.plantType = plantType;
  }
}

class ZombieComponent extends Component {
  constructor(zombieType) {
    super('zombie');
    this.zombieType = zombieType;
  }
}

class RenderComponent extends Component {
  constructor(symbol) {
    super('render');
    this.symbol = symbol;
  }
}

module.exports = {
  Component,
  PositionComponent,
  HealthComponent,
  MovementComponent,
  AttackComponent,
  PlantComponent,
  ZombieComponent,
  RenderComponent
};
