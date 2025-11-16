import Phaser from "phaser";
import { CONTROL_STATES } from "./constants";

export class UIManager {
  private scene: Phaser.Scene;
  private heartTexts: Phaser.GameObjects.Text[] = [];
  private distanceText: Phaser.GameObjects.Text | null = null;
  private poopsCollectedText: Phaser.GameObjects.Text | null = null;
  private playerName: string = "";
  private mobileControls: {
    leftBtn?: Phaser.GameObjects.Graphics;
    rightBtn?: Phaser.GameObjects.Graphics;
    jumpBtn?: Phaser.GameObjects.Graphics;
    shootBtn?: Phaser.GameObjects.Graphics;
    poopBtn?: Phaser.GameObjects.Graphics;
    collectBtn?: Phaser.GameObjects.Graphics;
  } = {};

  // Control states for external access
  public controlStates = CONTROL_STATES;

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

      // Create HTML input element
      const inputElement = document.createElement("input");
      inputElement.type = "text";
      inputElement.maxLength = 15;
      inputElement.placeholder = "Your name";
      inputElement.style.position = "absolute";
      inputElement.style.left = "50%";
      inputElement.style.top = "50%";
      inputElement.style.transform = "translate(-50%, -50%)";
      inputElement.style.width = "300px";
      inputElement.style.height = "50px";
      inputElement.style.fontSize = "24px";
      inputElement.style.padding = "10px";
      inputElement.style.textAlign = "center";
      inputElement.style.border = "2px solid #fff";
      inputElement.style.borderRadius = "5px";
      inputElement.style.outline = "none";
      document.body.appendChild(inputElement);
      inputElement.focus();

      // Handle form submission
      const handleSubmit = () => {
        const name = inputElement.value.trim();
        if (name.length > 0) {
          this.playerName = name;
          document.body.removeChild(inputElement);
          document.body.removeChild(submitButton);
          overlay.destroy();
          promptText.destroy();
          this.scene.physics.resume();
          resolve(this.playerName);
        }
      };

      inputElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          handleSubmit();
        }
      });

      // Add a submit button for better mobile UX
      const submitButton = document.createElement("button");
      submitButton.textContent = "Start Game";
      submitButton.style.position = "absolute";
      submitButton.style.left = "50%";
      submitButton.style.top = "60%";
      submitButton.style.transform = "translateX(-50%)";
      submitButton.style.padding = "15px 30px";
      submitButton.style.fontSize = "20px";
      submitButton.style.cursor = "pointer";
      submitButton.style.border = "none";
      submitButton.style.borderRadius = "5px";
      submitButton.style.backgroundColor = "#4CAF50";
      submitButton.style.color = "white";
      document.body.appendChild(submitButton);

      submitButton.addEventListener("click", () => {
        handleSubmit();
      });
    });
  }

  /**
   * Create the main game UI (instructions and hearts)
   */
  createGameUI(maxLives: number = 3) {
    // Create hearts for lives
    this.heartTexts = [];
    for (let i = 0; i < maxLives; i++) {
      const heart = this.scene.add.text(10 + i * 35, 10, "❤️", {
        fontSize: "24px",
      });
      heart.setScrollFactor(0);
      this.heartTexts.push(heart);
    }
    this.createMobileControls();
    this.distanceText = this.scene.add.text(
      this.scene.cameras.main.width - 10,
      10,
      "Distance: 0m",
      {
        fontSize: "20px",
        color: "#ffffff",
      }
    );
    this.distanceText.setOrigin(1, 0);
    this.distanceText.setScrollFactor(0);
    this.poopsCollectedText = this.scene.add.text(10, 40, "💩 0", {
      fontSize: "20px",
      color: "#4b2f2fff",
    });
    this.poopsCollectedText.setOrigin(0, 0);
    this.poopsCollectedText.setScrollFactor(0);
  }

  private createMobileControls() {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const buttonSize = 60;
    const buttonPadding = 5;
    const bottomOffset = 2;

    // Left arrow button
    this.mobileControls.leftBtn = this.createControlButton(
      width / 2 - buttonPadding * 2 - buttonSize * 2,
      height - buttonSize - bottomOffset,
      buttonSize,
      "◀",
      () => {
        this.controlStates.left = true;
      },
      () => {
        this.controlStates.left = false;
      }
    );

    // Right arrow button
    this.mobileControls.rightBtn = this.createControlButton(
      width / 2 - buttonPadding - buttonSize,
      height - buttonSize - bottomOffset,
      buttonSize,
      "▶",
      () => {
        this.controlStates.right = true;
      },
      () => {
        this.controlStates.right = false;
      }
    );

    // Jump/Space button
    this.mobileControls.jumpBtn = this.createControlButton(
      width / 2 + buttonPadding * 2 + buttonSize * 2,
      height - buttonSize - bottomOffset,
      buttonSize,
      "↑",
      () => {
        this.controlStates.jump = true;
      },
      () => {
        this.controlStates.jump = false;
      }
    );

    // Shoot button
    this.mobileControls.shootBtn = this.createControlButton(
      width / 2 + buttonPadding + buttonSize,
      height - buttonSize - bottomOffset,
      buttonSize,
      "X",
      () => {
        this.controlStates.shoot = true;
      },
      () => {
        this.controlStates.shoot = false;
      },
      "#ffffff"
    );

    // Poop button (half size, positioned below shoot button)
    const poopButtonSize = buttonSize / 2;
    this.mobileControls.poopBtn = this.createControlButton(
      width / 2 + buttonPadding + buttonSize,
      height - buttonSize - bottomOffset - poopButtonSize - buttonPadding,
      poopButtonSize,
      "K",
      () => {
        this.controlStates.poop = true;
      },
      () => {
        this.controlStates.poop = false;
      },
      "#8B4513" // Brown color
    );

    // Collect/Throw button (half size, positioned below poop button)
    this.mobileControls.collectBtn = this.createControlButton(
      width / 2 + buttonPadding + buttonSize,
      height -
        buttonSize -
        bottomOffset -
        poopButtonSize * 2 -
        buttonPadding * 2,
      poopButtonSize,
      "C",
      () => {
        this.controlStates.collect = true;
      },
      () => {
        this.controlStates.collect = false;
      },
      "#4CAF50" // Green color
    );
  }

  private createControlButton(
    x: number,
    y: number,
    size: number,
    label: string,
    onDown: () => void,
    onUp: () => void,
    textColor: string = "#ffffff"
  ): Phaser.GameObjects.Graphics {
    // Create button background
    const button = this.scene.add.graphics();
    button.fillStyle(0x333333, 0.7);
    button.fillRoundedRect(x, y, size, size, 10);
    button.lineStyle(2, 0xffffff, 0.8);
    button.strokeRoundedRect(x, y, size, size, 10);
    button.setScrollFactor(0);
    button.setDepth(1000);

    // Create button label
    const fontSize = size < 40 ? "14px" : "28px";
    const buttonText = this.scene.add.text(x + size / 2, y + size / 2, label, {
      fontSize: fontSize,
      color: textColor,
    });
    buttonText.setOrigin(0.5);
    buttonText.setScrollFactor(0);
    buttonText.setDepth(1001);

    // Track active pointer for this button
    let activePointer: Phaser.Input.Pointer | null = null;

    const drawPressed = () => {
      button.clear();
      button.fillStyle(0x555555, 0.9);
      button.fillRoundedRect(x, y, size, size, 10);
      button.lineStyle(2, 0xffffff, 1);
      button.strokeRoundedRect(x, y, size, size, 10);
    };

    const drawUnpressed = () => {
      button.clear();
      button.fillStyle(0x333333, 0.7);
      button.fillRoundedRect(x, y, size, size, 10);
      button.lineStyle(2, 0xffffff, 0.8);
      button.strokeRoundedRect(x, y, size, size, 10);
    };

    // Make button interactive
    const hitArea = new Phaser.Geom.Rectangle(x, y, size, size);
    button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    button.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only accept if no pointer is active
      if (!activePointer) {
        activePointer = pointer;
        drawPressed();
        onDown();
      }
    });

    button.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (activePointer === pointer) {
        activePointer = null;
        drawUnpressed();
        onUp();
      }
    });

    // Listen to global pointer up events to catch releases outside the button
    const globalUpHandler = (pointer: Phaser.Input.Pointer) => {
      if (activePointer === pointer) {
        activePointer = null;
        drawUnpressed();
        onUp();
      }
    };
    this.scene.input.on("pointerup", globalUpHandler);

    // Clean up listener when button is destroyed
    button.on("destroy", () => {
      this.scene.input.off("pointerup", globalUpHandler);
    });

    return button;
  }

  /**
   * Update hearts display based on lives remaining
   */
  updateLives(livesRemaining: number) {
    if (livesRemaining >= 0 && livesRemaining < this.heartTexts.length) {
      this.heartTexts[livesRemaining].setAlpha(0.3);
    }
  }

  updateDistance(distance: number) {
    if (this.distanceText) {
      this.distanceText.setText(`Distance: ${Math.floor(distance)}m`);
    }
  }

  updatePoopsCollected(count: number) {
    if (this.poopsCollectedText) {
      this.poopsCollectedText.setText(`💩 ${count}`);
    }
  }

  destroyMobileControls() {
    Object.values(this.mobileControls).forEach((control) => {
      control?.destroy();
    });
    this.mobileControls = {};
    this.controlStates = {
      left: false,
      right: false,
      jump: false,
      shoot: false,
      poop: false,
      collect: false,
    };
  }
}
