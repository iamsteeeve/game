import Phaser from "phaser";
import { Player, ArrowType } from "./Player";
import { NetworkManager, RemotePlayerData } from "./NetworkManager";
import { ArrowManager } from "./ArrowManager";
import { PoopManager } from "./PoopManager";

/**
 * Manages all multiplayer-related functionality including remote players and network events
 */
export class MultiplayerManager {
  private scene: Phaser.Scene;
  private networkManager: NetworkManager;
  private remotePlayers: Map<string, Player>;
  private arrowManager: ArrowManager | null = null;
  private poopManager: PoopManager | null = null;
  private onWorldStateCallback: ((seed: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.networkManager = new NetworkManager();
    this.remotePlayers = new Map();
  }

  /**
   * Set the arrow manager reference
   */
  setArrowManager(arrowManager: ArrowManager): void {
    this.arrowManager = arrowManager;
  }

  /**
   * Set the poop manager reference
   */
  setPoopManager(poopManager: PoopManager): void {
    this.poopManager = poopManager;
  }

  /**
   * Set callback for when world state is received
   */
  onWorldState(callback: (seed: number) => void): void {
    this.onWorldStateCallback = callback;
  }

  /**
   * Initialize multiplayer connection and set up all network event handlers
   */
  setupNetworkHandlers(
    playerName: string,
    spawnX: number,
    spawnY: number
  ): void {
    // Handle world state - this comes first before anything else
    this.networkManager.on("worldState", (worldState: { seed: number }) => {
      console.log("✅ Received world state with seed:", worldState.seed);

      if (this.onWorldStateCallback) {
        this.onWorldStateCallback(worldState.seed);
      }

      // Join the game after world is set up
      this.networkManager.joinGame(playerName, spawnX, spawnY);
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
        this.handleRemotePlayerArrow(data);
      }
    });

    // Handle player poop events
    this.networkManager.on(
      "playerPoop",
      (data: { id: string; x: number; y: number; playerName?: string }) => {
        this.handleRemotePlayerPoop(data);
      }
    );

    // Handle poop collection events
    this.networkManager.on("poopCollected", (data: { poopId: string }) => {
      console.log(`💩 Poop collected by someone: ${data.poopId}`);
      if (this.poopManager) {
        this.poopManager.removePoopById(data.poopId);
      }
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
        if (this.poopManager) {
          this.poopManager.createThrownPoop({
            x: data.x,
            y: data.y,
            velocityX: data.velocityX,
            velocityY: data.velocityY,
            playerName: data.playerName || "Unknown",
            maxDistance: data.maxDistance,
          });
        }
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

  /**
   * Add a remote player to the game
   */
  private addRemotePlayer(playerData: RemotePlayerData): void {
    if (this.remotePlayers.has(playerData.id)) {
      return; // Already exists
    }

    const remotePlayer = new Player(
      this.scene,
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

  /**
   * Handle remote player shooting an arrow
   */
  private handleRemotePlayerArrow(data: ArrowType): void {
    if (this.arrowManager) {
      this.arrowManager.createArrow(data);
      console.log("🏹 Created remote player arrow", data.id);
    }
  }

  /**
   * Handle remote player dropping poop
   */
  private handleRemotePlayerPoop(data: {
    id: string;
    x: number;
    y: number;
    playerName?: string;
  }): void {
    if (this.poopManager) {
      this.poopManager.createPoop(
        { x: data.x, y: data.y, playerName: data.playerName || "Unknown" },
        data.playerName || "Unknown",
        data.id
      );
    }
  }

  /**
   * Update a remote player's state
   */
  private updateRemotePlayer(playerData: RemotePlayerData): void {
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

  /**
   * Remove a remote player from the game
   */
  private removeRemotePlayer(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      remotePlayer.destroy();
      this.remotePlayers.delete(playerId);
      console.log(`Removed remote player: ${playerId}`);
    }
  }

  /**
   * Update all remote players (call in scene update)
   */
  updateRemotePlayers(): void {
    this.remotePlayers.forEach((remotePlayer) => {
      remotePlayer.updateNameText();
    });
  }

  /**
   * Get the network manager
   */
  getNetworkManager(): NetworkManager {
    return this.networkManager;
  }

  /**
   * Get the remote players map
   */
  getRemotePlayers(): Map<string, Player> {
    return this.remotePlayers;
  }
}
