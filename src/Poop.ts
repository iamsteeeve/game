import Phaser from "phaser";

export class Poop extends Phaser.Physics.Arcade.Sprite {
  private playerName: string;
  private poopId: string;
  private isThrown: boolean = false;
  private startX: number = 0;
  private maxDistance: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerName: string,
    poopId?: string,
    isThrown: boolean = false,
    maxDistance: number = 0
  ) {
    super(scene, x, y, "poop");
    this.playerName = playerName;
    this.poopId = poopId || `${playerName}_${Date.now()}_${Math.random()}`;
    this.isThrown = isThrown;
    this.startX = x;
    this.maxDistance = maxDistance;

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

  public getPoopId(): string {
    return this.poopId;
  }

  update() {
    // Check if thrown poop has traveled max distance
    if (this.isThrown && this.maxDistance > 0) {
      const distanceTraveled = Math.abs(this.x - this.startX);
      if (distanceTraveled >= this.maxDistance) {
        this.destroy();
      }
    }
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image("poop", "assets/poop.png");
  }
}
