import Phaser from "phaser";
import { Player } from "./Player";
import { CollisionManager } from "./CollisionManager";
import { PhysicsGroupManager } from "./PhysicsGroupManager";

const TILE_SIZE = 32;
const WORLD_WIDTH = 100000;

/**
 * Manages player death, respawning, lives tracking, and safe position management
 */
export class RespawnManager {
  private scene: Phaser.Scene;
  private player: Player;
  private physicsGroups: PhysicsGroupManager;
  private groundY: number;
  private lives: number = 3;
  private lastSafePosition: { x: number; y: number };
  private isRespawning: boolean = false;
  private onLivesChangedCallback?: (lives: number) => void;
  private onPlayerDeathCallback?: () => void;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    physicsGroups: PhysicsGroupManager,
    groundY: number,
    initialX: number,
    initialY: number
  ) {
    this.scene = scene;
    this.player = player;
    this.physicsGroups = physicsGroups;
    this.groundY = groundY;
    this.lastSafePosition = { x: initialX, y: initialY };
  }

  /**
   * Set callback for when lives change
   */
  onLivesChanged(callback: (lives: number) => void): void {
    this.onLivesChangedCallback = callback;
  }

  /**
   * Set callback for when player dies permanently
   */
  onPlayerDeath(callback: () => void): void {
    this.onPlayerDeathCallback = callback;
  }

  /**
   * Get current lives count
   */
  getLives(): number {
    return this.lives;
  }

  /**
   * Get respawning state
   */
  isCurrentlyRespawning(): boolean {
    return this.isRespawning;
  }

  /**
   * Get last safe position
   */
  getLastSafePosition(): { x: number; y: number } {
    return this.lastSafePosition;
  }

  /**
   * Update last safe position if player is in a safe location
   */
  updateSafePosition(): void {
    if (this.player.body?.touching.down && !this.isRespawning) {
      // Check if current position is safe (on grass, not lava)
      const isSafe = CollisionManager.isPlayerOnGrass(
        this.player,
        this.physicsGroups.ground,
        this.physicsGroups.lava
      );

      if (isSafe) {
        this.lastSafePosition = { x: this.player.x, y: this.player.y };
      }
    }
  }

  /**
   * Handle lava damage and potential death
   */
  handleLavaDamage(): void {
    // Try to apply damage (returns false if player is immune)
    const damageApplied = this.player.takeDamageWithImmunity(25);

    if (damageApplied) {
      console.log(`Player hit lava! Health: ${this.player.getHealth()}`);

      // Play hit sound
      this.scene.sound.play("playerHit");

      // Check if player died from the damage
      if (this.player.getHealth() === 0) {
        this.handlePlayerDeath();
      }
    }
  }

  /**
   * Handle player death
   */
  private handlePlayerDeath(): void {
    this.lives--;
    console.log(`Player died! Lives remaining: ${this.lives}`);

    // Notify listeners
    if (this.onLivesChangedCallback) {
      this.onLivesChangedCallback(this.lives);
    }

    if (this.lives > 0) {
      // Respawn from sky and restore health
      this.respawnPlayer();
    } else {
      // No lives left - permanent death
      if (this.onPlayerDeathCallback) {
        this.onPlayerDeathCallback();
      }
      this.scene.sound.play("death");
    }
  }

  /**
   * Respawn the player from the sky
   */
  private respawnPlayer(): void {
    this.isRespawning = true;
    this.scene.sound.play("respawn");

    // Revive the player (re-enable physics and restore sprite)
    this.player.revive();

    // Restore player health to full
    this.player.setHealth(100);

    // Find a safe grass position to respawn to
    const safeX = this.findSafeRespawnPosition();

    // Position player high in the sky above safe position
    this.player.setPosition(safeX, -100);
    this.player.setVelocity(0, 0);

    // Update last safe position to the new safe spot
    this.lastSafePosition = { x: safeX, y: this.groundY - 59 / 2 };

    // Wait longer before allowing collision detection - give time to land safely
    this.scene.time.delayedCall(2500, () => {
      this.isRespawning = false;
    });
  }

  /**
   * Find the nearest safe grass position for respawning
   */
  private findSafeRespawnPosition(): number {
    const grassTiles =
      this.physicsGroups.ground.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const lavaTiles =
      this.physicsGroups.lava.getChildren() as Phaser.Physics.Arcade.Sprite[];

    // Start searching from last safe position
    let searchX = this.lastSafePosition.x;

    // Check if last safe position is still safe
    const isStillSafe = CollisionManager.checkPositionIsSafe(
      searchX,
      TILE_SIZE,
      grassTiles,
      lavaTiles
    );
    if (isStillSafe) {
      return searchX;
    }

    // Search for nearest safe grass tile (prefer moving left towards start)
    for (let offset = TILE_SIZE; offset < 500; offset += TILE_SIZE) {
      // Try left first
      const leftX = searchX - offset;
      if (
        leftX >= 0 &&
        CollisionManager.checkPositionIsSafe(
          leftX,
          TILE_SIZE,
          grassTiles,
          lavaTiles
        )
      ) {
        return leftX;
      }

      // Try right
      const rightX = searchX + offset;
      if (
        rightX < WORLD_WIDTH &&
        CollisionManager.checkPositionIsSafe(
          rightX,
          TILE_SIZE,
          grassTiles,
          lavaTiles
        )
      ) {
        return rightX;
      }
    }

    // Fallback to spawn position
    return 200;
  }
}
