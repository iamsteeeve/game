import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Serve static files from the dist directory for client
app.use(express.static(path.join(__dirname, "../dist")));

interface PlayerData {
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

interface WorldState {
  seed: number; // Used to ensure all clients generate the same world
  timestamp: number;
}

const players: Map<string, PlayerData> = new Map();
const worldState: WorldState = {
  seed: Math.floor(Math.random() * 1000000),
  timestamp: Date.now(),
};

io.on("connection", (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Send world state to newly connected player
  socket.emit("worldState", worldState);

  socket.on("playerJoin", (data: { name: string; x: number; y: number }) => {
    console.log(`Player ${data.name} joined with ID: ${socket.id}`);

    const newPlayer: PlayerData = {
      id: socket.id,
      name: data.name,
      x: data.x,
      y: data.y,
      velocityX: 0,
      velocityY: 0,
      animation: "idle",
      lives: 3,
      isDead: false,
    };

    players.set(socket.id, newPlayer);

    // Send current players to the new player
    const currentPlayers = Array.from(players.values()).filter(
      (p) => p.id !== socket.id
    );
    socket.emit("currentPlayers", currentPlayers);

    // Notify all other players about the new player
    socket.broadcast.emit("playerJoined", newPlayer);

    console.log(`Total players: ${players.size}`);
  });

  socket.on("playerMove", (data: Partial<PlayerData>) => {
    //console.log(`Player move received from ${socket.id}:`, data);
    const player = players.get(socket.id);
    if (player) {
      // Update player data
      if (data.x !== undefined) player.x = data.x;
      if (data.y !== undefined) player.y = data.y;
      if (data.velocityX !== undefined) player.velocityX = data.velocityX;
      if (data.velocityY !== undefined) player.velocityY = data.velocityY;
      if (data.animation !== undefined) player.animation = data.animation;
      if (data.lives !== undefined) player.lives = data.lives;
      if (data.isDead !== undefined) player.isDead = data.isDead;
      if (data.isPooping !== undefined) player.isPooping = data.isPooping;
      if (data.health !== undefined) player.health = data.health;
      if (data.isImmune !== undefined) player.isImmune = data.isImmune;

      // Broadcast to all other players
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        animation: player.animation,
        lives: player.lives,
        isDead: player.isDead,
        isPooping: player.isPooping,
        health: player.health,
        isImmune: player.isImmune,
      });
    }
  });

  socket.on("playerDied", (data: { lives: number }) => {
    const player = players.get(socket.id);
    if (player) {
      player.lives = data.lives;
      player.isDead = data.lives <= 0;

      // Notify all players about the death
      io.emit("playerDied", {
        id: socket.id,
        lives: player.lives,
        isDead: player.isDead,
      });

      console.log(`Player ${player.name} died. Lives: ${player.lives}`);
    }
  });

  socket.on(
    "playerRespawn",
    (data: { x: number; y: number; lives: number }) => {
      const player = players.get(socket.id);
      if (player) {
        player.x = data.x;
        player.y = data.y;
        player.lives = data.lives;
        player.isDead = false;

        // Notify all players about the respawn
        io.emit("playerRespawned", {
          id: socket.id,
          x: player.x,
          y: player.y,
          lives: player.lives,
        });

        console.log(
          `Player ${player.name} respawned at (${data.x}, ${data.y})`
        );
      }
    }
  );

  socket.on("playerShoot", (data) => {
    // Broadcast shoot event to all other players
    socket.broadcast.emit("playerShoot", {
      id: socket.id,
      x: data.x,
      y: data.y,
      direction: data.direction,
    });
  });

  socket.on(
    "playerPoop",
    (data: { id: string; x: number; y: number; playerName: string }) => {
      // Broadcast poop drop event to all other players
      socket.broadcast.emit("playerPoop", {
        id: data.id,
        x: data.x,
        y: data.y,
        playerName: data.playerName,
      });

      const player = players.get(socket.id);
      console.log(
        `Player ${player?.name} dropped poop at (${data.x}, ${data.y}) with id ${data.id}`
      );
    }
  );

  socket.on("poopCollected", (data: { poopId: string }) => {
    // Broadcast poop collection to all players so they can remove it
    io.emit("poopCollected", {
      poopId: data.poopId,
    });

    const player = players.get(socket.id);
    console.log(`Player ${player?.name} collected poop: ${data.poopId}`);
  });

  socket.on(
    "throwPoop",
    (data: {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
      playerName: string;
      maxDistance: number;
    }) => {
      // Broadcast thrown poop to all other players
      socket.broadcast.emit("throwPoop", {
        id: socket.id,
        x: data.x,
        y: data.y,
        velocityX: data.velocityX,
        velocityY: data.velocityY,
        playerName: data.playerName,
        maxDistance: data.maxDistance,
      });

      const player = players.get(socket.id);
      console.log(
        `Player ${player?.name} threw poop at (${data.x}, ${data.y}) with velocity (${data.velocityX}, ${data.velocityY}) maxDistance: ${data.maxDistance}`
      );
    }
  );

  socket.on(
    "chestCollected",
    (data: { chestId: string; x: number; y: number }) => {
      // Broadcast chest collection to all players so they can remove it
      io.emit("chestCollected", {
        playerId: socket.id,
        chestId: data.chestId,
        x: data.x,
        y: data.y,
      });

      const player = players.get(socket.id);
      console.log(
        `Player ${player?.name} collected chest at (${data.x}, ${data.y})`
      );
    }
  );

  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Player ${player.name} disconnected: ${socket.id}`);
    } else {
      console.log(`Player disconnected: ${socket.id}`);
    }

    players.delete(socket.id);

    // Notify all players about the disconnection
    io.emit("playerLeft", socket.id);

    console.log(`Total players: ${players.size}`);
  });

  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(Number(PORT), () => {
  console.log("=".repeat(50));
  console.log(`🎮 Game Server running on port ${PORT}`);
  console.log(`🌍 World seed: ${worldState.seed}`);
  console.log(`🔗 Connect at: http://localhost:${PORT}`);
  console.log("=".repeat(50));
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
