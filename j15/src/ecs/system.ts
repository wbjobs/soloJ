import { World } from './world';

export abstract class System {
  abstract readonly name: string;
  abstract readonly requiredComponents: string[];

  world!: World;

  init(world: World): void {
    this.world = world;
    this.onInit();
  }

  protected onInit(): void {}

  abstract update(deltaTime: number): void;

  protected getEntitiesWithRequiredComponents(): string[] {
    return this.world.getEntitiesWithComponents(this.requiredComponents);
  }
}
