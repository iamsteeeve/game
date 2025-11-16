import Phaser from "phaser";
import { ArrowType, Player, PoopType, ThrownPoopType } from "./Player";
import { CollisionManager } from "./CollisionManager";
import { WorldGenerator } from "./WorldGenerator";
import { UIManager } from "./UIManager";
import { PhysicsGroupManager } from "./PhysicsGroupManager";
import { NetworkManager, RemotePlayerData } from "./NetworkManager";
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
  private lives: number = 3;
  private lastSafePosition: { x: number; y: number } = { x: 200, y: 0 };
  private isRespawning: boolean = false;
  private networkManager!: NetworkManager;
  private remotePlayers: Map<string, Player> = new Map();
  private worldSeed: number | null = null;
  private playerNameForStart: string = "";
  private arrows!: Phaser.GameObjects.Group;
  private poops!: Phaser.GameObjects.Group;
  private poopsMap: Map<string, Poop> = new Map();

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
    this.uiManager.createGameUI(this.lives);
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

  private setupArrowCollisions(arrow: Arrow) {
    // Add collisions with terrain
    this.physics.add.collider(arrow, this.physicsGroups.ground, () => {
      arrow.destroy();
    });
    this.physics.add.collider(arrow, this.physicsGroups.dirt, () => {
      arrow.destroy();
    });

    // Add collision with main player
    this.physics.add.overlap(arrow, this.player, () => {
      const damaged = this.player.takeDamageWithImmunity(10);
      if (damaged) {
        this.sound.play("playerHit");
      }
      arrow.destroy();
    });

    // Add collision with remote players
    this.remotePlayers.forEach((remotePlayer) => {
      this.physics.add.overlap(arrow, remotePlayer, () => {
        this.sound.play("playerHit");
        arrow.destroy();
      });
    });
  }

  private createPlayer(playerName: string) {
    this.player = new Player(
      this,
      200,
      this.groundY - 59 / 2,
      playerName,
      this.sound
    );
    this.physics.add.collider(this.player, this.physicsGroups.ground);
    this.physics.add.collider(this.player, this.physicsGroups.chests);
    this.physics.add.collider(this.player, this.physicsGroups.lava);

    // Create arrows group
    this.arrows = this.add.group({
      runChildUpdate: true,
    });

    // Create poops group (needs update for thrown poops distance tracking)
    this.poops = this.add.group({
      runChildUpdate: true,
    });

    // Setup arrow shooting
    this.player.onShoot((arrowData: ArrowType) => {
      const arrow = new Arrow(
        this,
        arrowData.x,
        arrowData.y,
        arrowData.direction
      );
      this.arrows.add(arrow);
      this.networkManager.sendShoot(arrow);
      this.setupArrowCollisions(arrow);
    });

    // Setup poop dropping
    this.player.onPoop((poopData: PoopType) => {
      const poop = new Poop(
        this,
        poopData.x,
        poopData.y,
        this.player.getPlayerName()
      );
      this.poops.add(poop);
      this.poopsMap.set(poop.getPoopId(), poop);

      // Send poop event to server
      this.networkManager.sendPoop(poop);

      // Add collisions for poops - they should land on ground and stay
      this.physics.add.collider(poop, this.physicsGroups.ground);
      this.physics.add.collider(poop, this.physicsGroups.dirt);
    });

    this.player.onPoopCollected((poop: Poop) => {
      this.player.increasePoopsCollected();
      this.uiManager.updatePoopsCollected(this.player.getPoopsCollected());

      // Send poop collection to server
      this.networkManager.sendPoopCollection(poop.getPoopId());

      // Remove poop locally
      this.removePoopById(poop.getPoopId());
    });

    this.player.onThrowPoop((thrownPoopData) => {
      this.uiManager.updatePoopsCollected(this.player.getPoopsCollected());
      this.createThrownPoop(thrownPoopData);

      // Send throw poop event to server
      this.networkManager.sendThrowPoop(thrownPoopData);
    });

    // Set initial safe position
    this.lastSafePosition = { x: 200, y: this.groundY - 59 / 2 };
  }

  private setupMultiplayer(playerName: string) {
    this.networkManager = new NetworkManager();

    // Handle world state - this comes first before anything else
    this.networkManager.on("worldState", (worldState: { seed: number }) => {
      console.log("✅ Received world state with seed:", worldState.seed);
      this.worldSeed = worldState.seed;

      // Now that we have the seed, start the game
      this.startGame();

      // Join the game after world is set up
      this.networkManager.joinGame(playerName, 200, this.groundY - 59 / 2);
    });

    // Handle existing players
    this.networkManager.on("currentPlayers", (players: RemotePlayerData[]) => {
      players.forEach((playerData) => {
        this.addRemotePlayer(playerData);
      });
    });

    // Handle new player joining
    this.networkManager.on("playerJoined", (playerData: RemotePlayerData) => {
      this.addRemotePlayer(playerData);
    });

    // Handle player movement updates
    this.networkManager.on("playerMoved", (playerData: RemotePlayerData) => {
      // Don't update our own player from network events
      if (playerData.id !== this.networkManager.getSocketId()) {
        this.updateRemotePlayer(playerData);
      }
    });

    // Handle player shoot events
    this.networkManager.on("playerShoot", (data: ArrowType) => {
      // Don't create arrows for our own shots (we already handle them locally)
      if (data.id !== this.networkManager.getSocketId()) {
        this.createRemotePlayerArrow(data);
      }
    });

    // Handle player poop events
    this.networkManager.on(
      "playerPoop",
      (data: { id: string; x: number; y: number; playerName?: string }) => {
        this.createRemotePlayerPoop(data);
      }
    );

    // Handle poop collection events
    this.networkManager.on("poopCollected", (data: { poopId: string }) => {
      console.log(`💩 Poop collected by someone: ${data.poopId}`);
      this.removePoopById(data.poopId);
    });

    // Handle thrown poop events
    this.networkManager.on(
      "throwPoop",
      (data: {
        id: string;
        x: number;
        y: number;
        velocityX: number;
        velocityY: number;
        playerName?: string;
        maxDistance: number;
      }) => {
        console.log(`💩 Someone threw poop: ${data.id}`);
        this.createThrownPoop({
          x: data.x,
          y: data.y,
          velocityX: data.velocityX,
          velocityY: data.velocityY,
          playerName: data.playerName || "Unknown",
          maxDistance: data.maxDistance,
        });
      }
    );

    // Handle player disconnecting
    this.networkManager.on("playerLeft", (playerId: string) => {
      this.removeRemotePlayer(playerId);
    });

    // Handle player death
    this.networkManager.on(
      "playerDied",
      (data: { id: string; lives: number; isDead: boolean }) => {
        const remotePlayer = this.remotePlayers.get(data.id);
        if (remotePlayer && data.isDead) {
          remotePlayer.markAsDead();
        }
      }
    );

    // Handle player respawn
    this.networkManager.on(
      "playerRespawned",
      (data: { id: string; x: number; y: number; lives: number }) => {
        const remotePlayer = this.remotePlayers.get(data.id);
        if (remotePlayer) {
          remotePlayer.setPosition(data.x, data.y);
        }
      }
    );
  }

  private addRemotePlayer(playerData: RemotePlayerData) {
    if (this.remotePlayers.has(playerData.id)) {
      return; // Already exists
    }

    const remotePlayer = new Player(
      this,
      playerData.x,
      playerData.y,
      playerData.name
    );

    // Set initial health if provided
    if (playerData.health !== undefined) {
      remotePlayer.setHealth(playerData.health);
    }

    // Disable physics for remote players - they're position-synced only
    if (remotePlayer.body) {
      const body = remotePlayer.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setImmovable(true);
    }

    this.remotePlayers.set(playerData.id, remotePlayer);

    console.log(`Added remote player: ${playerData.name} (${playerData.id})`);
  }

  private createRemotePlayerArrow(data: ArrowType) {
    const arrow = new Arrow(this, data.x, data.y, data.direction);
    console.log("🏹 Created remote player arrow", data.id);
    this.arrows.add(arrow);
    this.setupArrowCollisions(arrow);
  }

  private createRemotePlayerPoop(data: {
    id: string;
    x: number;
    y: number;
    playerName?: string;
  }) {
    const poop = new Poop(
      this,
      data.x,
      data.y,
      data.playerName || "Unknown",
      data.id
    );
    this.poops.add(poop);
    this.poopsMap.set(poop.getPoopId(), poop);

    // Add collisions for remote poops
    this.physics.add.collider(poop, this.physicsGroups.ground);
    this.physics.add.collider(poop, this.physicsGroups.dirt);
  }

  private createThrownPoop(data: ThrownPoopType) {
    const poop = new Poop(
      this,
      data.x,
      data.y,
      data.playerName,
      undefined,
      true,
      data.maxDistance
    );
    this.poops.add(poop);
    this.poopsMap.set(poop.getPoopId(), poop);

    // Set the velocity for the thrown poop
    const body = poop.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(data.velocityX, data.velocityY);

    // Add collisions
    this.physics.add.collider(poop, this.physicsGroups.ground);
    this.physics.add.collider(poop, this.physicsGroups.dirt);

    // Add collision with main player
    this.physics.add.overlap(poop, this.player, () => {
      const damaged = this.player.takeDamageWithImmunity(10);
      if (damaged) {
        this.sound.play("playerHit");
      }
      poop.destroy();
    });

    // Add collision with remote players
    this.remotePlayers.forEach((remotePlayer) => {
      this.physics.add.overlap(poop, remotePlayer, () => {
        this.sound.play("playerHit");
        poop.destroy();
      });
    });

    console.log(
      `💩 Created thrown poop with velocity (${data.velocityX}, ${data.velocityY})`
    );
  }

  private removePoopById(poopId: string) {
    const poop = this.poopsMap.get(poopId);
    if (poop) {
      this.poops.remove(poop, true, true);
      this.poopsMap.delete(poopId);
      poop.destroy();
      console.log(`💩 Removed poop: ${poopId}`);
    }
  }

  private updateRemotePlayer(playerData: RemotePlayerData) {
    const remotePlayer = this.remotePlayers.get(playerData.id);
    if (remotePlayer) {
      remotePlayer.setPosition(playerData.x, playerData.y);

      if (playerData.isPooping !== undefined) {
        remotePlayer.setIsPooping(playerData.isPooping);
      }

      // Update health if provided
      if (playerData.health !== undefined) {
        remotePlayer.setHealth(playerData.health);
      }

      // Update immunity visual state
      if (playerData.isImmune !== undefined) {
        remotePlayer.setImmuneVisual(playerData.isImmune);
      }
    }
  }

  private removeRemotePlayer(playerId: string) {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      remotePlayer.destroy();
      this.remotePlayers.delete(playerId);
      console.log(`Removed remote player: ${playerId}`);
    }
  }

  update() {
    // Don't update if player hasn't been created yet (waiting for name input)
    if (!this.player) return;
    this.uiManager.updateDistance(this.player.x / 32); // Convert pixels to meters
    // Pass mobile control states to player
    this.player.setMobileControlStates(this.uiManager.controlStates);

    this.player.update();

    // Update all remote players
    this.remotePlayers.forEach((remotePlayer) => {
      remotePlayer.updateNameText();
    });

    // Send player position to server (throttle to ~20 updates/sec)
    if (
      this.networkManager &&
      this.networkManager.isConnected() &&
      this.game.getFrame() % 3 === 0
    ) {
      this.networkManager.sendPlayerUpdate({
        name: this.player.getPlayerName(),
        x: this.player.x,
        y: this.player.y,
        velocityX: this.player.body?.velocity.x || 0,
        velocityY: this.player.body?.velocity.y || 0,
        animation: this.player.anims.currentAnim?.key || "idle",
        lives: this.lives,
        isDead: this.lives <= 0,
        isPooping: this.player.getIsPooping(),
        health: this.player.getHealth(),
        isImmune: this.player.getIsImmune(),
      });
    }

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
    // Try to apply damage (returns false if player is immune)
    const damageApplied = this.player.takeDamageWithImmunity(25);

    if (damageApplied) {
      console.log(`Player hit lava! Health: ${this.player.getHealth()}`);

      // Play hit sound
      this.sound.play("playerHit");

      // Check if player died from the damage
      if (this.player.getHealth() === 0) {
        this.lives--;
        console.log(`Player died! Lives remaining: ${this.lives}`);

        // Update hearts display
        this.uiManager.updateLives(this.lives);

        if (this.lives > 0) {
          // Respawn from sky and restore health
          this.respawnPlayer();
        } else {
          // No lives left - permanent death
          this.networkManager.sendPlayerDeath(0);
          this.sound.play("death");
        }
      }
    }
  }

  private respawnPlayer() {
    this.isRespawning = true;
    this.sound.play("respawn");

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
