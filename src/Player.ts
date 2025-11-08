import Phaser from "phaser";
import type { CONTROL_STATES } from "./constants";
import { Poop } from "./Poop";
import { CollisionManager } from "./CollisionManager";

export type ArrowType = {
  id?: string;
  x: number;
  y: number;
  direction: number;
  playerName?: string;
};

export type PoopType = {
  id?: string;
  x: number;
  y: number;
  playerName: string;
};

type SoundType =
  | Phaser.Sound.BaseSoundManager
  | Phaser.Sound.NoAudioSoundManager
  | Phaser.Sound.HTML5AudioSoundManager
  | Phaser.Sound.WebAudioSoundManager
  | undefined;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private xKey?: Phaser.Input.Keyboard.Key;
  private poopKey?: Phaser.Input.Keyboard.Key;
  private poopCollectKey?: Phaser.Input.Keyboard.Key;
  private jumpCount: number = 0;
  private maxJumps: number = 2; // Allow double jump
  private isDead: boolean = false;
  private playerName: string = "";
  private nameText: Phaser.GameObjects.Text | null = null;
  private canShoot: boolean = true;
  private shootCooldown: number = 500; // milliseconds between shots
  private onShootCallback?: (arrow: ArrowType) => void;
  private onPoopCallback?: (poop: PoopType) => void;
  private onPoopCollectedCallback?: (poop: Poop) => void;
  sound: SoundType;
  private mobileControlStates?: typeof CONTROL_STATES;
  private lastJumpState: boolean = false;
  private lastShootState: boolean = false;
  private lastPoopState: boolean = false;
  private canPoop: boolean = true;
  private poopCooldown: number = 3000; // milliseconds between poops
  private isPooping: boolean = false;
  private poopsCollected: number = 0;

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
    playerName: string = "",
    sound?: SoundType
  ) {
    super(scene, x, y, "steve");

    this.playerName = playerName;
    this.sound = sound;

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
    this.xKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.poopKey = scene.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.K
    );
    this.poopCollectKey = scene.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.C
    );

    // Create name text above player
    this.createNameText(scene);

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

  private createNameText(scene: Phaser.Scene) {
    if (this.playerName) {
      this.nameText = scene.add.text(this.x, this.y - 30, this.playerName, {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 4, y: 2 },
      });
      this.nameText.setOrigin(0.5, 1);
    }
  }

  public updateNameText() {
    // Recreate name text if it's missing but we have a name
    if (!this.nameText && this.playerName && this.scene) {
      this.createNameText(this.scene);
    }

    if (this.nameText) {
      this.nameText.setPosition(this.x, this.y - 30);
      if (this.isDead && this.nameText.text !== "dead") {
        //this.nameText.setText("dead");
        this.nameText.setPosition(this.x, this.y + 15);
      }
    }
  }

  public onShoot(callback: (arrow: ArrowType) => void) {
    this.onShootCallback = callback;
  }

  public onPoop(callback: (poop: PoopType) => void) {
    this.onPoopCallback = callback;
  }

  public onPoopCollected(callback: (poop: Poop) => void) {
    this.onPoopCollectedCallback = callback;
  }

  public setMobileControlStates(controlStates: typeof CONTROL_STATES) {
    this.mobileControlStates = controlStates;
  }

  private shoot() {
    this.canShoot = false;

    // Determine direction based on sprite flip
    const direction = this.flipX ? -1 : 1;

    // Create arrow slightly in front of player
    const offsetX = direction * 30;
    const arrow = {
      x: this.x + offsetX,
      y: this.y,
      direction: direction,
    };

    // Call the callback to let GameScene create the arrow
    if (this.onShootCallback) {
      this.onShootCallback(arrow);
    }
    // Play shoot sound
    this.sound?.play("shoot");
    // Cooldown before next shot
    this.scene.time.delayedCall(this.shootCooldown, () => {
      this.canShoot = true;
    });
  }

  private dropPoop() {
    this.canPoop = false;

    // Drop poop below player
    const poop = {
      x: this.x,
      y: this.y + 20, // Below the player
      playerName: this.playerName,
    };

    // Call the callback to let GameScene create the poop
    if (this.onPoopCallback) {
      this.onPoopCallback(poop);
    }

    // Play poop sound
    this.sound?.play("poop");

    // Cooldown before next poop
    this.scene.time.delayedCall(this.poopCooldown, () => {
      this.canPoop = true;
    });
  }

  public collectPoop() {
    const poops = this.scene.children
      .getAll()
      .filter((child) => child instanceof Poop) as Poop[];

    if (poops.length === 0) return;
    const poop = CollisionManager.isPlayerTouchingAnyPoop(
      this,
      poops
    ) as Poop | null;
    if (poop) {
      this.onPoopCollectedCallback?.(poop);
    }
  }

  public getPoopsCollected(): number {
    return this.poopsCollected;
  }

  public increasePoopsCollected(): void {
    this.poopsCollected++;
  }

  update() {
    // Update name text position
    this.updateNameText();

    // Don't update if player is dead or no cursors
    if (this.isDead || !this.cursors) return;

    const speed = 300;
    const jumpVelocity = -350; // Increased to compensate for higher gravity (keeps same height)
    let moving = false;

    // Reset jump count when on the ground
    if (this.body?.touching.down) {
      this.jumpCount = 0;
    }
    // Check if poop key is pressed
    const isPoopPressed = this.poopKey?.isDown || false;

    // Horizontal movement - check both keyboard and mobile controls
    const isLeftPressed =
      this.cursors.left?.isDown || this.mobileControlStates?.left;
    const isRightPressed =
      this.cursors.right?.isDown || this.mobileControlStates?.right;

    const isCollectPressed =
      this.poopCollectKey?.isDown || this.mobileControlStates?.collect;

    if (isCollectPressed) {
      this.collectPoop();
    }

    if (isLeftPressed) {
      this.setVelocityX(-speed);
      this.setFlipX(true); // Face left
      this.play("steve-walk-left", true);
      moving = true;
    } else if (isRightPressed) {
      this.setVelocityX(speed);
      this.setFlipX(false); // Face right
      this.play("steve-walk-right", true);
      moving = true;
    } else {
      this.setVelocityX(0);
    }

    // Shoot with X key or mobile shoot button
    const isShootPressed =
      this.xKey && Phaser.Input.Keyboard.JustDown(this.xKey);
    const isMobileShootTriggered =
      this.mobileControlStates?.shoot && !this.lastShootState;

    if ((isShootPressed || isMobileShootTriggered) && this.canShoot) {
      this.shoot();
    }
    this.lastShootState = this.mobileControlStates?.shoot || false;

    // Jump with spacebar or mobile jump button (allows double jump)
    const isJumpPressed =
      this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const isMobileJumpTriggered =
      this.mobileControlStates?.jump && !this.lastJumpState;

    if (
      (isJumpPressed || isMobileJumpTriggered) &&
      this.jumpCount < this.maxJumps
    ) {
      this.sound?.play("jump");
      this.setVelocityY(jumpVelocity);
      this.jumpCount++;
    }
    this.lastJumpState = this.mobileControlStates?.jump || false;

    // Handle poop - drop poop when K is pressed or mobile poop button
    const isMobilePoopTriggered =
      this.mobileControlStates?.poop && !this.lastPoopState;
    const isPoopActive =
      isPoopPressed || (this.mobileControlStates?.poop ?? false);

    // Update pooping state
    this.isPooping = isPoopActive;

    // Drop poop on initial press
    if (
      (isPoopPressed || isMobilePoopTriggered) &&
      !this.lastPoopState &&
      this.canPoop
    ) {
      this.dropPoop();
    }

    // Show steve-poop texture while poop is held
    if (isPoopActive) {
      this.setTexture("steve-poop");
    } else {
      // Revert to steve texture when not pooping
      if (this.texture.key === "steve-poop") {
        this.setTexture("steve");
      }
      // Play idle animation when not moving horizontally
      if (!moving) {
        this.play("steve-idle", true);
      }
    }

    this.lastPoopState = isPoopActive;
  }

  /**
   * Mark the player as dead - stops physics and movement
   */
  markAsDead() {
    this.isDead = true;
    /* this.playerName = "dead";

    // Update name text
    if (this.nameText) {
      this.nameText.setText("dead");
    } */
    this.setTexture("tombstone");
    this.setOrigin(0.5, -0.5);
    this.stop();

    // Stop player physics
    this.setVelocity(0, 0);
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }
  }

  /**
   * Destroy player and cleanup
   */
  destroy(fromScene?: boolean) {
    if (this.nameText) {
      this.nameText.destroy();
      this.nameText = null;
    }
    super.destroy(fromScene);
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

  getIsDead(): boolean {
    return this.isDead;
  }

  getIsPooping(): boolean {
    return this.isPooping;
  }

  setIsPooping(pooping: boolean) {
    this.isPooping = pooping;
    if (pooping) {
      this.setTexture("steve-poop");
    } else if (this.texture.key === "steve-poop") {
      this.setTexture("steve");
    }
  }
}
