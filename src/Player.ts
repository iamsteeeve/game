import Phaser from "phaser";
import type { CONTROL_STATES } from "./constants";
import { Poop } from "./Poop";
import { CollisionManager } from "./CollisionManager";
import { NameTag } from "./NameTag";

export type ArrowType = {
  id?: string;
  x: number;
  y: number;
  direction: number;
  playerName?: string;
};

export type PoopType = {
  x: number;
  y: number;
  playerName: string;
};

export type ThrownPoopType = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  playerName: string;
  maxDistance: number;
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
  private nameTag: NameTag | null = null;
  private health: number = 100; // Health from 0 to 100
  private canShoot: boolean = true;
  private shootCooldown: number = 500; // milliseconds between shots
  private onShootCallback?: (arrow: ArrowType) => void;
  private onPoopCallback?: (poop: PoopType) => void;
  private onPoopCollectedCallback?: (poop: Poop) => void;
  private onThrowPoopCallback?: (poop: ThrownPoopType) => void;
  sound: SoundType;
  private mobileControlStates?: typeof CONTROL_STATES;
  private lastJumpState: boolean = false;
  private lastShootState: boolean = false;
  private lastPoopState: boolean = false;
  private lastCollectOrThrowState: boolean = false;
  private canPoop: boolean = true;
  private poopCooldown: number = 3000; // milliseconds between poops
  private isPooping: boolean = false;
  private poopsCollected: number = 0;
  private isImmune: boolean = false;
  private immunityDuration: number = 2000; // 2 seconds of immunity

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
      this.nameTag = new NameTag(scene, this.x, this.y - 30, this.playerName);
      this.nameTag.updateHealth(this.health);
    }
  }

  public updateNameText() {
    // Recreate name tag if it's missing but we have a name
    if (!this.nameTag && this.playerName && this.scene) {
      this.createNameText(this.scene);
    }

    if (this.nameTag) {
      if (this.isDead) {
        this.nameTag.setPosition(this.x, this.y + 15);
      } else {
        this.nameTag.setPosition(this.x, this.y - 30);
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

  public onThrowPoop(callback: (poop: ThrownPoopType) => void) {
    this.onThrowPoopCallback = callback;
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

  public collectPoop(): boolean {
    const poops = this.scene.children
      .getAll()
      .filter((child) => child instanceof Poop) as Poop[];

    if (poops.length === 0) return false;
    const poop = CollisionManager.isPlayerTouchingAnyPoop(
      this,
      poops
    ) as Poop | null;
    if (poop) {
      this.onPoopCollectedCallback?.(poop);
      return true;
    }
    return false;
  }

  private throwPoop() {
    if (this.poopsCollected <= 0) return;

    // Determine direction based on sprite flip
    const direction = this.flipX ? -1 : 1;

    // Random distance between 5 and 10 blocks (160 to 320 pixels, 32 pixels per block)
    const randomDistance = Phaser.Math.Between(5, 10) * 32;
    const throwDistance = randomDistance * direction;

    // Calculate velocity needed for the arc
    // Using physics: horizontal velocity and vertical velocity for a parabolic trajectory
    const throwTime = 1.0; // Time for the poop to travel (in seconds)
    const velocityX = throwDistance / throwTime;
    const velocityY = -400; // Upward velocity for arc
    const offsetX = direction * 30;
    const thrownPoop = {
      x: this.x + offsetX,
      y: this.y,
      velocityX: velocityX,
      velocityY: velocityY,
      playerName: this.playerName,
      maxDistance: randomDistance,
    };

    // Call the callback to let GameScene create the thrown poop
    if (this.onThrowPoopCallback) {
      this.onThrowPoopCallback(thrownPoop);
    }

    // Decrease poop count
    this.poopsCollected--;

    // Play throw sound (using poop sound for now)
    this.sound?.play("poop");
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

    const isCollectOrThrowPressed =
      this.poopCollectKey?.isDown || this.mobileControlStates?.collect;

    // Handle collect/throw with single press detection
    const isCollectOrThrowTriggered =
      isCollectOrThrowPressed && !this.lastCollectOrThrowState;

    if (isCollectOrThrowTriggered) {
      // Try to collect poop first
      const collected = this.collectPoop();

      // If no poop collected and player has poops in inventory, throw one
      if (!collected && this.poopsCollected > 0) {
        this.throwPoop();
      }
    }
    this.lastCollectOrThrowState = isCollectOrThrowPressed || false;

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
    if (this.isDead) return; // Prevent marking as dead multiple times

    this.isDead = true;
    this.health = 0;

    // Update name tag to show red background
    if (this.nameTag) {
      this.nameTag.updateHealth(0);
    }

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
   * Revive the player - re-enables physics and restores sprite
   */
  revive() {
    this.isDead = false;

    // Restore steve texture and origin
    this.setTexture("steve");
    this.setOrigin(0.5, 0.5);

    // Re-enable physics
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = true;
    }

    // Play idle animation
    this.play("steve-idle", true);
  }

  /**
   * Destroy player and cleanup
   */
  destroy(fromScene?: boolean) {
    if (this.nameTag) {
      this.nameTag.destroy();
      this.nameTag = null;
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
    if (this.nameTag) {
      this.nameTag.setName(name);
    }
  }

  /**
   * Get player health
   */
  getHealth(): number {
    return this.health;
  }

  /**
   * Set player health (0-100)
   * Updates the name tag color and marks player as dead if health reaches 0
   */
  setHealth(health: number) {
    this.health = Math.max(0, Math.min(100, health));

    // Update name tag with new health
    if (this.nameTag) {
      this.nameTag.updateHealth(this.health);
    }

    // Mark player as dead if health reaches 0
    if (this.health === 0 && !this.isDead) {
      this.markAsDead();
    }
  }

  /**
   * Damage the player by a certain amount
   */
  takeDamage(amount: number) {
    this.setHealth(this.health - amount);
  }

  /**
   * Heal the player by a certain amount
   */
  heal(amount: number) {
    this.setHealth(this.health + amount);
  }

  /**
   * Damage the player with immunity check
   * Returns true if damage was applied, false if player is immune
   */
  takeDamageWithImmunity(amount: number): boolean {
    if (this.isImmune || this.isDead) {
      return false;
    }

    this.takeDamage(amount);
    this.activateImmunity();
    return true;
  }

  /**
   * Activate immunity for the specified duration with visual feedback
   */
  private activateImmunity() {
    this.isImmune = true;

    // Flash effect - 3 times over 2 seconds (about 0.66s per flash cycle)
    const flashCount = 3;
    const flashDuration = this.immunityDuration / (flashCount * 2); // Divide by 2 for on/off

    for (let i = 0; i < flashCount; i++) {
      // Make invisible
      this.scene.time.delayedCall(i * flashDuration * 2, () => {
        this.setAlpha(0.3);
      });

      // Make visible
      this.scene.time.delayedCall(i * flashDuration * 2 + flashDuration, () => {
        this.setAlpha(1);
      });
    }

    // Remove immunity after duration
    this.scene.time.delayedCall(this.immunityDuration, () => {
      this.isImmune = false;
      this.setAlpha(1); // Ensure fully visible
    });
  }

  /**
   * Check if player is currently immune to damage
   */
  getIsImmune(): boolean {
    return this.isImmune;
  }

  /**
   * Set immunity visual state (for remote players)
   * This only updates the visual alpha, doesn't affect actual immunity logic
   */
  setImmuneVisual(immune: boolean) {
    if (immune) {
      this.setAlpha(0.3);
    } else {
      this.setAlpha(1);
    }
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
