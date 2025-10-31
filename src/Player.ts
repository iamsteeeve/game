import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private jumpCount: number = 0;
  private maxJumps: number = 2; // Allow double jump
  private isDead: boolean = false;
  private playerName: string = "";

  // Static method to preload assets
  static preload(scene: Phaser.Scene) {
    // Load Steve sprite sheet
    // Adjust frameWidth and frameHeight to match your sprite dimensions
    scene.load.spritesheet("steve", "assets/steve-move.png", {
      frameWidth: 34, // Adjust this to your sprite frame width
      frameHeight: 59, // Adjust this to your sprite frame height
    });
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerName: string = ""
  ) {
    super(scene, x, y, "steve");

    this.playerName = playerName;

    // Add this sprite to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create animations
    this.createAnimations(scene);

    // Set physics properties
    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setDragX(400); // Only apply drag to horizontal movement
    this.setGravityY(0); // Use world gravity, not sprite-specific gravity

    // Set up keyboard controls
    this.cursors = scene.input.keyboard?.createCursorKeys();
    this.spaceKey = scene.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // Play idle animation by default
    this.play("steve-idle");
  }

  private createAnimations(scene: Phaser.Scene) {
    // Check if animations already exist to avoid duplicates
    if (scene.anims.exists("steve-idle")) return;

    // Adjust frame numbers based on your sprite sheet layout
    // Idle animation
    scene.anims.create({
      key: "steve-idle",
      frames: scene.anims.generateFrameNumbers("steve", { start: 0, end: 0 }),
      frameRate: 10,
      repeat: -1,
    });

    // Walk right animation
    scene.anims.create({
      key: "steve-walk-right",
      frames: scene.anims.generateFrameNumbers("steve", { start: 0, end: 2 }),
      frameRate: 10,
      yoyo: true,
      repeat: -1,
    });

    // Walk left animation
    scene.anims.create({
      key: "steve-walk-left",
      frames: scene.anims.generateFrameNumbers("steve", { start: 0, end: 2 }),
      frameRate: 10,
      yoyo: true,
      repeat: -1,
    });
  }

  update() {
    // Don't update if player is dead
    if (this.isDead || !this.cursors) return;

    const speed = 300;
    const jumpVelocity = -350; // Increased to compensate for higher gravity (keeps same height)
    let moving = false;

    // Reset jump count when on the ground
    if (this.body?.touching.down) {
      this.jumpCount = 0;
    }

    // Horizontal movement
    if (this.cursors.left?.isDown) {
      this.setVelocityX(-speed);
      this.play("steve-walk-left", true);
      moving = true;
    } else if (this.cursors.right?.isDown) {
      this.setVelocityX(speed);
      this.play("steve-walk-right", true);
      moving = true;
    } else {
      this.setVelocityX(0);
    }

    // Jump with spacebar (allows double jump)
    if (
      Phaser.Input.Keyboard.JustDown(this.spaceKey!) &&
      this.jumpCount < this.maxJumps
    ) {
      this.setVelocityY(jumpVelocity);
      this.jumpCount++;
    }

    // Play idle animation when not moving horizontally
    if (!moving) {
      this.play("steve-idle", true);
    }
  }

  /**
   * Mark the player as dead - stops physics and movement
   */
  markAsDead() {
    this.isDead = true;
    this.playerName = "dead";

    // Stop player physics
    this.setVelocity(0, 0);
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }
  }

  /**
   * Get player name
   */
  getPlayerName(): string {
    return this.playerName;
  }

  /**
   * Set player name
   */
  setPlayerName(name: string) {
    this.playerName = name;
  }
}
