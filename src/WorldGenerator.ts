import Phaser from "phaser";

interface WorldGeneratorConfig {
  tileSize: number;
  chestSpawnInterval: number;
  cloudSpawnInterval: number;
  minChestDistance: number;
}

/**
 * Seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  between(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

export class WorldGenerator {
  private scene: Phaser.Scene;
  private config: WorldGeneratorConfig;
  private groundY: number;
  private rng: SeededRandom;

  public lastGroundX: number = 0;
  public lastChestX: number = 0;
  public lastCloudX: number = 0;

  constructor(
    scene: Phaser.Scene,
    groundY: number,
    config: WorldGeneratorConfig,
    seed: number = Date.now()
  ) {
    this.scene = scene;
    this.groundY = groundY;
    this.config = config;
    this.rng = new SeededRandom(seed);
    console.log("🌍 WorldGenerator initialized with seed:", seed);
  }

  /**
   * Generate ground terrain between startX and endX
   */
  generateGround(
    startX: number,
    endX: number,
    dirtGroup: Phaser.Physics.Arcade.StaticGroup,
    groundGroup: Phaser.Physics.Arcade.StaticGroup,
    lavaGroup: Phaser.Physics.Arcade.StaticGroup,
    safeZoneX?: number
  ) {
    const numTiles = Math.ceil((endX - startX) / this.config.tileSize);

    // Generate dirt layer
    this.generateTileLayer(
      startX,
      numTiles,
      this.groundY,
      Math.ceil(
        (this.scene.cameras.main.height - this.groundY) / this.config.tileSize
      ),
      dirtGroup,
      "dirt"
    );

    // Generate grass and lava layer on top with constraint
    this.generateGroundSurface(
      startX,
      numTiles,
      groundGroup,
      lavaGroup,
      safeZoneX
    );

    this.lastGroundX = endX;
  }

  /**
   * Generate the surface layer with grass and lava tiles
   */
  private generateGroundSurface(
    startX: number,
    numTiles: number,
    groundGroup: Phaser.Physics.Arcade.StaticGroup,
    lavaGroup: Phaser.Physics.Arcade.StaticGroup,
    safeZoneX?: number
  ) {
    let consecutiveLava = 0;
    const safeZoneRadius = this.config.tileSize * 3; // 3 tiles radius around spawn

    for (let i = 0; i < numTiles; i++) {
      const x = startX + i * this.config.tileSize;

      // Check if this position is in the safe zone around player spawn
      const isInSafeZone =
        safeZoneX !== undefined && Math.abs(x - safeZoneX) < safeZoneRadius;

      // 20% chance of lava, but max 3 consecutive, and not in safe zone
      const shouldBeLava =
        !isInSafeZone && this.rng.random() < 0.2 && consecutiveLava < 3;

      if (shouldBeLava) {
        lavaGroup.create(x, this.groundY, "lava").setOrigin(0, 0).refreshBody();
        consecutiveLava++;
      } else {
        groundGroup
          .create(x, this.groundY, "grass")
          .setOrigin(0, 0)
          .refreshBody();
        consecutiveLava = 0; // Reset counter
      }
    }
  }

  /**
   * Generate a layer of tiles
   */
  private generateTileLayer(
    startX: number,
    numTiles: number,
    startY: number,
    rows: number,
    group: Phaser.Physics.Arcade.StaticGroup,
    texture: string
  ) {
    for (let i = 0; i < numTiles; i++) {
      const x = startX + i * this.config.tileSize;
      for (let j = 0; j < rows; j++) {
        group
          .create(x, startY + j * this.config.tileSize, texture)
          .setOrigin(0, 0)
          .refreshBody();
      }
    }
  }

  /**
   * Generate chests between startX and endX
   */
  generateChests(
    startX: number,
    endX: number,
    chestGroup: Phaser.Physics.Arcade.StaticGroup
  ) {
    const chestY = this.groundY - this.config.tileSize;
    const numChests = Math.floor(
      (endX - startX) / this.config.chestSpawnInterval
    );

    for (let i = 0; i < numChests; i++) {
      const randomX = this.findValidChestPosition(startX, endX, chestGroup);
      if (randomX !== null) {
        chestGroup
          .create(randomX, chestY, "chest")
          .setOrigin(0, 0)
          .refreshBody();
      }
    }

    this.lastChestX = endX;
  }

  /**
   * Find a valid position for a chest that doesn't overlap with existing chests
   */
  private findValidChestPosition(
    startX: number,
    endX: number,
    chestGroup: Phaser.Physics.Arcade.StaticGroup,
    maxAttempts = 10
  ): number | null {
    const existingChests =
      chestGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const randomX = this.rng.between(startX + 50, endX - 50);

      const hasOverlap = existingChests.some(
        (chest) => Math.abs(chest.x - randomX) < this.config.minChestDistance
      );

      if (!hasOverlap) return randomX;
    }

    return null;
  }

  /**
   * Generate clouds for background decoration
   */
  generateClouds(startX: number, endX: number) {
    const numClouds = Math.floor(
      (endX - startX) / this.config.cloudSpawnInterval
    );

    for (let i = 0; i < numClouds; i++) {
      const randomX = this.rng.between(startX, endX);
      const randomY = this.rng.between(50, this.groundY - 150);

      const cloud = this.scene.add.graphics();
      cloud.fillStyle(0xffffff, 0.8);
      cloud.fillRect(
        randomX,
        randomY,
        this.config.tileSize,
        this.config.tileSize
      );
      cloud.setScrollFactor(0.5);
    }

    this.lastCloudX = endX;
  }
}
