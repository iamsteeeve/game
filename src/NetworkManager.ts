import { io, Socket } from "socket.io-client";

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

export interface ShootData {
  id: string;
  x: number;
  y: number;
  direction: number;
}

export interface PoopData {
  id: string;
  x: number;
  y: number;
}

export class NetworkManager {
  private socket: Socket;
  private connected: boolean = false;

  // Callback handlers
  private onWorldStateCallback?: (worldState: WorldStateData) => void;
  private onPlayersUpdateCallback?: (players: RemotePlayerData[]) => void;
  private onPlayerJoinedCallback?: (player: RemotePlayerData) => void;
  private onPlayerMovedCallback?: (player: RemotePlayerData) => void;
  private onPlayerLeftCallback?: (playerId: string) => void;
  private onPlayerDiedCallback?: (data: {
    id: string;
    lives: number;
    isDead: boolean;
  }) => void;
  private onPlayerRespawnedCallback?: (data: {
    id: string;
    x: number;
    y: number;
    lives: number;
  }) => void;
  private onChestCollectedCallback?: (data: ChestCollectionData) => void;

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
      this.onWorldStateCallback?.(worldState);
    });

    this.socket.on("currentPlayers", (players: RemotePlayerData[]) => {
      console.log(`👥 Received ${players.length} existing players`);
      this.onPlayersUpdateCallback?.(players);
    });

    this.socket.on("playerJoined", (player: RemotePlayerData) => {
      console.log("👤 Player joined:", player.name);
      this.onPlayerJoinedCallback?.(player);
    });

    this.socket.on("playerMoved", (player: RemotePlayerData) => {
      //console.log("🚶 Player moved:", player.name);
      this.onPlayerMovedCallback?.(player);
    });

    this.socket.on("playerLeft", (playerId: string) => {
      console.log("👋 Player left:", playerId);
      this.onPlayerLeftCallback?.(playerId);
    });

    this.socket.on(
      "playerDied",
      (data: { id: string; lives: number; isDead: boolean }) => {
        console.log(`💀 Player ${data.id} died. Lives: ${data.lives}`);
        this.onPlayerDiedCallback?.(data);
      }
    );

    this.socket.on(
      "playerRespawned",
      (data: { id: string; x: number; y: number; lives: number }) => {
        console.log(`✨ Player ${data.id} respawned at (${data.x}, ${data.y})`);
        this.onPlayerRespawnedCallback?.(data);
      }
    );

    this.socket.on("chestCollected", (data: ChestCollectionData) => {
      console.log(
        `📦 Chest collected by ${data.playerId} at (${data.x}, ${data.y})`
      );
      this.onChestCollectedCallback?.(data);
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
      this.socket.emit("playerMove", data);
    }
  }

  sendShoot(x: number, y: number, direction: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("playerShoot", {
        x,
        y,
        direction,
      });
    }
  }

  sendPoop(x: number, y: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("playerPoop", {
        x,
        y,
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

  // Callback registration methods
  onWorldState(callback: (worldState: WorldStateData) => void) {
    this.onWorldStateCallback = callback;
  }

  onCurrentPlayers(callback: (players: RemotePlayerData[]) => void) {
    this.onPlayersUpdateCallback = callback;
  }

  onNewPlayer(callback: (player: RemotePlayerData) => void) {
    this.onPlayerJoinedCallback = callback;
  }

  onPlayerUpdate(callback: (player: RemotePlayerData) => void) {
    this.onPlayerMovedCallback = callback;
  }

  onPlayerShoot(callback: (data: ShootData) => void): void {
    if (this.socket) {
      this.socket.on("playerShoot", callback);
    }
  }

  onPlayerPoop(callback: (data: PoopData) => void): void {
    if (this.socket) {
      this.socket.on("playerPoop", callback);
    }
  }

  onPlayerDisconnect(callback: (playerId: string) => void) {
    this.onPlayerLeftCallback = callback;
  }

  onPlayerDeath(
    callback: (data: { id: string; lives: number; isDead: boolean }) => void
  ) {
    this.onPlayerDiedCallback = callback;
  }

  onPlayerRespawn(
    callback: (data: {
      id: string;
      x: number;
      y: number;
      lives: number;
    }) => void
  ) {
    this.onPlayerRespawnedCallback = callback;
  }

  onChestCollected(callback: (data: ChestCollectionData) => void) {
    this.onChestCollectedCallback = callback;
  }

  // Disconnect
  disconnect() {
    console.log("👋 Disconnecting from server");
    this.socket.disconnect();
    this.connected = false;
  }
}
