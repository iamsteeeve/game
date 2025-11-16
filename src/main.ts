import Phaser from "phaser";
import { Player } from "./Player";
import { CollisionManager } from "./CollisionManager";
import { WorldGenerator } from "./WorldGenerator";
import { UIManager } from "./UIManager";
import { PhysicsGroupManager } from "./PhysicsGroupManager";
import { ArrowManager } from "./ArrowManager";
import { PoopManager } from "./PoopManager";
import { MultiplayerManager } from "./MultiplayerManager";
import { RespawnManager } from "./RespawnManager";
import { Arrow } from "./Arrow";
import { Poop } from "./Poop";

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
  private worldSeed: number | null = null;
  private playerNameForStart: string = "";

  // Managers
  private arrowManager!: ArrowManager;
  private poopManager!: PoopManager;
  private multiplayerManager!: MultiplayerManager;
  private respawnManager!: RespawnManager;

  constructor() {
    super({ key: "GameScene" });
  }

  preload() {
    Player.preload(this);
    Arrow.preload(this);
    Poop.preload(this);
    this.load.image("grass", "assets/grass.png");
    this.load.image("dirt", "assets/dirt.png");
    this.load.image("chest", "assets/chest.png");
    this.load.image("lava", "assets/lava.png");
    this.load.image("tombstone", "assets/tombstone.png");
    this.load.image("steve-poop", "assets/steve-poop.png");

    this.load.audio("death", "assets/sounds/death.mp3");
    this.load.audio("jump", "assets/sounds/jump.mp3");
    this.load.audio("respawn", "assets/sounds/respawn.mp3");
    this.load.audio("shoot", "assets/sounds/shoot.mp3");
    this.load.audio("playerHit", "assets/sounds/player-hit.mp3");
    this.load.audio("poop", "assets/sounds/poop.mp3");
  }

  create() {
    this.sound.add("death");
    this.sound.add("jump");
    this.sound.add("respawn");
    this.sound.add("shoot");
    this.sound.add("playerHit");
    this.sound.add("poop");
    this.uiManager = new UIManager(this);
    this.askForPlayerName();
  }

  private async askForPlayerName() {
    const playerName = await this.uiManager.showNamePrompt();
    this.playerNameForStart = playerName;
    this.setupMultiplayer(playerName);
  }

  private startGame() {
    this.createBackground();
    this.setupWorld();
    this.physicsGroups = new PhysicsGroupManager(this);
    this.generateInitialWorld();
    this.createPlayer(this.playerNameForStart);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.cameras.main.height);
    this.uiManager.createGameUI(this.respawnManager.getLives());
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

    // Initialize world generator with seed from server
    const seed = this.worldSeed || Date.now();
    this.worldGenerator = new WorldGenerator(
      this,
      this.groundY,
      {
        tileSize: TILE_SIZE,
        chestSpawnInterval: CHEST_SPAWN_INTERVAL,
        cloudSpawnInterval: CLOUD_SPAWN_INTERVAL,
        minChestDistance: MIN_CHEST_DISTANCE,
      },
      seed
    );
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
    const spawnX = 200;
    const spawnY = this.groundY - 59 / 2;

    this.player = new Player(this, spawnX, spawnY, playerName, this.sound);
    this.physics.add.collider(this.player, this.physicsGroups.ground);
    this.physics.add.collider(this.player, this.physicsGroups.chests);
    this.physics.add.collider(this.player, this.physicsGroups.lava);

    // Initialize managers
    const remotePlayers = this.multiplayerManager.getRemotePlayers();
    this.arrowManager = new ArrowManager(
      this,
      this.physicsGroups,
      this.player,
      remotePlayers
    );
    this.poopManager = new PoopManager(
      this,
      this.physicsGroups,
      this.player,
      remotePlayers
    );
    this.respawnManager = new RespawnManager(
      this,
      this.player,
      this.physicsGroups,
      this.groundY,
      spawnX,
      spawnY
    );

    // Connect managers to multiplayer
    this.multiplayerManager.setArrowManager(this.arrowManager);
    this.multiplayerManager.setPoopManager(this.poopManager);

    // Setup respawn callbacks
    this.respawnManager.onLivesChanged((lives) => {
      this.uiManager.updateLives(lives);
    });

    this.respawnManager.onPlayerDeath(() => {
      this.multiplayerManager.getNetworkManager().sendPlayerDeath(0);
      this.sound.play("death");
    });

    // Setup arrow shooting
    this.player.onShoot((arrowData) => {
      const arrow = this.arrowManager.createArrow(arrowData);
      this.multiplayerManager.getNetworkManager().sendShoot(arrow);
    });

    // Setup poop dropping
    this.player.onPoop((poopData) => {
      const poop = this.poopManager.createPoop(
        poopData,
        this.player.getPlayerName()
      );
      this.multiplayerManager.getNetworkManager().sendPoop(poop);
    });

    // Setup poop collection
    this.player.onPoopCollected((poop) => {
      this.player.increasePoopsCollected();
      this.uiManager.updatePoopsCollected(this.player.getPoopsCollected());
      this.multiplayerManager
        .getNetworkManager()
        .sendPoopCollection(poop.getPoopId());
      this.poopManager.removePoopById(poop.getPoopId());
    });

    // Setup poop throwing
    this.player.onThrowPoop((thrownPoopData) => {
      this.uiManager.updatePoopsCollected(this.player.getPoopsCollected());
      this.poopManager.createThrownPoop(thrownPoopData);
      this.multiplayerManager.getNetworkManager().sendThrowPoop(thrownPoopData);
    });
  }

  private setupMultiplayer(playerName: string) {
    this.multiplayerManager = new MultiplayerManager(this);

    // Handle world state and start game
    this.multiplayerManager.onWorldState((seed) => {
      this.worldSeed = seed;
      this.startGame();
    });

    // Setup all network handlers
    const spawnX = 200;
    const spawnY = this.groundY - 59 / 2;
    this.multiplayerManager.setupNetworkHandlers(playerName, spawnX, spawnY);
  }

  update() {
    // Don't update if player hasn't been created yet (waiting for name input)
    if (!this.player) return;

    this.uiManager.updateDistance(this.player.x / 32); // Convert pixels to meters

    // Pass mobile control states to player
    this.player.setMobileControlStates(this.uiManager.controlStates);

    this.player.update();

    // Update all remote players
    this.multiplayerManager.updateRemotePlayers();

    // Send player position to server (throttle to ~20 updates/sec)
    const networkManager = this.multiplayerManager.getNetworkManager();
    if (
      networkManager &&
      networkManager.isConnected() &&
      this.game.getFrame() % 3 === 0
    ) {
      networkManager.sendPlayerUpdate({
        name: this.player.getPlayerName(),
        x: this.player.x,
        y: this.player.y,
        velocityX: this.player.body?.velocity.x || 0,
        velocityY: this.player.body?.velocity.y || 0,
        animation: this.player.anims.currentAnim?.key || "idle",
        lives: this.respawnManager.getLives(),
        isDead: this.respawnManager.getLives() <= 0,
        isPooping: this.player.getIsPooping(),
        health: this.player.getHealth(),
        isImmune: this.player.getIsImmune(),
      });
    }

    // Update safe position tracking
    this.respawnManager.updateSafePosition();

    // Check for lava collision
    if (
      !this.respawnManager.isCurrentlyRespawning() &&
      CollisionManager.checkLavaCollision(this.player, this.physicsGroups.lava)
    ) {
      this.respawnManager.handleLavaDamage();
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
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  //parent: "game-container",
  backgroundColor: "#87ceeb", // Sky blue background
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 1200 }, // Increased from 800 to make jumps faster
      debug: false,
    },
  },
  input: {
    activePointers: 3, // Enable up to 3 simultaneous touch points
  },
};

new Phaser.Game(config);
