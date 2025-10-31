import Phaser from "phaser";

export class CollisionManager {
  /**
   * Check if player bounds intersect with lava tiles
   */
  static checkLavaCollision(
    player: Phaser.Physics.Arcade.Sprite,
    lavaGroup: Phaser.Physics.Arcade.StaticGroup
  ): boolean {
    const lavaTiles = lavaGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const playerBounds = player.getBounds();

    // Shrink player bounds to allow closer proximity to lava
    const shrinkAmount = 7;
    playerBounds.x += shrinkAmount;
    playerBounds.y += shrinkAmount;
    playerBounds.width -= shrinkAmount * 2;

    for (const lavaTile of lavaTiles) {
      const lavaBounds = lavaTile.getBounds();

      // Check if player bounds intersect with lava bounds
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, lavaBounds)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if player is currently on a lava tile
   */
  static isPlayerOnLava(
    player: Phaser.Physics.Arcade.Sprite,
    lavaGroup: Phaser.Physics.Arcade.StaticGroup
  ): boolean {
    const lavaTiles = lavaGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const playerBounds = player.getBounds();

    // Shrink player bounds to allow closer proximity to lava (same as checkLavaCollision)
    const shrinkAmount = 7;
    playerBounds.x += shrinkAmount;
    playerBounds.y += shrinkAmount;
    playerBounds.width -= shrinkAmount * 2;

    for (const lavaTile of lavaTiles) {
      const lavaBounds = lavaTile.getBounds();
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, lavaBounds)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if player's feet are touching a grass tile and not on lava
   */
  static isPlayerOnGrass(
    player: Phaser.Physics.Arcade.Sprite,
    groundGroup: Phaser.Physics.Arcade.StaticGroup,
    lavaGroup: Phaser.Physics.Arcade.StaticGroup
  ): boolean {
    const grassTiles =
      groundGroup.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const playerBounds = player.getBounds();

    // Check if player's feet are touching a grass tile
    const feetBounds = new Phaser.Geom.Rectangle(
      playerBounds.x + 5,
      playerBounds.bottom - 5,
      playerBounds.width - 10,
      5
    );

    for (const grassTile of grassTiles) {
      const grassBounds = grassTile.getBounds();
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(feetBounds, grassBounds)
      ) {
        // Also make sure no lava is nearby
        if (!this.isPlayerOnLava(player, lavaGroup)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if a position is safe (has grass and no nearby lava)
   */
  static checkPositionIsSafe(
    x: number,
    tileSize: number,
    grassTiles: Phaser.GameObjects.GameObject[],
    lavaTiles: Phaser.GameObjects.GameObject[]
  ): boolean {
    // Check if there's grass at this position
    const hasGrass = grassTiles.some((tile) => {
      const sprite = tile as Phaser.Physics.Arcade.Sprite;
      return Math.abs(sprite.x - x) < tileSize / 2;
    });

    if (!hasGrass) return false;

    // Check if there's no lava at or near this position
    const hasLava = lavaTiles.some((tile) => {
      const sprite = tile as Phaser.Physics.Arcade.Sprite;
      return Math.abs(sprite.x - x) < tileSize * 2; // Keep distance from lava
    });

    return !hasLava;
  }
}
