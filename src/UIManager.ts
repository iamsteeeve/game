import Phaser from "phaser";

export class UIManager {
  private scene: Phaser.Scene;
  private heartTexts: Phaser.GameObjects.Text[] = [];
  private nameText: Phaser.GameObjects.Text | null = null;
  private playerName: string = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Show name input prompt and return a promise with the player name
   */
  showNamePrompt(): Promise<string> {
    return new Promise((resolve) => {
      // Pause physics until name is entered
      this.scene.physics.pause();

      // Create semi-transparent overlay
      const overlay = this.scene.add.graphics();
      overlay.fillStyle(0x000000, 0.7);
      overlay.fillRect(
        0,
        0,
        this.scene.cameras.main.width,
        this.scene.cameras.main.height
      );
      overlay.setScrollFactor(0);

      // Create prompt text
      const promptText = this.scene.add.text(
        this.scene.cameras.main.centerX,
        this.scene.cameras.main.centerY - 50,
        "Enter your name:",
        {
          fontSize: "32px",
          color: "#ffffff",
        }
      );
      promptText.setOrigin(0.5).setScrollFactor(0);

      // Create input field simulation
      const inputBox = this.scene.add.graphics();
      inputBox.fillStyle(0xffffff, 1);
      inputBox.fillRect(
        this.scene.cameras.main.centerX - 150,
        this.scene.cameras.main.centerY,
        300,
        50
      );
      inputBox.setScrollFactor(0);

      const inputText = this.scene.add.text(
        this.scene.cameras.main.centerX,
        this.scene.cameras.main.centerY + 25,
        "",
        {
          fontSize: "24px",
          color: "#000000",
        }
      );
      inputText.setOrigin(0.5).setScrollFactor(0);

      // Handle keyboard input
      const nameInputHandler = (event: KeyboardEvent) => {
        if (event.key === "Enter" && this.playerName.length > 0) {
          // Start game
          overlay.destroy();
          promptText.destroy();
          inputBox.destroy();
          inputText.destroy();
          this.scene.input.keyboard?.off("keydown", nameInputHandler);
          this.scene.physics.resume();
          resolve(this.playerName);
        } else if (event.key === "Backspace") {
          this.playerName = this.playerName.slice(0, -1);
          inputText.setText(this.playerName);
        } else if (event.key.length === 1 && this.playerName.length < 15) {
          this.playerName += event.key;
          inputText.setText(this.playerName);
        }
      };

      this.scene.input.keyboard?.on("keydown", nameInputHandler);
    });
  }

  /**
   * Create the main game UI (instructions and hearts)
   */
  createGameUI(maxLives: number = 3) {
    const text = this.scene.add.text(
      10,
      10,
      "Use Arrow Keys & Spacebar to move Steve!",
      {
        fontSize: "20px",
        color: "#ffffff",
      }
    );
    text.setScrollFactor(0);

    // Create hearts for lives
    this.heartTexts = [];
    for (let i = 0; i < maxLives; i++) {
      const heart = this.scene.add.text(10 + i * 35, 40, "❤️", {
        fontSize: "24px",
      });
      heart.setScrollFactor(0);
      this.heartTexts.push(heart);
    }
  }

  /**
   * Create player name text that follows the player
   */
  createPlayerNameText(
    playerName: string,
    x: number,
    y: number
  ): Phaser.GameObjects.Text {
    this.nameText = this.scene.add.text(x, y, playerName, {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 5, y: 2 },
    });
    this.nameText.setOrigin(0.5, 1);
    return this.nameText;
  }

  /**
   * Update player name text position
   */
  updatePlayerNamePosition(x: number, y: number) {
    if (this.nameText) {
      this.nameText.setPosition(x, y - 30);
    }
  }

  /**
   * Update player name text content
   */
  updatePlayerName(newName: string) {
    if (this.nameText) {
      this.nameText.setText(newName);
    }
  }

  /**
   * Update hearts display based on lives remaining
   */
  updateLives(livesRemaining: number) {
    if (livesRemaining >= 0 && livesRemaining < this.heartTexts.length) {
      this.heartTexts[livesRemaining].setAlpha(0.3);
    }
  }

  /**
   * Show game over screen and return a promise that resolves when restart is requested
   */
  showGameOver(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.physics.pause();

      const gameOverText = this.scene.add.text(
        this.scene.cameras.main.centerX,
        this.scene.cameras.main.centerY,
        "GAME OVER\nPress R to Restart",
        {
          fontSize: "48px",
          color: "#ff0000",
          backgroundColor: "#000000",
          padding: { x: 20, y: 20 },
          align: "center",
        }
      );
      gameOverText.setOrigin(0.5).setScrollFactor(0);

      // Remove all existing keyboard listeners
      this.scene.input.keyboard?.removeAllListeners();

      // Add restart functionality
      const restartHandler = (event: KeyboardEvent) => {
        if (event.key === "r" || event.key === "R") {
          this.scene.input.keyboard?.off("keydown", restartHandler);
          resolve();
        }
      };

      this.scene.input.keyboard?.on("keydown", restartHandler);
    });
  }

  /**
   * Get the player name that was entered
   */
  getPlayerName(): string {
    return this.playerName;
  }

  /**
   * Reset player name (useful for restart)
   */
  resetPlayerName() {
    this.playerName = "";
  }
}
