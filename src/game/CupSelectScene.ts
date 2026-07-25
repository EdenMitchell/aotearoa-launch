import Phaser from "phaser";
import type {
  CosmeticCategory,
  CupDifficultyBadge,
  Medal,
} from "../domain/campaignTypes";
import {
  isCupUnlocked,
  isEndlessUnlocked,
  totalProfileStars,
  type PlayerProfile,
} from "../domain/profileStore";
import { DOG_PROJECTILE_TEXTURE, MENU_BACKDROP_TEXTURE } from "./assets";
import { arcadeConfig, gameAudio, profileStore } from "./runtime";

const MEDAL_COLORS: Record<Medal, number> = {
  bronze: 0xc77a45,
  silver: 0xcad5e1,
  gold: 0xffd84c,
};
const AVATAR_COLORS = [0xffd84c, 0x65d4ff, 0xff8c8c, 0x8f79ff, 0x55d69c, 0xffad73];

interface GameplayStartData {
  readonly mode: "cup" | "endless";
  readonly cupId?: string;
}

export class CupSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "cups" });
  }

  create(): void {
    const profile = profileStore.activeProfile();
    if (!profile) {
      this.scene.start("profiles");
      return;
    }
    this.cameras.main.setBackgroundColor(0x171236);
    this.add.image(640, 360, MENU_BACKDROP_TEXTURE).setDisplaySize(1280, 720).setDepth(-20);
    this.add.rectangle(640, 360, 1280, 720, 0x100c2b, 0.42).setDepth(-19);

    this.add.circle(74, 72, 42, AVATAR_COLORS[profile.avatarIndex]);
    const profileDog = this.add
      .image(74, 72, DOG_PROJECTILE_TEXTURE)
      .setDisplaySize(76, 76)
      .setInteractive({ useHandCursor: true });
    profileDog.on("pointerup", () => {
      profileStore.setAvatar(profile.id, profile.avatarIndex + 1);
      gameAudio.tile();
      this.scene.restart();
    });
    this.add
      .text(74, 117, "TAP AVATAR", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#d8d1ff",
      })
      .setOrigin(0.5);
    this.add
      .text(118, 38, `${profile.name.toUpperCase()}'S ARCADE`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ffffff",
      });
    const stars = totalProfileStars(profile);
    this.add
      .text(118, 78, `★ ${stars} / 15    •    BEST ENDLESS ${profile.endlessBestScore}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd84c",
      });

    this.textButton(64, 142, "← MODES", 132, 36, 0x35256f, () => this.scene.start("modes"));
    const settings = profileStore.snapshot().settings;
    this.textButton(1090, 48, settings.muted ? "SOUND OFF" : "SOUND ON", 145, 38, 0x35256f, () => {
      profileStore.setSettings({ muted: !settings.muted });
      this.scene.restart();
    });
    this.textButton(1090, 94, settings.reducedMotion ? "CALM MOTION" : "FULL MOTION", 145, 38, 0x35256f, () => {
      profileStore.setSettings({ reducedMotion: !settings.reducedMotion });
      this.scene.restart();
    });

    arcadeConfig.cups.forEach((cup, index) => {
      const unlocked = isCupUnlocked(profile, index, arcadeConfig);
      const record = profile.cupRecords[cup.id];
      const x = 135 + index * 252;
      const y = 312;
      const shadow = this.add.rectangle(8, 10, 218, 278, 0x050312, 0.38);
      const background = this.add
        .rectangle(0, 0, 218, 278, unlocked ? cup.theme.skyDeep : 0x302b4c)
        .setStrokeStyle(5, unlocked ? cup.theme.accent : 0x625d79);
      const numberBadge = this.add.circle(0, -93, 31, unlocked ? cup.theme.accent : 0x625d79);
      const number = this.add
        .text(0, -93, String(index + 1), {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "27px",
          fontStyle: "bold",
          color: unlocked ? "#21184f" : "#c3bfd4",
        })
        .setOrigin(0.5);
      const name = this.add
        .text(0, -39, cup.name.replace(" ", "\n"), {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "21px",
          fontStyle: "bold",
          color: unlocked ? "#ffffff" : "#aaa5bf",
          align: "center",
        })
        .setOrigin(0.5);
      const subtitle = this.add
        .text(0, 16, unlocked ? cup.subtitle : "Complete the previous cup", {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "13px",
          color: unlocked ? "#ffffff" : "#aaa5bf",
          align: "center",
          wordWrap: { width: 178 },
        })
        .setOrigin(0.5);
      const difficultyBadge = cup.difficultyBadge
        ? this.createDifficultyBadge(cup.difficultyBadge, unlocked, settings.reducedMotion)
        : undefined;
      const isResume = profile.activeRun?.mode === "cup" && profile.activeRun.cupId === cup.id;
      const statusLabel = isResume
        ? "RESUME CUP"
        : record
          ? `${record.medal.toUpperCase()}  •  ${record.bestScore}`
          : unlocked
            ? "START CUP"
            : "LOCKED";
      const status = this.add
        .text(0, 91, statusLabel, {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "15px",
          fontStyle: "bold",
          color: record ? "#21184f" : unlocked ? "#ffffff" : "#aaa5bf",
          backgroundColor: record
            ? `#${MEDAL_COLORS[record.medal].toString(16).padStart(6, "0")}`
            : unlocked
              ? "#7759f7"
              : "#48425e",
          padding: { x: 15, y: 9 },
        })
        .setOrigin(0.5);
      const cardObjects: Phaser.GameObjects.GameObject[] = [
        shadow,
        background,
        numberBadge,
        number,
        name,
        subtitle,
      ];
      if (difficultyBadge) {
        cardObjects.push(difficultyBadge);
      }
      cardObjects.push(status);
      const container = this.add
        .container(x, y, cardObjects)
        .setSize(218, 278);
      if (unlocked) {
        container.setInteractive({ useHandCursor: true });
        container.on("pointerdown", () => container.setScale(0.97));
        container.on("pointerup", () => {
          container.setScale(1);
          gameAudio.tile();
          this.startGameplay({ mode: "cup", cupId: cup.id });
        });
      }
    });

    this.createGearRow(profile, stars);

    const endlessUnlocked = isEndlessUnlocked(profile, arcadeConfig);
    this.textButton(
      640,
      654,
      endlessUnlocked ? `∞  ENDLESS BLAST  •  BEST ${profile.endlessBestScore}` : "∞  ENDLESS BLAST  •  COMPLETE ALL CUPS",
      430,
      52,
      endlessUnlocked ? 0xff6b6b : 0x45405c,
      () => this.startGameplay({ mode: "endless" }),
      endlessUnlocked,
    );
  }

  private createDifficultyBadge(
    badge: CupDifficultyBadge,
    unlocked: boolean,
    reducedMotion: boolean,
  ): Phaser.GameObjects.Container {
    const objects: Phaser.GameObjects.GameObject[] = [];
    let animatedGlow: Phaser.GameObjects.Shape | undefined;

    if (badge.kind === "hard") {
      animatedGlow = this.add.rectangle(0, 0, 91, 27, 0xffc84c, 0.2);
      const plate = this.add
        .rectangle(0, 0, 84, 23, 0x744111)
        .setStrokeStyle(2, 0xffd66b);
      const sparks = this.add.graphics();
      sparks.fillStyle(0xffd84c, 1);
      sparks.fillTriangle(-51, 0, -45, -4, -45, 4);
      sparks.fillTriangle(51, 0, 45, -4, 45, 4);
      objects.push(animatedGlow, plate, sparks);
    } else if (badge.kind === "brutal") {
      animatedGlow = this.add.rectangle(0, 1, 114, 31, 0xff573d, 0.24);
      const plate = this.add.graphics();
      plate.fillStyle(0x621b27, 1);
      plate.lineStyle(2, 0xff7951, 1);
      const points = [
        new Phaser.Geom.Point(-55, -11),
        new Phaser.Geom.Point(-45, -14),
        new Phaser.Geom.Point(-29, -12),
        new Phaser.Geom.Point(-16, -15),
        new Phaser.Geom.Point(0, -12),
        new Phaser.Geom.Point(17, -15),
        new Phaser.Geom.Point(31, -12),
        new Phaser.Geom.Point(45, -14),
        new Phaser.Geom.Point(55, -11),
        new Phaser.Geom.Point(52, 11),
        new Phaser.Geom.Point(38, 14),
        new Phaser.Geom.Point(20, 12),
        new Phaser.Geom.Point(0, 15),
        new Phaser.Geom.Point(-20, 12),
        new Phaser.Geom.Point(-38, 14),
        new Phaser.Geom.Point(-52, 11),
      ];
      plate.fillPoints(points, true);
      plate.strokePoints(points, true);
      const heatMarks = this.add.graphics();
      heatMarks.fillStyle(0xffb43b, 1);
      heatMarks.fillTriangle(-45, -12, -39, -22, -34, -12);
      heatMarks.fillTriangle(35, -12, 41, -23, 47, -12);
      objects.push(animatedGlow, heatMarks, plate);
    } else {
      animatedGlow = this.add.ellipse(0, 0, 150, 42, 0xff3c24, 0.28);
      const outerPlate = this.add
        .rectangle(0, 1, 138, 30, 0x491126)
        .setStrokeStyle(3, 0xff5b32);
      const innerPlate = this.add
        .rectangle(0, 1, 130, 24, 0x190e2b)
        .setStrokeStyle(1, 0xffcb47);
      const flames = this.add.graphics();
      flames.fillStyle(0xff5b2d, 1);
      flames.fillTriangle(-58, -13, -50, -27, -42, -13);
      flames.fillTriangle(-31, -13, -23, -31, -14, -13);
      flames.fillTriangle(-5, -13, 2, -25, 10, -13);
      flames.fillTriangle(20, -13, 28, -30, 37, -13);
      flames.fillTriangle(44, -13, 52, -26, 60, -13);
      flames.fillStyle(0xffd84c, 1);
      flames.fillTriangle(-27, -13, -23, -23, -18, -13);
      flames.fillTriangle(24, -13, 28, -22, 33, -13);
      objects.push(animatedGlow, flames, outerPlate, innerPlate);
    }

    const label = this.add
      .text(0, badge.kind === "impossible" ? 1 : 0, badge.label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: badge.kind === "hard" ? "13px" : "14px",
        fontStyle: "bold",
        color: badge.kind === "hard" ? "#fff2b7" : "#ffffff",
        stroke: badge.kind === "impossible" ? "#731328" : "#351020",
        strokeThickness: badge.kind === "hard" ? 1 : 2,
      })
      .setOrigin(0.5);
    objects.push(label);

    const container = this.add
      .container(0, 55, objects)
      .setAlpha(unlocked ? 1 : 0.46);

    if (unlocked && !reducedMotion && animatedGlow) {
      this.tweens.add({
        targets: animatedGlow,
        alpha: badge.kind === "hard" ? { from: 0.12, to: 0.28 } : { from: 0.16, to: 0.42 },
        scaleX: badge.kind === "impossible" ? { from: 0.94, to: 1.08 } : { from: 0.98, to: 1.04 },
        scaleY: badge.kind === "impossible" ? { from: 0.9, to: 1.1 } : { from: 0.96, to: 1.05 },
        duration: badge.kind === "hard" ? 1100 : badge.kind === "brutal" ? 780 : 560,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
      });
    }

    return container;
  }

  private createGearRow(profile: PlayerProfile, stars: number): void {
    const nextUnlock = arcadeConfig.cosmeticUnlocks.find((unlock) => unlock.starThreshold > stars);
    this.add
      .text(76, 494, "EQUIPPED GEAR", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        color: "#d8d1ff",
      });
    const categories: readonly CosmeticCategory[] = ["hat", "trail", "launcher", "target"];
    categories.forEach((category, index) => {
      const currentId = profile.equippedCosmetics[category];
      const current = arcadeConfig.cosmeticUnlocks.find((unlock) => unlock.id === currentId);
      const label = `${category.toUpperCase()}\n${current?.name ?? "Classic"}`;
      this.textButton(156 + index * 248, 548, label, 222, 66, 0x35256f, () =>
        this.cycleCosmetic(profile, category),
      );
    });
    this.add
      .text(1130, 494, nextUnlock ? `NEXT: ★ ${nextUnlock.starThreshold}\n${nextUnlock.name}` : "ALL GEAR\nUNLOCKED!", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffd84c",
        align: "center",
      })
      .setOrigin(0.5, 0);
  }

  private cycleCosmetic(profile: PlayerProfile, category: CosmeticCategory): void {
    const available = arcadeConfig.cosmeticUnlocks.filter(
      (unlock) => unlock.category === category && profile.unlockedCosmeticIds.includes(unlock.id),
    );
    const options: (string | undefined)[] = [undefined, ...available.map((unlock) => unlock.id)];
    const current = profile.equippedCosmetics[category];
    const currentIndex = options.indexOf(current);
    const next = options[(currentIndex + 1) % options.length];
    profileStore.equipCosmetic(profile.id, category, next, arcadeConfig);
    gameAudio.tile();
    this.scene.restart();
  }

  private startGameplay(data: GameplayStartData): void {
    this.scene.start("power-launch", data);
  }

  private textButton(
    x: number,
    y: number,
    label: string,
    width: number,
    height: number,
    color: number,
    onPress: () => void,
    enabled = true,
  ): Phaser.GameObjects.Container {
    const background = this.add
      .rectangle(0, 0, width, height, color)
      .setStrokeStyle(3, 0xffffff, enabled ? 0.2 : 0.08);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: height > 45 ? "17px" : "13px",
        fontStyle: "bold",
        color: enabled ? "#ffffff" : "#8f899e",
        align: "center",
      })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [background, text]).setSize(width, height);
    if (enabled) {
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => container.setScale(0.97));
      container.on("pointerout", () => container.setScale(1));
      container.on("pointerup", () => {
        container.setScale(1);
        onPress();
      });
    }
    return container;
  }
}
