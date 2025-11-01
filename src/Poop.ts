import Phaser from "phaser";

export class Poop extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "poop");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(0, 100); // Small initial downward velocity
    this.setScale(0.5); // Adjust scale as needed
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image("poop", "assets/poop.png");
  }
}
