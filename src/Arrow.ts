import Phaser from "phaser";

export class Arrow extends Phaser.Physics.Arcade.Sprite {
  private maxDistance: number;
  private startX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, direction: number) {
    super(scene, x, y, "arrow");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.setScale(0.5); // Adjust scale as needed

    // Set velocity based on direction (1 for right, -1 for left)
    const speed = 500;
    this.setVelocityX(speed * direction);

    // Flip sprite if shooting left
    this.setFlipX(direction < 0);

    // Store starting position and max distance (10 blocks = 10 * 32 pixels)
    this.startX = x;
    this.maxDistance = 10 * 32;
  }

  update() {
    // Check if arrow has traveled max distance
    if (Math.abs(this.x - this.startX) >= this.maxDistance) {
      this.destroy();
      return;
    }

    // Destroy if out of world bounds
    if (this.x < 0 || this.x > this.scene.physics.world.bounds.width) {
      this.destroy();
    }
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image("arrow", "assets/arrow.png");
  }
}
