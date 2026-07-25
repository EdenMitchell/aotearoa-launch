import Phaser from "phaser";
import { IMAGE_ASSET_MANIFEST } from "./assets";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "preload" });
  }

  preload(): void {
    const loadingText = this.add
      .text(640, 340, "POWERING UP…", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.load.on("complete", () => loadingText.setText("READY!"));
    IMAGE_ASSET_MANIFEST.forEach(({ key, path }) => this.load.image(key, path));
  }

  create(): void {
    this.scene.start("profiles");
  }
}
