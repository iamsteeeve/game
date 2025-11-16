import Phaser from "phaser";
import { Arrow } from "./Arrow";
import { ArrowType } from "./Player";
import { PhysicsGroupManager } from "./PhysicsGroupManager";
import { Player } from "./Player";

/**
 * Manages arrow creation, collisions, and lifecycle
 */
export class ArrowManager {
  private scene: Phaser.Scene;
  private arrows: Phaser.GameObjects.Group;
  private physicsGroups: PhysicsGroupManager;
  private mainPlayer: Player;
  private remotePlayers: Map<string, Player>;

  constructor(
    scene: Phaser.Scene,
    physicsGroups: PhysicsGroupManager,
    mainPlayer: Player,
    remotePlayers: Map<string, Player>
  ) {
    this.scene = scene;
    this.physicsGroups = physicsGroups;
    this.mainPlayer = mainPlayer;
    this.remotePlayers = remotePlayers;

    this.arrows = this.scene.add.group({
      runChildUpdate: true,
    });
  }

  /**
   * Create an arrow and set up all its collisions
   */
  createArrow(arrowData: ArrowType): Arrow {
    const arrow = new Arrow(
      this.scene,
      arrowData.x,
      arrowData.y,
      arrowData.direction
    );
    this.arrows.add(arrow);
    this.setupArrowCollisions(arrow);
    return arrow;
  }

  /**
   * Set up all collision handlers for an arrow
   */
  private setupArrowCollisions(arrow: Arrow): void {
    // Collisions with terrain
    this.scene.physics.add.collider(arrow, this.physicsGroups.ground, () => {
      arrow.destroy();
    });
    this.scene.physics.add.collider(arrow, this.physicsGroups.dirt, () => {
      arrow.destroy();
    });

    // Collision with main player
    this.scene.physics.add.overlap(arrow, this.mainPlayer, () => {
      const damaged = this.mainPlayer.takeDamageWithImmunity(10);
      if (damaged) {
        this.scene.sound.play("playerHit");
      }
      arrow.destroy();
    });

    // Collisions with remote players
    this.remotePlayers.forEach((remotePlayer) => {
      this.scene.physics.add.overlap(arrow, remotePlayer, () => {
        this.scene.sound.play("playerHit");
        arrow.destroy();
      });
    });
  }

  /**
   * Get the arrows group
   */
  getArrows(): Phaser.GameObjects.Group {
    return this.arrows;
  }
}
