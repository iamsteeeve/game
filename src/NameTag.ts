import Phaser from "phaser";

export class NameTag {
  private nameText: Phaser.GameObjects.Text;
  private healthBar: Phaser.GameObjects.Graphics;
  private backgroundBar: Phaser.GameObjects.Graphics;
  private playerName: string;
  private currentHealth: number = 100;
  private padding: number = 4;

  constructor(scene: Phaser.Scene, x: number, y: number, playerName: string) {
    this.playerName = playerName;

    // Create background bar (gray/dark background)
    this.backgroundBar = scene.add.graphics();
    this.backgroundBar.setDepth(1);

    // Create health bar (colored fill)
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(2);

    // Create the name text without background
    this.nameText = scene.add.text(x, y, playerName, {
      fontSize: "14px",
      color: "#ffffff",
      padding: { x: this.padding, y: 2 },
    });
    this.nameText.setOrigin(0.5, 1);
    this.nameText.setDepth(3);

    // Initial health bar render
    this.updateHealthBar();
  }

  /**
   * Get background color based on health value (as hex number for graphics)
   * Green (50-100), Orange (20-49), Red (0-19)
   */
  private getBackgroundColorHex(health: number): number {
    if (health >= 51) {
      return 0x00aa00; // Green
    } else if (health >= 26) {
      return 0xff8800; // Orange
    } else {
      return 0xcc0000; // Red
    }
  }

  /**
   * Update the health and redraw the health bar
   */
  public updateHealth(health: number) {
    // Clamp health between 0 and 100
    this.currentHealth = Math.max(0, Math.min(100, health));

    // Redraw health bar with new health value
    this.updateHealthBar();
  }

  /**
   * Draw the health bar as a progressive fill
   */
  private updateHealthBar() {
    const textBounds = this.nameText.getBounds();
    const x = textBounds.x;
    const y = textBounds.y;
    const width = textBounds.width;
    const height = textBounds.height;

    // Clear previous graphics
    this.backgroundBar.clear();
    this.healthBar.clear();

    // Draw dark background (full width)
    this.backgroundBar.fillStyle(0x000000, 0.8);
    this.backgroundBar.fillRect(x, y, width, height);

    // Calculate health bar fill width (from left to right based on health)
    const healthWidth = (width * this.currentHealth) / 100;

    // Draw health bar with color based on health percentage
    const color = this.getBackgroundColorHex(this.currentHealth);
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, healthWidth, height);
  }

  /**
   * Update the position of the name tag
   */
  public setPosition(x: number, y: number) {
    this.nameText.setPosition(x, y);
    // Redraw health bar at new position
    this.updateHealthBar();
  }

  /**
   * Get the current health value
   */
  public getHealth(): number {
    return this.currentHealth;
  }

  /**
   * Update the displayed name
   */
  public setName(name: string) {
    this.playerName = name;
    this.nameText.setText(name);
  }

  /**
   * Get the displayed name
   */
  public getName(): string {
    return this.playerName;
  }

  /**
   * Check if the name tag exists
   */
  public exists(): boolean {
    return this.nameText !== null && this.nameText.active;
  }

  /**
   * Destroy the name tag
   */
  public destroy() {
    if (this.nameText) {
      this.nameText.destroy();
    }
    if (this.healthBar) {
      this.healthBar.destroy();
    }
    if (this.backgroundBar) {
      this.backgroundBar.destroy();
    }
  }
}
