import Phaser from "phaser";
import { POWER_LAUNCH_TIMED } from "../config/timedMode";
import { BONE_TARGET_TEXTURE, DOG_PROJECTILE_TEXTURE, MENU_BACKDROP_TEXTURE } from "./assets";
import { gameAudio, profileStore } from "./runtime";

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "modes" });
  }

  create(): void {
    const profile = profileStore.activeProfile();
    if (!profile) {
      this.scene.start("profiles");
      return;
    }

    this.cameras.main.setBackgroundColor(0x171236);
    this.add.image(640, 360, MENU_BACKDROP_TEXTURE).setDisplaySize(1280, 720).setDepth(-20);
    this.add.rectangle(640, 360, 1280, 720, 0x100c2b, 0.36).setDepth(-19);

    this.add
      .text(640, 68, "CHOOSE YOUR ADVENTURE", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "43px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(640, 119, `Ready, ${profile.name}?`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color: "#cfc7ff",
      })
      .setOrigin(0.5);

    this.createJourneyCard(Boolean(profile.activeRun?.mode === "cup"));
    this.createTimedCard(profile.timedBestScore);

    this.textButton(92, 667, "← PLAYERS", 145, 40, 0x35256f, () => this.scene.start("profiles"));
    const settings = profileStore.snapshot().settings;
    this.textButton(1055, 647, settings.muted ? "SOUND OFF" : "SOUND ON", 145, 38, 0x35256f, () => {
      profileStore.setSettings({ muted: !settings.muted });
      this.scene.restart();
    });
    this.textButton(
      1055,
      692,
      settings.reducedMotion ? "CALM MOTION" : "FULL MOTION",
      145,
      38,
      0x35256f,
      () => {
        profileStore.setSettings({ reducedMotion: !settings.reducedMotion });
        this.scene.restart();
      },
    );
  }

  private createJourneyCard(hasActiveCup: boolean): void {
    const shadow = this.add.rectangle(10, 12, 390, 420, 0x050312, 0.38);
    const background = this.add.rectangle(0, 0, 390, 420, 0x302572).setStrokeStyle(6, 0xa897ff);
    const glow = this.add.circle(0, -103, 92, 0x7759f7, 0.5);
    const dog = this.add.image(-25, -112, DOG_PROJECTILE_TEXTURE).setDisplaySize(126, 126);
    const bone = this.add.image(74, -98, BONE_TARGET_TEXTURE).setDisplaySize(54, 96).setAngle(5);
    const title = this.add
      .text(0, 3, "JOURNEY MODE", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "31px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(0, 58, "Complete all five Launch Cups\nEarn medals, stars and new gear", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "17px",
        color: "#dcd6ff",
        align: "center",
        lineSpacing: 7,
      })
      .setOrigin(0.5);
    const nodes = this.add.graphics();
    nodes.lineStyle(5, 0x9584f7, 0.8).lineBetween(-100, 118, 100, 118);
    for (let index = 0; index < 5; index += 1) {
      nodes.fillStyle(index === 0 ? 0xffd84c : 0x7759f7, 1).fillCircle(-100 + index * 50, 118, index === 4 ? 13 : 10);
    }
    const action = this.add
      .text(0, 169, hasActiveCup ? "CONTINUE JOURNEY" : "START JOURNEY", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#21184f",
        backgroundColor: "#ffd84c",
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5);
    const card = this.add
      .container(405, 376, [shadow, background, glow, dog, bone, title, detail, nodes, action])
      .setSize(390, 420)
      .setInteractive({ useHandCursor: true });
    this.bindCard(card, () => this.scene.start("cups"));
  }

  private createTimedCard(bestScore: number): void {
    const durationSeconds = Math.round(POWER_LAUNCH_TIMED.durationMs / 1_000);
    const durationMinutes = Math.floor(durationSeconds / 60);
    const durationRemainder = String(durationSeconds % 60).padStart(2, "0");
    const shadow = this.add.rectangle(10, 12, 390, 420, 0x050312, 0.38);
    const background = this.add.rectangle(0, 0, 390, 420, 0x7b355d).setStrokeStyle(6, 0xff8c7a);
    const timerGlow = this.add.circle(0, -108, 91, 0xff6b6b, 0.35);
    const timer = this.add.circle(0, -108, 72, 0x21184f).setStrokeStyle(7, 0xffd84c);
    const timerText = this.add
      .text(0, -108, `${durationMinutes}:${durationRemainder}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "40px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const title = this.add
      .text(0, 3, "TIMED MODE", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "31px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(0, 58, "Score as much as you can\nLaunches adapt to your perfect pace", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "17px",
        color: "#ffe0e7",
        align: "center",
        lineSpacing: 7,
      })
      .setOrigin(0.5);
    const best = this.add
      .text(0, 117, `PERSONAL BEST  ${bestScore}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd84c",
      })
      .setOrigin(0.5);
    const action = this.add
      .text(0, 169, `START ${durationSeconds}s BLAST`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#21184f",
        backgroundColor: "#ffd84c",
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5);
    const card = this.add
      .container(875, 376, [shadow, background, timerGlow, timer, timerText, title, detail, best, action])
      .setSize(390, 420)
      .setInteractive({ useHandCursor: true });
    this.bindCard(card, () => this.scene.start("power-launch", { mode: "timed" }));
  }

  private bindCard(card: Phaser.GameObjects.Container, action: () => void): void {
    card.on("pointerdown", () => card.setScale(0.975));
    card.on("pointerout", () => card.setScale(1));
    card.on("pointerup", () => {
      card.setScale(1);
      gameAudio.tile();
      action();
    });
  }

  private textButton(
    x: number,
    y: number,
    label: string,
    width: number,
    height: number,
    color: number,
    action: () => void,
  ): void {
    const background = this.add.rectangle(0, 0, width, height, color).setStrokeStyle(3, 0xffffff, 0.18);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const button = this.add
      .container(x, y, [background, text])
      .setSize(width, height)
      .setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => button.setScale(0.97));
    button.on("pointerout", () => button.setScale(1));
    button.on("pointerup", () => {
      button.setScale(1);
      gameAudio.tile();
      action();
    });
  }
}
