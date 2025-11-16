import { io, Socket } from "socket.io-client";
import { Poop } from "./Poop";
import { Arrow } from "./Arrow";

export interface RemotePlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  animation: string;
  lives: number;
  isDead: boolean;
  isPooping?: boolean;
  health?: number;
  isImmune?: boolean;
}

export interface WorldStateData {
  seed: number;
  timestamp: number;
}

export interface ChestCollectionData {
  playerId: string;
  chestId: string;
  x: number;
  y: number;
}

export class NetworkManager {
  private socket: Socket;
  private connected: boolean = false;

  constructor(serverUrl?: string) {
    // Use provided URL, environment variable, or default to current host
    const url =
      serverUrl ||
      (import.meta.env.VITE_SERVER_URL as string) ||
      `${window.location.protocol}//${window.location.host}`;

    console.log(`🔌 Connecting to server: ${url}`);

    this.socket = io(url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on("connect", () => {
      console.log("✅ Connected to game server:", this.socket.id);
      this.connected = true;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from server:", reason);
      this.connected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
    });

    this.socket.on("worldState", (worldState: WorldStateData) => {
      console.log("🌍 Received world state:", worldState);
    });

    this.socket.on("currentPlayers", (players: RemotePlayerData[]) => {
      console.log(`👥 Received ${players.length} existing players`);
    });

    this.socket.on("playerJoined", (player: RemotePlayerData) => {
      console.log("👤 Player joined:", player.name);
    });

    this.socket.on("playerMoved", () => {
      // Silent - too frequent to log
    });

    this.socket.on("playerLeft", (playerId: string) => {
      console.log("👋 Player left:", playerId);
    });

    this.socket.on(
      "playerDied",
      (data: { id: string; lives: number; isDead: boolean }) => {
        console.log(`💀 Player ${data.id} died. Lives: ${data.lives}`);
      }
    );

    this.socket.on(
      "playerRespawned",
      (data: { id: string; x: number; y: number; lives: number }) => {
        console.log(`✨ Player ${data.id} respawned at (${data.x}, ${data.y})`);
      }
    );

    this.socket.on("chestCollected", (data: ChestCollectionData) => {
      console.log(
        `📦 Chest collected by ${data.playerId} at (${data.x}, ${data.y})`
      );
    });
  }

  // Connection methods
  isConnected(): boolean {
    return this.connected && this.socket.connected;
  }

  getSocketId(): string | undefined {
    return this.socket.id;
  }

  // Send methods
  joinGame(name: string, x: number, y: number) {
    console.log(`🎮 Joining game as: ${name}`);
    this.socket.emit("playerJoin", { name, x, y });
  }

  sendPlayerUpdate(data: Partial<RemotePlayerData>) {
    if (this.connected) {
      //console.log("🚀 Sending player update:", data.health);
      this.socket.emit("playerMove", data);
    }
  }

  sendShoot(arrow: Arrow) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("playerShoot", {
        x: arrow.x,
        y: arrow.y,
        direction: arrow.getDirection(),
      });
    }
  }

  sendPoop(poop: Poop) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("playerPoop", {
        id: poop.getPoopId(),
        x: poop.x,
        y: poop.y,
        playerName: poop.getPlayerName(),
      });
    }
  }

  sendPoopCollection(poopId: string) {
    if (this.socket && this.socket.connected) {
      console.log(`💩 Sending poop collection: ${poopId}`);
      this.socket.emit("poopCollected", { poopId });
    }
  }

  sendThrowPoop(thrownPoop: {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    playerName: string;
    maxDistance: number;
  }) {
    if (this.socket && this.socket.connected) {
      console.log(
        `💩 Sending throw poop at (${thrownPoop.x}, ${thrownPoop.y})`
      );
      this.socket.emit("throwPoop", {
        x: thrownPoop.x,
        y: thrownPoop.y,
        velocityX: thrownPoop.velocityX,
        velocityY: thrownPoop.velocityY,
        playerName: thrownPoop.playerName,
        maxDistance: thrownPoop.maxDistance,
      });
    }
  }

  sendPlayerDeath(lives: number) {
    console.log(`💀 Sending player death. Lives: ${lives}`);
    this.socket.emit("playerDied", { lives });
  }

  sendPlayerRespawn(x: number, y: number, lives: number) {
    console.log(`✨ Sending player respawn at (${x}, ${y})`);
    this.socket.emit("playerRespawn", { x, y, lives });
  }

  sendChestCollection(chestId: string, x: number, y: number) {
    console.log(`📦 Sending chest collection: ${chestId}`);
    this.socket.emit("chestCollected", { chestId, x, y });
  }

  // Direct access to socket for event listeners
  on<T>(event: string, callback: (data: T) => void): void {
    this.socket.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket.off(event, callback);
  }

  // Disconnect
  disconnect() {
    console.log("👋 Disconnecting from server");
    this.socket.disconnect();
    this.connected = false;
  }
}
