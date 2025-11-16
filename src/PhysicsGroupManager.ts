import Phaser from "phaser";

export class PhysicsGroupManager {
  private scene: Phaser.Scene;

  public dirt!: Phaser.Physics.Arcade.StaticGroup;
  public ground!: Phaser.Physics.Arcade.StaticGroup;
  public lava!: Phaser.Physics.Arcade.StaticGroup;
  public chests!: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createGroups();
  }

  /**
   * Create all physics static groups
   */
  private createGroups() {
    this.dirt = this.scene.physics.add.staticGroup();
    this.ground = this.scene.physics.add.staticGroup();
    this.lava = this.scene.physics.add.staticGroup();
    this.chests = this.scene.physics.add.staticGroup();
  }
}
