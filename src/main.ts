import Phaser from "phaser";
import { Player } from "./Player";
import { CollisionManager } from "./CollisionManager";
import { WorldGenerator } from "./WorldGenerator";
import { UIManager } from "./UIManager";
import { PhysicsGroupManager } from "./PhysicsGroupManager";

// Constants
const TILE_SIZE = 32;
const WORLD_WIDTH = 100000;
const CHUNK_SIZE = 1000;
const INITIAL_GENERATION = 500;
const MIN_CHEST_DISTANCE = 100;
const CHEST_SPAWN_INTERVAL = 200;
const CLOUD_SPAWN_INTERVAL = 150;
const SKY_COLOR = { top: 0x87ceeb, bottom: 0xe0f6ff };

class GameScene extends Phaser.Scene {
  private player!: Player;
  private physicsGroups!: PhysicsGroupManager;
  private groundY!: number;
  private worldGenerator!: WorldGenerator;
  private uiManager!: UIManager;
  private lives: number = 3;
  private lastSafePosition: { x: number; y: number } = { x: 200, y: 0 };
  private isRespawning: boolean = false;

  constructor() {
    super({ key: "GameScene" });
  }

  preload() {
    Player.preload(this);
    this.load.image("grass", "assets/grass.png");
    this.load.image("dirt", "assets/dirt.png");
    this.load.image("chest", "assets/chest.png");
    this.load.image("lava", "assets/lava.png");
  }

  create() {
    this.uiManager = new UIManager(this);
    this.askForPlayerName();
  }

  private async askForPlayerName() {
    const playerName = await this.uiManager.showNamePrompt();
    this.startGame(playerName);
  }

  private startGame(playerName: string) {
    this.createBackground();
    this.setupWorld();
    this.createPhysicsGroups();
    this.generateInitialWorld();
    this.createPlayer(playerName);
    this.setupCamera();
    this.createUI();
    this.physics.resume();
  }

  private createBackground() {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(
      SKY_COLOR.top,
      SKY_COLOR.top,
      SKY_COLOR.bottom,
      SKY_COLOR.bottom,
      1
    );
    graphics.fillRect(0, 0, WORLD_WIDTH, this.cameras.main.height);
    graphics.setScrollFactor(0.3);
  }

  private setupWorld() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, this.cameras.main.height);
    this.groundY = this.cameras.main.height - 100 - TILE_SIZE;

    // Initialize world generator
    this.worldGenerator = new WorldGenerator(this, this.groundY, {
      tileSize: TILE_SIZE,
      chestSpawnInterval: CHEST_SPAWN_INTERVAL,
      cloudSpawnInterval: CLOUD_SPAWN_INTERVAL,
      minChestDistance: MIN_CHEST_DISTANCE,
    });
  }

  private createPhysicsGroups() {
    this.physicsGroups = new PhysicsGroupManager(this);
  }

  private generateInitialWorld() {
    // Pass player spawn X position (200) as safe zone for initial generation
    this.worldGenerator.generateGround(
      0,
      this.cameras.main.width + INITIAL_GENERATION,
      this.physicsGroups.dirt,
      this.physicsGroups.ground,
      this.physicsGroups.lava,
      200 // Safe zone at player spawn position
    );
    this.worldGenerator.generateClouds(
      0,
      this.cameras.main.width + INITIAL_GENERATION
    );
    this.worldGenerator.generateChests(
      0,
      this.cameras.main.width + INITIAL_GENERATION,
      this.physicsGroups.chests
    );
  }

  private createPlayer(playerName: string) {
    this.player = new Player(this, 200, this.groundY - 59 / 2, playerName);
    this.physics.add.collider(this.player, this.physicsGroups.ground);
    this.physics.add.collider(this.player, this.physicsGroups.chests);

    // Set initial safe position
    this.lastSafePosition = { x: 200, y: this.groundY - 59 / 2 };

    // Create player name text above Steve
    this.uiManager.createPlayerNameText(playerName, 0, 0);
  }

  private setupCamera() {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.cameras.main.height);
  }

  private createUI() {
    this.uiManager.createGameUI(this.lives);
  }

  update() {
    // Don't update if player hasn't been created yet (waiting for name input)
    if (!this.player) return;

    this.player.update();

    // Update last safe position if player is on ground and not on lava
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

    // Check for lava collision manually
    if (
      !this.isRespawning &&
      CollisionManager.checkLavaCollision(this.player, this.physicsGroups.lava)
    ) {
      this.handleLavaDeath();
    }

    // Update player name position above Steve
    if (this.player) {
      this.uiManager.updatePlayerNamePosition(this.player.x, this.player.y);
    }

    const cameraRightEdge = this.cameras.main.scrollX + this.cameras.main.width;

    if (cameraRightEdge > this.worldGenerator.lastGroundX - 500) {
      this.worldGenerator.generateGround(
        this.worldGenerator.lastGroundX,
        this.worldGenerator.lastGroundX + CHUNK_SIZE,
        this.physicsGroups.dirt,
        this.physicsGroups.ground,
        this.physicsGroups.lava
      );
      this.worldGenerator.generateClouds(
        this.worldGenerator.lastCloudX,
        this.worldGenerator.lastCloudX + CHUNK_SIZE
      );
      this.worldGenerator.generateChests(
        this.worldGenerator.lastChestX,
        this.worldGenerator.lastChestX + CHUNK_SIZE,
        this.physicsGroups.chests
      );
    }
  }

  private handleLavaDeath() {
    this.lives--;
    console.log(`Player hit lava! Lives remaining: ${this.lives}`);

    // Update hearts display
    this.uiManager.updateLives(this.lives);

    if (this.lives > 0) {
      // Respawn from sky
      this.respawnPlayer();
    } else {
      // Mark player as dead
      this.player.markAsDead();

      // Update UI to show "dead" name
      this.uiManager.updatePlayerName(this.player.getPlayerName());
    }
  }

  private respawnPlayer() {
    this.isRespawning = true;

    // Find a safe grass position to respawn to
    const safeX = this.findSafeRespawnPosition();

    // Position player high in the sky above safe position
    this.player.setPosition(safeX, -100);
    this.player.setVelocity(0, 0);

    // Update last safe position to the new safe spot
    this.lastSafePosition = { x: safeX, y: this.groundY - 59 / 2 };

    // Wait longer before allowing collision detection - give time to land safely
    this.time.delayedCall(2500, () => {
      this.isRespawning = false;
    });
  }

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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#87ceeb", // Sky blue background
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1200 }, // Increased from 800 to make jumps faster
      debug: false,
    },
  },
};

new Phaser.Game(config);
