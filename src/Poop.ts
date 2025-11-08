import Phaser from "phaser";

export class Poop extends Phaser.Physics.Arcade.Sprite {
  private playerName: string;
  constructor(scene: Phaser.Scene, x: number, y: number, playerName: string) {
    super(scene, x, y, "poop");
    this.playerName = playerName;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(0, 100); // Small initial downward velocity
    this.setScale(0.5); // Adjust scale as needed
  }

  public getPlayerName(): string {
    return this.playerName;
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image("poop", "assets/poop.png");
  }
}
