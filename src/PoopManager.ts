import Phaser from "phaser";
import { Poop } from "./Poop";
import { PoopType, ThrownPoopType } from "./Player";
import { PhysicsGroupManager } from "./PhysicsGroupManager";
import { Player } from "./Player";

/**
 * Manages poop creation, collection, throwing, and collisions
 */
export class PoopManager {
  private scene: Phaser.Scene;
  private poops: Phaser.GameObjects.Group;
  private poopsMap: Map<string, Poop>;
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
    this.poopsMap = new Map();

    this.poops = this.scene.add.group({
      runChildUpdate: true,
    });
  }

  /**
   * Create a dropped poop (not thrown)
   */
  createPoop(poopData: PoopType, playerName: string, poopId?: string): Poop {
    const poop = new Poop(
      this.scene,
      poopData.x,
      poopData.y,
      playerName,
      poopId
    );
    this.poops.add(poop);
    this.poopsMap.set(poop.getPoopId(), poop);

    // Add terrain collisions
    this.scene.physics.add.collider(poop, this.physicsGroups.ground);
    this.scene.physics.add.collider(poop, this.physicsGroups.dirt);

    return poop;
  }

  /**
   * Create a thrown poop with velocity and damage collisions
   */
  createThrownPoop(thrownPoopData: ThrownPoopType): Poop {
    const poop = new Poop(
      this.scene,
      thrownPoopData.x,
      thrownPoopData.y,
      thrownPoopData.playerName,
      undefined,
      true,
      thrownPoopData.maxDistance
    );
    this.poops.add(poop);
    this.poopsMap.set(poop.getPoopId(), poop);

    // Set the velocity for the thrown poop
    const body = poop.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(thrownPoopData.velocityX, thrownPoopData.velocityY);

    // Add terrain collisions
    this.scene.physics.add.collider(poop, this.physicsGroups.ground);
    this.scene.physics.add.collider(poop, this.physicsGroups.dirt);

    // Add damage collision with main player
    this.scene.physics.add.overlap(poop, this.mainPlayer, () => {
      const damaged = this.mainPlayer.takeDamageWithImmunity(10);
      if (damaged) {
        this.scene.sound.play("playerHit");
      }
      poop.destroy();
      this.poopsMap.delete(poop.getPoopId());
    });

    // Add damage collision with remote players
    this.remotePlayers.forEach((remotePlayer) => {
      this.scene.physics.add.overlap(poop, remotePlayer, () => {
        this.scene.sound.play("playerHit");
        poop.destroy();
        this.poopsMap.delete(poop.getPoopId());
      });
    });

    console.log(
      `💩 Created thrown poop with velocity (${thrownPoopData.velocityX}, ${thrownPoopData.velocityY})`
    );

    return poop;
  }

  /**
   * Remove a poop by its ID
   */
  removePoopById(poopId: string): void {
    const poop = this.poopsMap.get(poopId);
    if (poop) {
      this.poops.remove(poop, true, true);
      this.poopsMap.delete(poopId);
      poop.destroy();
      console.log(`💩 Removed poop: ${poopId}`);
    }
  }

  /**
   * Get a poop by its ID
   */
  getPoopById(poopId: string): Poop | undefined {
    return this.poopsMap.get(poopId);
  }

  /**
   * Get the poops group
   */
  getPoops(): Phaser.GameObjects.Group {
    return this.poops;
  }
}
