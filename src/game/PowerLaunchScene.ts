import Phaser from "phaser";
import { POWER_LAUNCH_DIFFICULTY } from "../config/difficulty";
import { POWER_LAUNCH_TIMED } from "../config/timedMode";
import type { ArenaTheme, GameplayMode } from "../domain/campaignTypes";
import { CampaignSession, type CampaignSnapshot } from "../domain/session";
import { TimedSession, type TimedSnapshot } from "../domain/timedSession";
import type { GeneratedChallenge, PowerTile, TargetOption } from "../domain/types";
import {
  LAUNCH_TUNING,
  targetSensorCenterY,
  targetZoneWidth,
} from "./launchModel";
import { registerShotContact } from "./shotContacts";
import { rangePreviewCenter } from "./rangePreview";
import {
  ARENA_BACKDROP_TEXTURES,
  BONE_TARGET_TEXTURE,
  COUNTERWEIGHT_RACK_TEXTURE,
  DOG_BONE_SUCCESS_TEXTURE,
  DOG_PROJECTILE_TEXTURE,
} from "./assets";
import { launcherTextures, weightTexture } from "./visualAssets";
import { arcadeConfig, gameAudio, profileStore } from "./runtime";
import {
  counterweightLoadRatio,
  distanceForCounterweightKg,
  targetXForCounterweightKg,
  velocityForCounterweightKg,
} from "./counterweightModel";
import {
  basketIsReadyToAutoRelease,
  createWeightLoadState,
  dropWeight,
  resetWeights,
  toggleWeight,
  type WeightLoadState,
} from "./weightLoadState";

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const TILE_Y = 650;
const POWER_REVEAL_DELAY_MS = 800;
const TREBUCHET_PIVOT_X = LAUNCH_TUNING.launcherX;
const TREBUCHET_PIVOT_Y = LAUNCH_TUNING.groundY - 95;
const LONG_ARM_LENGTH = 96;
const SHORT_ARM_LENGTH = 52;
const COCKED_ANGLE = 22;
const MAX_LOAD_CREAK_ANGLE = 8;
const RELEASE_ANGLE = -35;

const COLORS = {
  ink: 0x21184f,
  inkSoft: 0x35256f,
  purple: 0x7759f7,
  purpleLight: 0xa897ff,
  yellow: 0xffd84c,
  coral: 0xff6b6b,
  green: 0x31d99a,
  white: 0xffffff,
} as const;

type RoundState = "preview" | "aiming" | "revealing" | "flying" | "result" | "complete";
type ResultAction = "retry" | "cups" | "replay" | undefined;

interface GameplayStartData {
  readonly mode: GameplayMode;
  readonly cupId?: string;
}

interface WeightView {
  readonly weight: PowerTile;
  readonly container: Phaser.GameObjects.Container;
  readonly glow: Phaser.GameObjects.Rectangle;
  readonly sprite: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly rackX: number;
  readonly rackY: number;
  dragged: boolean;
  dragStartX: number;
  dragStartY: number;
}

interface ButtonView {
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  readonly activeColor: number;
  readonly hoverColor: number;
  enabled: boolean;
}

interface TargetView {
  readonly option: TargetOption;
  readonly x: number;
  readonly body: MatterJS.BodyType;
  readonly container: Phaser.GameObjects.Container;
}

/**
 * Renders operation-owned challenges and owns only arcade presentation and
 * physics. Number ranges remain in the swappable difficulty config.
 */
export class PowerLaunchScene extends Phaser.Scene {
  private mode: GameplayMode = "cup";
  private cupId?: string;
  private session!: CampaignSession;
  private timedSession?: TimedSession;
  private snapshot!: CampaignSnapshot | TimedSnapshot;
  private challenge!: GeneratedChallenge;
  private theme: ArenaTheme = arcadeConfig.cups[0].theme;
  private profileId = "";
  private roundState: RoundState = "aiming";
  private weightLoadState: WeightLoadState = createWeightLoadState();
  private weightViews: WeightView[] = [];

  private projectile!: Phaser.Physics.Matter.Image;
  private projectileFocusHalo!: Phaser.GameObjects.Arc;
  private hatGraphics!: Phaser.GameObjects.Graphics;
  private launcherGlow!: Phaser.GameObjects.Arc;
  private trebuchetFrame!: Phaser.GameObjects.Container;
  private trebuchetBeam!: Phaser.GameObjects.Container;
  private trebuchetBasket!: Phaser.GameObjects.Container;
  private mechanismGraphics!: Phaser.GameObjects.Graphics;
  private slingGraphics!: Phaser.GameObjects.Graphics;
  private trebuchetAngle = COCKED_ANGLE;
  private trebuchetLoadRatio = 0;
  private trebuchetTween?: Phaser.Tweens.Tween;
  private groundBody?: MatterJS.BodyType;
  private targetViews: TargetView[] = [];
  private groundVisual?: Phaser.GameObjects.Rectangle;
  private groundEdgeVisual?: Phaser.GameObjects.Rectangle;
  private successCharacter?: Phaser.GameObjects.Image;
  private landingMarker?: Phaser.GameObjects.Container;
  private worldWidth = VIEW_WIDTH;
  private loadedKg = 0;
  private targetContact = false;
  private hitTargetId?: string;
  private groundContactStarted = false;
  private shotFinished = false;

  private levelText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private attemptText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private meterGraphics!: Phaser.GameObjects.Graphics;
  private overviewGraphics!: Phaser.GameObjects.Graphics;
  private progressGraphics!: Phaser.GameObjects.Graphics;
  private fireButton!: ButtonView;
  private clearButton!: ButtonView;

  private resultCard!: Phaser.GameObjects.Container;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultDetail!: Phaser.GameObjects.Text;
  private primaryResultButton!: ButtonView;
  private secondaryResultButton!: ButtonView;
  private primaryAction: ResultAction;
  private secondaryAction: ResultAction;

  private trailGraphics!: Phaser.GameObjects.Graphics;
  private blitzOverlay!: Phaser.GameObjects.Rectangle;
  private trailPoints: Phaser.Math.Vector2[] = [];
  private trailFrame = 0;
  private timedStarted = false;
  private timedTransitionPending = false;
  private timedResultShown = false;
  private autoReleasePending = false;
  private lastDisplayedSecond = -1;

  constructor() {
    super({ key: "power-launch" });
  }

  init(data: GameplayStartData): void {
    this.timedStarted = false;
    this.timedTransitionPending = false;
    this.timedResultShown = false;
    this.autoReleasePending = false;
    this.lastDisplayedSecond = -1;
    this.timedSession = undefined;
    this.mode = data.mode ?? "cup";
    this.cupId = data.cupId;
    const profile = profileStore.activeProfile();
    if (!profile) {
      return;
    }
    this.profileId = profile.id;
    if (this.mode === "timed") {
      this.theme = POWER_LAUNCH_TIMED.theme;
      this.timedSession = new TimedSession(
        POWER_LAUNCH_DIFFICULTY,
        arcadeConfig.scoreRules,
        POWER_LAUNCH_TIMED,
      );
      this.snapshot = this.timedSession.snapshot(this.nowMs());
      return;
    }
    const cup = arcadeConfig.cups.find((candidate) => candidate.id === this.cupId);
    this.theme = cup?.theme ?? arcadeConfig.cups[arcadeConfig.cups.length - 1].theme;
    const resume =
      profile.activeRun?.mode === this.mode && profile.activeRun.cupId === this.cupId
        ? profile.activeRun
        : undefined;
    this.session = new CampaignSession(POWER_LAUNCH_DIFFICULTY, arcadeConfig, {
      mode: this.mode,
      cupId: this.cupId,
      resume,
    });
    this.snapshot = this.session.snapshot();
  }

  create(): void {
    if (!this.profileId) {
      this.scene.start("profiles");
      return;
    }
    this.createBackdrop();
    this.createLauncher();
    this.createHud();
    this.createProjectile();
    this.setupCurrentChallenge();

    this.input.keyboard?.on("keydown-SPACE", () => this.fire());
    this.input.keyboard?.on("keydown-ESC", () => this.unloadAllWeights());
  }

  update(): void {
    this.syncProjectileFocus();
    this.syncHatToProjectile();
    if (this.mode === "timed" && this.timedStarted && !this.timedResultShown) {
      this.snapshot = this.timedSession!.tick(this.nowMs());
      this.refreshTimedClock();
      if (this.snapshot.isComplete && !this.timedTransitionPending) {
        this.finishTimedRun();
      }
    }
    if (this.roundState !== "flying") {
      return;
    }

    this.trailFrame += 1;
    if (this.trailFrame % 2 === 0) {
      this.trailPoints.push(new Phaser.Math.Vector2(this.projectile.x, this.projectile.y));
      if (this.trailPoints.length > (this.snapshot.boneBlitz ? 46 : 32)) {
        this.trailPoints.shift();
      }
      this.drawTrail();
    }

    if (
      this.projectile.y > VIEW_HEIGHT + 140 ||
      this.projectile.x > this.worldWidth + 180 ||
      this.projectile.x < -180
    ) {
      this.finishShot();
    }
  }

  private get reducedMotion(): boolean {
    return profileStore.snapshot().settings.reducedMotion;
  }

  private nowMs(): number {
    return performance.now();
  }

  private createBackdrop(): void {
    this.cameras.main.setBackgroundColor(this.theme.sky);
    this.add
      .image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, ARENA_BACKDROP_TEXTURES[this.theme.backdropId])
      .setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT)
      .setScrollFactor(0)
      .setDepth(-50);
    this.add
      .rectangle(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        VIEW_WIDTH,
        VIEW_HEIGHT,
        0x191633,
        this.theme.backdropDimAlpha,
      )
      .setScrollFactor(0)
      .setDepth(-49);
    this.blitzOverlay = this.add
      .rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x55f4e0, 0)
      .setScrollFactor(0)
      .setDepth(-43);
    this.trailGraphics = this.add.graphics().setDepth(7);
  }

  private createLauncher(): void {
    const textures = launcherTextures(profileStore.activeProfile()?.equippedCosmetics.launcher);
    this.add
      .ellipse(LAUNCH_TUNING.launcherX, LAUNCH_TUNING.groundY - 57, 238, 164, 0xfff7d7, 0.11)
      .setStrokeStyle(3, this.theme.accent, 0.22)
      .setDepth(3);
    this.trebuchetFrame = this.add.container(LAUNCH_TUNING.launcherX, LAUNCH_TUNING.groundY).setDepth(5);
    const baseShadow = this.add.ellipse(0, -1, 184, 24, COLORS.ink, 0.28);
    const frame = this.add.image(0, 0, textures.frame).setOrigin(0.5, 1).setDisplaySize(190, 122);
    this.trebuchetFrame.add([baseShadow, frame]);

    this.launcherGlow = this.add.circle(TREBUCHET_PIVOT_X, TREBUCHET_PIVOT_Y, 46, this.theme.accent, 0).setDepth(6);
    const beamLength = LONG_ARM_LENGTH + SHORT_ARM_LENGTH;
    const beam = this.add
      .image(0, 0, textures.beam)
      .setOrigin(SHORT_ARM_LENGTH / beamLength, 0.5)
      .setDisplaySize(beamLength, 31);
    const slingHook = this.add.circle(LONG_ARM_LENGTH, 0, 7, this.theme.accent).setStrokeStyle(3, COLORS.ink);
    const weightHook = this.add.circle(-SHORT_ARM_LENGTH, 0, 6, this.theme.accent).setStrokeStyle(3, COLORS.ink);
    this.trebuchetBeam = this.add
      .container(TREBUCHET_PIVOT_X, TREBUCHET_PIVOT_Y, [beam, slingHook, weightHook])
      .setDepth(8);
    this.add.circle(TREBUCHET_PIVOT_X, TREBUCHET_PIVOT_Y, 13, this.theme.accent)
      .setStrokeStyle(5, COLORS.ink)
      .setDepth(9);

    const basketShadow = this.add.ellipse(4, 28, 96, 20, COLORS.ink, 0.26);
    const basket = this.add.image(0, 0, textures.basket).setDisplaySize(108, 80);
    const basketLabel = this.add
      .text(0, 10, "DROP KG", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0.72);
    this.trebuchetBasket = this.add
      .container(TREBUCHET_PIVOT_X - SHORT_ARM_LENGTH, TREBUCHET_PIVOT_Y + 42, [
        basketShadow,
        basket,
        basketLabel,
      ])
      .setDepth(8);
    this.mechanismGraphics = this.add.graphics().setDepth(7);
    this.slingGraphics = this.add.graphics().setDepth(10);
  }

  private createHud(): void {
    this.add.rectangle(VIEW_WIDTH / 2, 650, VIEW_WIDTH, 140, 0x18113f, 0.97)
      .setScrollFactor(0)
      .setDepth(100);
    this.add.rectangle(VIEW_WIDTH / 2, 582, VIEW_WIDTH, 4, this.theme.accent, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
    // Keep the arena itself dominant. The old full-width dashboard repeated
    // the target and pulled attention away from the trebuchet, weights and
    // bone, so only small contextual chips remain.
    this.levelText = this.hudText(16, 14, "CUP", 13, "#ffffff")
      .setBackgroundColor("rgba(33,24,79,0.88)")
      .setPadding(10, 7, 10, 7);
    this.scoreText = this.hudText(16, 50, "SCORE", 14, "#ffd84c")
      .setBackgroundColor("rgba(33,24,79,0.88)")
      .setPadding(10, 7, 10, 7);
    this.streakText = this.hudText(16, 86, "STREAK", 13, "#77f4c4").setVisible(false);
    this.attemptText = this.hudText(16, 112, "ATTEMPT", 12, "#d8d1ff").setVisible(false);
    this.powerText = this.hudText(300, 18, "RANGE CARD", 19, "#ffffff").setVisible(false);
    this.targetText = this.add
      .text(1090, 14, "TIME\n2:00", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#21184f",
        align: "center",
        lineSpacing: 0,
        backgroundColor: "#65d4ff",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(105)
      .setVisible(this.mode === "timed");
    this.createButton(
      1216,
      31,
      96,
      32,
      this.mode === "timed" ? "MODES" : "CUPS",
      COLORS.inkSoft,
      0x4a3890,
      () => this.goToCups(),
    );

    this.statusText = this.add
      .text(VIEW_WIDTH / 2, 31, "Load counterweights into the basket", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        color: "#21184f",
        backgroundColor: "rgba(255,255,255,0.9)",
        padding: { x: 16, y: 7 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(110);
    this.meterGraphics = this.add.graphics().setScrollFactor(0).setDepth(105);
    this.overviewGraphics = this.add.graphics().setScrollFactor(0).setDepth(105);
    this.progressGraphics = this.add.graphics().setScrollFactor(0).setDepth(106);

    this.add
      .image(560, 660, COUNTERWEIGHT_RACK_TEXTURE)
      .setDisplaySize(720, 144)
      .setScrollFactor(0)
      .setDepth(111);
    this.add
      .text(560, 596, "COUNTERWEIGHT RACK", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#35214f",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(112);

    this.fireButton = this.createButton(
      1126,
      634,
      210,
      64,
      this.mode === "timed"
        ? `AUTO: ${POWER_LAUNCH_TIMED.solutionWeightCount} WEIGHTS`
        : "RELEASE!",
      COLORS.coral,
      0xff8585,
      () => this.fire(),
    );
    this.clearButton = this.createButton(1126, 691, 150, 32, "UNLOAD ALL", COLORS.inkSoft, 0x4a3890, () =>
      this.unloadAllWeights(),
    );
    this.createResultCard();
  }

  private hudText(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: `${size}px`,
        fontStyle: "bold",
        color,
      })
      .setScrollFactor(0)
      .setDepth(105);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    activeColor: number,
    hoverColor: number,
    onPress: () => void,
  ): ButtonView {
    const background = this.add
      .rectangle(0, 0, width, height, activeColor)
      .setStrokeStyle(3, COLORS.white, 0.28);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: height > 40 ? "20px" : "12px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);
    const container = this.add
      .container(x, y, [background, text])
      .setSize(width, height)
      .setScrollFactor(0)
      .setDepth(120)
      .setInteractive({ useHandCursor: true });
    const button: ButtonView = { container, background, label: text, activeColor, hoverColor, enabled: true };
    container.on("pointerover", () => {
      if (button.enabled) background.setFillStyle(hoverColor);
    });
    container.on("pointerout", () => background.setFillStyle(button.enabled ? activeColor : COLORS.inkSoft));
    container.on("pointerdown", () => {
      if (button.enabled && !this.reducedMotion) container.setScale(0.96);
    });
    container.on("pointerup", () => {
      container.setScale(1);
      if (button.enabled) onPress();
    });
    return button;
  }

  private createResultCard(): void {
    const shadow = this.add.rectangle(8, 10, 540, 236, COLORS.ink, 0.28);
    const background = this.add.rectangle(0, 0, 540, 236, COLORS.white, 0.98).setStrokeStyle(6, this.theme.accent);
    this.resultTitle = this.add
      .text(0, -64, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#21184f",
        align: "center",
      })
      .setOrigin(0.5);
    this.resultDetail = this.add
      .text(0, -15, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        color: "#4b4179",
        align: "center",
        wordWrap: { width: 460 },
      })
      .setOrigin(0.5);
    this.resultCard = this.add
      .container(VIEW_WIDTH / 2, 350, [shadow, background, this.resultTitle, this.resultDetail])
      .setScrollFactor(0)
      .setDepth(900)
      .setVisible(false);
    this.primaryResultButton = this.createButton(640, 424, 210, 52, "TRY AGAIN", COLORS.purple, 0x9077ff, () =>
      this.runResultAction(this.primaryAction),
    );
    this.secondaryResultButton = this.createButton(750, 424, 190, 52, "REPLAY", COLORS.inkSoft, 0x4a3890, () =>
      this.runResultAction(this.secondaryAction),
    );
    this.primaryResultButton.container.setDepth(910).setVisible(false);
    this.secondaryResultButton.container.setDepth(910).setVisible(false);
  }

  private createProjectile(): void {
    const dogScale = LAUNCH_TUNING.projectileRadius / 55;
    this.projectileFocusHalo = this.add
      .circle(LAUNCH_TUNING.launchX, LAUNCH_TUNING.launchY, 31, 0xffffff, 0.15)
      .setStrokeStyle(3, this.theme.accent, 0.42)
      .setDepth(11);
    this.projectile = this.matter.add
      .image(LAUNCH_TUNING.launchX, LAUNCH_TUNING.launchY, DOG_PROJECTILE_TEXTURE)
      .setCircle(55)
      .setScale(dogScale)
      .setOrigin(0.5)
      .setDepth(12)
      .setStatic(true)
      .setFrictionAir(0)
      .setBounce(0.06);
    this.projectile.setFixedRotation();
    this.hatGraphics = this.add.graphics().setDepth(13);
    this.drawEquippedHat();
  }

  private setupCurrentChallenge(): void {
    this.snapshot = this.mode === "timed"
      ? this.timedSession!.snapshot(this.nowMs())
      : this.session.snapshot();
    this.challenge = this.snapshot.challenge;
    this.autoReleasePending = false;
    this.weightLoadState = resetWeights();
    this.loadedKg = this.challenge.evaluate([]);
    const maximumLoadedKg = this.challenge.evaluate(this.challenge.tiles.map((weight) => weight.id));
    const maximumTargetKg = Math.max(...this.challenge.targets.map((target) => target.targetForce));
    const furthestX =
      LAUNCH_TUNING.launchX + distanceForCounterweightKg(Math.max(maximumLoadedKg, maximumTargetKg));
    this.worldWidth = Math.max(VIEW_WIDTH, furthestX + LAUNCH_TUNING.worldPadding);

    this.destroyRoundWorld();
    this.createRoundWorld();
    this.createWeights();
    this.resetProjectile();
    this.hideResultCard();
    this.cameras.main.stopFollow();
    this.cameras.main.panEffect.reset();
    this.cameras.main.setBounds(0, 0, this.worldWidth, VIEW_HEIGHT);
    this.cameras.main.setScroll(0, 0);
    const previewCenterX = rangePreviewCenter(
      this.targetViews.map((target) => target.x),
      VIEW_WIDTH,
      this.worldWidth,
    );
    this.roundState = previewCenterX === undefined ? "aiming" : "preview";
    if (this.mode !== "timed") {
      profileStore.saveRun(this.profileId, this.session.progress());
    } else if (previewCenterX === undefined) {
      this.startTimedDecisionWindow();
    }
    this.refreshHud();

    if (previewCenterX !== undefined) {
      this.playTargetRangePreview(previewCenterX);
    } else {
      this.showRoundTypeIntro();
    }
  }

  private startTimedDecisionWindow(): void {
    const now = this.nowMs();
    this.snapshot = this.timedStarted
      ? this.timedSession!.markChallengeReady(now)
      : this.timedSession!.start(now);
    this.timedStarted = true;
  }

  private showRoundTypeIntro(): void {
    if (this.snapshot.mode !== "timed" && this.snapshot.roundType === "golden") {
      this.createRoundAnnouncement("GOLDEN BONE!", "DOUBLE SCORE");
    } else if (this.snapshot.mode !== "timed" && this.snapshot.roundType === "finale") {
      this.createRoundAnnouncement("MEGA BONE FINALE!", "DOUBLE SCORE");
      gameAudio.finale();
    }
  }

  private playTargetRangePreview(cameraCenterX: number): void {
    const targetLabel = this.targetViews.length > 1 ? "Here are the bone targets" : "Here’s the bone target";
    this.statusText.setText(`${targetLabel} — watch how far the camera travels back!`);
    this.setButtonEnabled(this.fireButton, false);
    this.setButtonEnabled(this.clearButton, false);
    this.cameras.main.centerOn(cameraCenterX, VIEW_HEIGHT / 2);

    if (!this.reducedMotion) {
      this.targetViews.forEach((target) => {
        this.tweens.add({
          targets: target.container,
          scale: 1.07,
          duration: 280,
          yoyo: true,
          repeat: 1,
          ease: "Sine.InOut",
        });
      });
    }

    const holdMs = this.reducedMotion ? 420 : 750;
    this.time.delayedCall(holdMs, () => {
      if (this.roundState !== "preview") return;
      if (this.reducedMotion) {
        this.cameras.main.setScroll(0, 0);
        this.completeTargetRangePreview();
        return;
      }
      this.statusText.setText("Now back to the trebuchet — that’s the distance to judge!");
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () =>
        this.completeTargetRangePreview(),
      );
      this.cameras.main.pan(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        1050,
        Phaser.Math.Easing.Sine.InOut,
        true,
      );
    });
  }

  private completeTargetRangePreview(): void {
    if (this.roundState !== "preview") return;
    this.cameras.main.setScroll(0, 0);
    if (this.mode === "timed") {
      this.snapshot = this.timedSession!.tick(this.nowMs());
      if (this.snapshot.isComplete || this.timedResultShown) {
        this.finishTimedRun();
        return;
      }
    }
    this.roundState = "aiming";
    if (this.mode === "timed") this.startTimedDecisionWindow();
    this.refreshHud();
    this.showRoundTypeIntro();
  }

  private destroyRoundWorld(): void {
    this.weightViews.forEach((view) => view.container.destroy());
    this.weightViews = [];
    this.landingMarker?.destroy();
    this.landingMarker = undefined;
    this.successCharacter?.destroy();
    this.successCharacter = undefined;
    this.targetViews.forEach((target) => {
      target.container.destroy();
      this.matter.world.remove(target.body);
    });
    this.targetViews = [];
    this.groundVisual?.destroy();
    this.groundVisual = undefined;
    this.groundEdgeVisual?.destroy();
    this.groundEdgeVisual = undefined;
    if (this.groundBody) {
      this.matter.world.remove(this.groundBody);
      this.groundBody = undefined;
    }
    this.trailPoints = [];
    this.trailGraphics.clear();
  }

  private createRoundWorld(): void {
    this.groundVisual = this.add
      .rectangle(this.worldWidth / 2, LAUNCH_TUNING.groundY + 100, this.worldWidth, 200, this.theme.ground, 0.12)
      .setOrigin(0.5)
      .setDepth(1);
    this.groundEdgeVisual = this.add
      .rectangle(this.worldWidth / 2, LAUNCH_TUNING.groundY + 7, this.worldWidth, 14, this.theme.groundDark, 0.42)
      .setDepth(2);
    this.groundBody = this.matter.add.rectangle(
      this.worldWidth / 2,
      LAUNCH_TUNING.groundY + 100,
      this.worldWidth,
      200,
      { isStatic: true, label: "ground", friction: 0.9 },
    );

    this.targetViews = this.challenge.targets.map((option) => this.createTarget(option));
    this.targetViews.forEach((target) => {
      this.projectile.setOnCollideWith(target.body, () => {
        if (this.roundState !== "flying" || this.shotFinished) return;
        const contacts = registerShotContact(
          { groundContactStarted: this.groundContactStarted, targetContact: this.targetContact },
          "target",
        );
        this.groundContactStarted = contacts.groundContactStarted;
        this.targetContact = contacts.targetContact;
        this.hitTargetId ??= target.option.id;
      });
    });
    this.projectile.setOnCollideWith(this.groundBody, () => {
      if (this.roundState !== "flying") return;
      const hadGroundContact = this.groundContactStarted;
      const contacts = registerShotContact(
        { groundContactStarted: this.groundContactStarted, targetContact: this.targetContact },
        "ground",
      );
      this.groundContactStarted = contacts.groundContactStarted;
      this.targetContact = contacts.targetContact;
      // Wait until the end of this collision batch so an exact landing counts
      // regardless of Matter's pair order. Do not wait another physics frame:
      // an undershoot must not be able to roll into the sensor afterward.
      if (!hadGroundContact) this.time.delayedCall(0, () => this.finishShot());
    });
  }

  private createTarget(option: TargetOption): TargetView {
    const x = targetXForCounterweightKg(option.targetForce);
    const body = this.matter.add.rectangle(
      x,
      targetSensorCenterY(),
      targetZoneWidth(),
      LAUNCH_TUNING.targetSensorHeight,
      {
        isStatic: true,
        isSensor: true,
        label: `target-zone:${option.id}`,
      },
    );
    const isSpecial = option.kind !== "standard";
    const padColor = option.kind === "golden" ? 0xffbd2e : option.kind === "finale" ? 0xff7a4d : COLORS.yellow;
    const visiblePadWidth = Math.max(22, targetZoneWidth());
    const focusHalo = this.add
      .ellipse(0, option.kind === "finale" ? -59 : -45, isSpecial ? 136 : 104, isSpecial ? 154 : 122, 0xffffff, 0.13)
      .setStrokeStyle(isSpecial ? 4 : 3, padColor, 0.28);
    const padGlow = this.add.rectangle(0, -4, visiblePadWidth + (isSpecial ? 18 : 12), 18, padColor, 0.3);
    const pad = this.add.rectangle(0, -5, visiblePadWidth, 14, padColor).setStrokeStyle(3, COLORS.ink);
    const bone = this.add
      .image(
        0,
        option.kind === "finale" ? -72 : option.kind === "golden" ? -60 : -53,
        BONE_TARGET_TEXTURE,
      )
      .setDisplaySize(
        option.kind === "finale" ? 72 : option.kind === "golden" ? 60 : 52,
        option.kind === "finale" ? 126 : option.kind === "golden" ? 106 : 92,
      )
      .setAngle(0);
    if (option.kind === "golden" || profileStore.activeProfile()?.equippedCosmetics.target === "target-golden") {
      bone.setTint(0xffd64c);
    }
    const prefix = option.kind === "golden" ? "GOLD ×2" : option.kind === "finale" ? "MEGA ×2" : "RANGE";
    const targetLabel = this.add
      .text(
        0,
        option.kind === "finale" ? -154 : option.kind === "golden" ? -137 : -116,
        `${prefix}  ${option.targetForce} KG`,
        {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: option.kind === "finale" ? "18px" : "15px",
          fontStyle: "bold",
          color: "#21184f",
          backgroundColor: option.kind === "golden" ? "#fff0a8" : "#ffffff",
          padding: { x: 10, y: 5 },
        },
      )
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [focusHalo, padGlow, pad, bone, targetLabel];
    if (isSpecial) {
      children.push(this.add.circle(-55, -73, 5, COLORS.white, 0.8));
      children.push(this.add.circle(55, -55, 4, COLORS.white, 0.8));
    }
    const container = this.add.container(x, LAUNCH_TUNING.groundY, children).setDepth(4);
    return { option, x, body, container };
  }

  private createWeights(): void {
    const count = this.challenge.tiles.length;
    const handValues = this.challenge.tiles.map((weight) => weight.value);
    const spacing = count === 6 ? 98 : 108;
    const startX = 555 - ((count - 1) * spacing) / 2;
    this.weightViews = this.challenge.tiles.map((weight, index) => {
      const x = startX + index * spacing;
      const shadow = this.add.ellipse(4, 31, 76, 18, COLORS.ink, 0.55);
      const glow = this.add.rectangle(0, 5, 88, 76, this.theme.accent, 0).setStrokeStyle(0, this.theme.accent, 0);
      const sprite = this.add.image(0, 0, weightTexture(weight.value, handValues)).setDisplaySize(90, 90);
      const label = this.add
        .text(0, 9, `${weight.value}\nKG`, {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: weight.value >= 10 ? "23px" : "26px",
          fontStyle: "bold",
          color: "#ffffff",
          align: "center",
          lineSpacing: -5,
        })
        .setOrigin(0.5);
      const container = this.add
        .container(x, TILE_Y, [shadow, glow, sprite, label])
        .setSize(94, 104)
        .setScrollFactor(0)
        .setDepth(130)
        .setInteractive({ useHandCursor: true });
      const view: WeightView = {
        weight,
        container,
        glow,
        sprite,
        label,
        rackX: x,
        rackY: TILE_Y,
        dragged: false,
        dragStartX: x,
        dragStartY: TILE_Y,
      };
      this.input.setDraggable(container);
      container.on("pointerdown", () => {
        if (this.roundState !== "aiming") return;
        view.dragged = false;
        view.dragStartX = container.x;
        view.dragStartY = container.y;
        container.setDepth(240);
      });
      container.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (this.roundState !== "aiming") return;
        if (Phaser.Math.Distance.Between(view.dragStartX, view.dragStartY, dragX, dragY) > 6) {
          view.dragged = true;
        }
        container.setPosition(dragX, dragY).setScale(0.72).setAngle(0);
      });
      container.on("dragend", () => {
        if (this.roundState !== "aiming" || !view.dragged) return;
        this.handleWeightDrop(weight.id, this.isInsideBasketDropZone(container.x, container.y));
        // Keep the matching pointerup from also toggling the weight, then
        // restore tap input on the next input tick.
        this.time.delayedCall(0, () => {
          view.dragged = false;
        });
      });
      container.on("pointerup", () => {
        if (this.roundState !== "aiming" || view.dragged) return;
        this.toggleWeightById(weight.id);
      });
      return view;
    });
  }

  private availableWeightIds(): readonly string[] {
    return this.challenge.tiles.map((weight) => weight.id);
  }

  private handleWeightDrop(weightId: string, droppedInBasket: boolean): void {
    if (this.roundState !== "aiming") return;
    const previous = this.weightLoadState;
    this.weightLoadState = dropWeight(
      previous,
      weightId,
      droppedInBasket,
      this.availableWeightIds(),
      this.basketCapacity(),
    );
    if (previous !== this.weightLoadState) gameAudio.weight();
    this.refreshCounterweightDisplay();
    this.paintWeights();
    this.maybeAutoReleaseTimed();
  }

  private toggleWeightById(weightId: string): void {
    if (this.roundState !== "aiming") return;
    this.weightLoadState = toggleWeight(
      this.weightLoadState,
      weightId,
      this.availableWeightIds(),
      this.basketCapacity(),
    );
    gameAudio.weight();
    this.refreshCounterweightDisplay();
    this.paintWeights();
    this.maybeAutoReleaseTimed();
  }

  private basketCapacity(): number {
    return this.mode === "timed"
      ? POWER_LAUNCH_TIMED.solutionWeightCount
      : this.challenge.tiles.length;
  }

  private maybeAutoReleaseTimed(): void {
    if (
      this.mode !== "timed" ||
      this.roundState !== "aiming" ||
      this.autoReleasePending ||
      !basketIsReadyToAutoRelease(
        this.weightLoadState,
        POWER_LAUNCH_TIMED.solutionWeightCount,
      )
    ) {
      return;
    }
    this.autoReleasePending = true;
    this.statusText.setText("Two weights loaded — releasing automatically!");
    this.time.delayedCall(POWER_LAUNCH_TIMED.autoReleaseDelayMs, () => {
      if (this.roundState !== "aiming") return;
      if (
        !basketIsReadyToAutoRelease(
          this.weightLoadState,
          POWER_LAUNCH_TIMED.solutionWeightCount,
        )
      ) {
        this.autoReleasePending = false;
        return;
      }
      this.fire(true);
    });
  }

  private unloadAllWeights(tumble = false): void {
    if (this.roundState !== "aiming" && !tumble) return;
    const previouslyLoaded = new Set(this.weightLoadState.loadedIds);
    this.weightLoadState = resetWeights();
    this.weightViews.forEach((view) => this.paintWeight(view, tumble && previouslyLoaded.has(view.weight.id)));
    this.refreshCounterweightDisplay();
  }

  private paintWeights(): void {
    this.weightViews.forEach((view) => this.paintWeight(view));
  }

  private paintWeight(view: WeightView, tumble = false): void {
    const loadedIndex = this.weightLoadState.loadedIds.indexOf(view.weight.id);
    const loaded = loadedIndex >= 0;
    const target = loaded ? this.loadedWeightSlot(loadedIndex) : { x: view.rackX, y: view.rackY };
    view.glow.setFillStyle(this.theme.accent, loaded ? 0.28 : 0);
    view.glow.setStrokeStyle(loaded ? 4 : 0, this.theme.accent, loaded ? 0.9 : 0);
    view.sprite.clearTint();
    view.label.setColor("#ffffff");
    view.container.setDepth(loaded ? 12 : 130);
    const targetScale = loaded ? 0.43 : 1;
    if (this.reducedMotion) {
      view.container.setPosition(target.x, target.y).setScale(targetScale).setAngle(0);
      return;
    }
    this.tweens.add({
      targets: view.container,
      x: target.x,
      y: target.y,
      scale: targetScale,
      angle: tumble ? Phaser.Math.Between(-22, 22) : 0,
      duration: tumble ? 420 : 190,
      ease: tumble ? "Bounce.Out" : "Back.Out",
    });
  }

  private isInsideBasketDropZone(x: number, y: number): boolean {
    return Math.abs(x - this.trebuchetBasket.x) <= 90 && Math.abs(y - this.trebuchetBasket.y) <= 90;
  }

  private loadedWeightSlot(index: number): { x: number; y: number } {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
      x: this.trebuchetBasket.x - 27 + column * 27,
      y: this.trebuchetBasket.y - 10 + row * 25,
    };
  }

  private refreshHud(): void {
    if (this.snapshot.mode === "timed") {
      this.levelText.setText(`LAUNCH ${this.snapshot.roundNumber}`);
      this.scoreText.setText(
        this.snapshot.firstTryStreak > 0
          ? `SCORE ${this.snapshot.score}  •  STREAK ${this.snapshot.firstTryStreak}`
          : `SCORE ${this.snapshot.score}`,
      );
      this.attemptText.setVisible(false);
      this.streakText.setVisible(false);
      this.blitzOverlay.setAlpha(this.snapshot.boneBlitz ? 0.13 : 0);
      this.progressGraphics.clear();
      this.refreshTimedClock();
      this.refreshCounterweightDisplay();
      return;
    }
    const cupLabel = this.mode === "cup" ? this.snapshot.cup?.name ?? "CUP" : "ENDLESS BLAST";
    const roundLabel = this.snapshot.roundCount
      ? `ROUND ${this.snapshot.roundNumber}/${this.snapshot.roundCount}`
      : `ROUND ${this.snapshot.roundNumber}`;
    this.levelText.setText(`${cupLabel}  •  ${roundLabel}`);
    this.scoreText.setText(
      this.snapshot.firstTryStreak > 0
        ? `SCORE ${this.snapshot.score}  •  STREAK ${this.snapshot.firstTryStreak}`
        : `SCORE ${this.snapshot.score}`,
    );
    this.attemptText.setVisible(false);
    this.streakText.setVisible(false);
    this.blitzOverlay.setAlpha(this.snapshot.boneBlitz ? 0.13 : 0);
    this.targetText.setVisible(false);
    this.refreshCounterweightDisplay();
    this.drawCupProgress();
  }

  private refreshTimedClock(): void {
    if (this.snapshot.mode !== "timed") return;
    const totalSeconds = Math.ceil(this.snapshot.remainingMs / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    this.targetText.setText(`TIME\n${minutes}:${seconds}`);
    if (this.snapshot.remainingMs <= POWER_LAUNCH_TIMED.urgentThresholdMs) {
      this.targetText.setBackgroundColor("#ff6b6b").setColor("#ffffff");
    } else if (this.snapshot.remainingMs <= POWER_LAUNCH_TIMED.warningThresholdMs) {
      this.targetText.setBackgroundColor("#ffbd4a").setColor("#21184f");
    } else {
      this.targetText.setBackgroundColor("#65d4ff").setColor("#21184f");
    }
    if (
      totalSeconds > 0 &&
      this.snapshot.remainingMs <= POWER_LAUNCH_TIMED.urgentThresholdMs &&
      totalSeconds !== this.lastDisplayedSecond &&
      !this.reducedMotion
    ) {
      this.tweens.add({ targets: this.targetText, scale: 1.08, duration: 120, yoyo: true });
    }
    this.lastDisplayedSecond = totalSeconds;
  }

  private refreshCounterweightDisplay(): void {
    if (this.roundState === "aiming") {
      this.loadedKg = this.challenge.evaluate(this.weightLoadState.loadedIds);
      this.updateTrebuchetLoad();
    }
    const targets = this.challenge.targets.map((target) => target.targetForce);
    this.powerText.setVisible(false);
    this.meterGraphics.clear();
    this.overviewGraphics.clear();
    const hasWeights = this.weightLoadState.loadedIds.length > 0;
    this.setButtonEnabled(
      this.fireButton,
      this.mode !== "timed" && this.roundState === "aiming" && hasWeights,
    );
    this.setButtonEnabled(this.clearButton, this.roundState === "aiming" && hasWeights);
    if (this.roundState === "aiming") {
      const instruction =
        this.mode === "timed"
          ? hasWeights
            ? `TARGET ${targets[0]} KG — choose one more weight`
            : `TARGET ${targets[0]} KG — choose ${POWER_LAUNCH_TIMED.solutionWeightCount} weights to auto-launch`
          : targets.length === 1
            ? `TARGET: ${targets[0]}KG`
            : `TARGET: ${targets.map((target) => `${target}KG`).join(" OR ")}`;
      this.statusText
        .setBackgroundColor("rgba(255,216,76,0.96)")
        .setFontSize(this.mode === "timed" ? 17 : 23)
        .setText(instruction);
    }
  }

  private updateTrebuchetLoad(animate = true): void {
    const availableKg = this.challenge.evaluate(this.challenge.tiles.map((weight) => weight.id));
    const targetRatio = counterweightLoadRatio(this.loadedKg, availableKg);
    this.trebuchetTween?.stop();
    if (!animate || this.reducedMotion) {
      this.applyTrebuchetPose(targetRatio);
      return;
    }
    this.trebuchetTween = this.tweens.addCounter({
      from: this.trebuchetLoadRatio,
      to: targetRatio,
      duration: 180,
      ease: "Sine.easeOut",
      onUpdate: (tween) => this.applyTrebuchetPose(tween.getValue() ?? targetRatio),
    });
  }

  private applyTrebuchetPose(loadRatio: number, forcedAngle?: number): void {
    this.trebuchetLoadRatio = Phaser.Math.Clamp(loadRatio, 0, 1);
    this.trebuchetAngle = forcedAngle ?? COCKED_ANGLE + MAX_LOAD_CREAK_ANGLE * this.trebuchetLoadRatio;
    this.trebuchetFrame.setScale(1 + this.trebuchetLoadRatio * 0.004, 1 - this.trebuchetLoadRatio * 0.006);
    this.drawTrebuchetMechanism(forcedAngle !== undefined);
  }

  private drawTrebuchetMechanism(releasing = false): void {
    const radians = Phaser.Math.DegToRad(this.trebuchetAngle);
    const longX = TREBUCHET_PIVOT_X + Math.cos(radians) * LONG_ARM_LENGTH;
    const longY = TREBUCHET_PIVOT_Y + Math.sin(radians) * LONG_ARM_LENGTH;
    const shortX = TREBUCHET_PIVOT_X - Math.cos(radians) * SHORT_ARM_LENGTH;
    const shortY = TREBUCHET_PIVOT_Y - Math.sin(radians) * SHORT_ARM_LENGTH;
    const basketSag = releasing ? 18 : this.trebuchetLoadRatio * 18;
    this.trebuchetBeam.setAngle(this.trebuchetAngle);
    this.trebuchetBasket.setPosition(shortX, shortY + 40 + basketSag).setAngle(0);
    this.mechanismGraphics.clear();
    this.mechanismGraphics.lineStyle(this.snapshot?.boneBlitz ? 5 : 4, COLORS.ink, 1);
    this.mechanismGraphics.lineBetween(shortX - 15, shortY, this.trebuchetBasket.x - 34, this.trebuchetBasket.y - 28);
    this.mechanismGraphics.lineBetween(shortX + 15, shortY, this.trebuchetBasket.x + 34, this.trebuchetBasket.y - 28);
    this.slingGraphics.clear();
    this.slingGraphics.lineStyle(3, COLORS.ink, 0.9);
    this.slingGraphics.lineBetween(longX, longY, longX - 17, longY + 20);
    this.slingGraphics.lineBetween(longX, longY, longX + 17, longY + 20);
    this.slingGraphics.lineStyle(5, this.theme.accent, 0.9);
    this.slingGraphics.lineBetween(longX - 17, longY + 20, longX + 17, longY + 20);
    this.launcherGlow
      .setAlpha(this.trebuchetLoadRatio * (this.snapshot?.boneBlitz ? 0.48 : 0.18))
      .setScale(0.85 + this.trebuchetLoadRatio * 0.5);
    if (this.roundState === "preview" || this.roundState === "aiming" || this.roundState === "revealing") {
      this.projectile.setPosition(longX, longY);
      this.syncHatToProjectile();
    }
    this.weightLoadState.loadedIds.forEach((weightId, index) => {
      const view = this.weightViews.find((candidate) => candidate.weight.id === weightId);
      if (view && !view.dragged) {
        const slot = this.loadedWeightSlot(index);
        view.container.setPosition(slot.x, slot.y);
      }
    });
  }

  private drawOverview(lastLandingX?: number): void {
    void lastLandingX;
    this.overviewGraphics.clear();
  }

  private drawCupProgress(): void {
    this.progressGraphics.clear();
  }

  private setButtonEnabled(button: ButtonView, enabled: boolean): void {
    button.enabled = enabled;
    button.container.setAlpha(enabled ? 1 : 0.42);
    button.background.setFillStyle(enabled ? button.activeColor : COLORS.inkSoft);
    if (button.container.input) button.container.input.cursor = enabled ? "pointer" : "default";
  }

  private fire(automaticTimed = false): void {
    if (this.mode === "timed" && !automaticTimed) return;
    if (this.roundState !== "aiming" || this.weightLoadState.loadedIds.length === 0) return;
    this.autoReleasePending = false;
    if (this.mode === "timed" && this.timedSession!.commitAttempt(this.nowMs()) === undefined) {
      this.snapshot = this.timedSession!.tick(this.nowMs());
      this.finishTimedRun();
      return;
    }
    this.loadedKg = this.challenge.evaluate(this.weightLoadState.loadedIds);
    this.roundState = "revealing";
    this.targetContact = false;
    this.hitTargetId = undefined;
    this.groundContactStarted = false;
    this.shotFinished = false;
    this.trailFrame = 0;
    this.trailPoints = [];
    this.trailGraphics.clear();
    this.statusText.setText(`The scale reads ${this.loadedKg} KG — releasing the latch!`);
    this.setButtonEnabled(this.fireButton, false);
    this.setButtonEnabled(this.clearButton, false);
    this.refreshCounterweightDisplay();
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.powerText, scale: 1.08, duration: 170, yoyo: true, ease: "Back.Out" });
    }
    const revealDelay = this.mode === "timed"
      ? POWER_LAUNCH_TIMED.autoReleaseRevealMs
      : this.reducedMotion
        ? 250
        : POWER_REVEAL_DELAY_MS;
    this.time.delayedCall(revealDelay, () => this.beginPhysicalLaunch());
  }

  private beginPhysicalLaunch(): void {
    if (this.roundState !== "revealing") return;
    this.trebuchetTween?.stop();
    gameAudio.launch();
    if (this.reducedMotion) {
      const startingAngle = this.trebuchetAngle;
      this.trebuchetTween = this.tweens.addCounter({
        from: startingAngle,
        to: RELEASE_ANGLE,
        duration: 90,
        ease: "Linear",
        onUpdate: (tween) =>
          this.applyTrebuchetPose(this.trebuchetLoadRatio, tween.getValue() ?? RELEASE_ANGLE),
        onComplete: () => this.releaseProjectile(),
      });
      return;
    }
    const startingAngle = this.trebuchetAngle;
    this.trebuchetTween = this.tweens.addCounter({
      from: startingAngle,
      to: RELEASE_ANGLE,
      duration: 350,
      ease: "Sine.easeIn",
      onUpdate: (tween) =>
        this.applyTrebuchetPose(this.trebuchetLoadRatio, tween.getValue() ?? RELEASE_ANGLE),
      onComplete: () => this.releaseProjectile(),
    });
    this.cameras.main.shake(130, 0.0035);
  }

  private releaseProjectile(): void {
    if (this.roundState !== "revealing") return;
    this.roundState = "flying";
    this.weightViews.forEach((view) => view.container.setVisible(false));
    this.slingGraphics.clear();
    const velocity = velocityForCounterweightKg(this.loadedKg);
    this.projectile
      .setPosition(LAUNCH_TUNING.launchX, LAUNCH_TUNING.launchY)
      .setStatic(false)
      .setIgnoreGravity(false)
      .setFrictionAir(0)
      .setVelocity(velocity.x, velocity.y)
      .setAngularVelocity(0.08);
    this.cameras.main.startFollow(this.projectile, true, 0.075, 0.06, -230, 0);
  }

  private finishShot(): void {
    if (this.roundState !== "flying" || this.shotFinished) return;
    this.shotFinished = true;
    this.roundState = "result";
    const landingX = Phaser.Math.Clamp(this.projectile.x, 0, this.worldWidth);
    this.projectile.setVelocity(0, 0).setAngularVelocity(0).setStatic(true);
    this.cameras.main.stopFollow();
    if (!this.reducedMotion) {
      this.cameras.main.pan(
        landingX,
        VIEW_HEIGHT / 2,
        430,
        Phaser.Math.Easing.Sine.Out,
      );
    }
    this.createLandingPuff(landingX, this.projectile.y);
    this.createLandingMarker(landingX, this.targetContact);
    this.drawOverview(landingX);
    gameAudio.impact();
    if (this.targetContact && this.hitTargetId) this.handleSuccess(this.hitTargetId);
    else this.handleMiss(landingX);
  }

  private handleMiss(landingX: number): void {
    if (this.mode === "timed") {
      this.snapshot = this.timedSession!.resolveAttempt(undefined, this.nowMs());
      const nearestTarget = [...this.targetViews].sort(
        (left, right) => Math.abs(left.x - landingX) - Math.abs(right.x - landingX),
      )[0];
      const under = landingX < nearestTarget.x;
      this.statusText.setText(
        under ? "A little short — the next launch is ready soon" : "A little far — the next launch is ready soon",
      );
      this.refreshHud();
      this.timedTransitionPending = true;
      this.time.delayedCall(POWER_LAUNCH_TIMED.missFeedbackMs, () => this.continueTimedAfterFeedback());
      return;
    }
    this.snapshot = this.session.recordMiss();
    profileStore.saveRun(this.profileId, this.session.progress());
    const nearestTarget = [...this.targetViews].sort(
      (left, right) => Math.abs(left.x - landingX) - Math.abs(right.x - landingX),
    )[0];
    const under = landingX < nearestTarget.x;
    this.statusText.setText(under ? "The launch landed before the nearest bone" : "The launch sailed past the nearest bone");
    this.showResultCard(
      under ? "A little short!" : "Too much zoom!",
      "Use the landing marker, adjust your counterweights, and try the same challenge again.",
      "TRY AGAIN",
      "retry",
    );
    this.refreshHud();
  }

  private handleSuccess(targetId: string): void {
    const successfulTarget = this.targetViews.find((target) => target.option.id === targetId);
    if (!successfulTarget) return;
    if (this.mode === "timed") {
      this.handleTimedSuccess(successfulTarget);
      return;
    }
    const previousScore = this.snapshot.score;
    this.snapshot = this.session.completeRound(targetId);
    const completion = this.snapshot.lastRound;
    if (!completion) return;
    const isFinale = completion.target.kind === "finale";
    const blitzActivated = completion.streak === 3;
    this.createSuccessBurst(successfulTarget.x, LAUNCH_TUNING.groundY - 42, isFinale);
    this.createDogBoneSuccess(successfulTarget.x, isFinale);
    this.createSuccessLabel(successfulTarget.x, completion.scoreAwarded, blitzActivated);
    this.animateScore(previousScore, this.snapshot.score);
    if (!this.reducedMotion) this.cameras.main.shake(isFinale ? 300 : 180, isFinale ? 0.009 : 0.005);
    if (blitzActivated) gameAudio.blitz();
    else if (isFinale) gameAudio.finale();
    else gameAudio.success();

    if (this.snapshot.isComplete && completion.medal && this.snapshot.cup) {
      const medal = completion.medal;
      this.roundState = "complete";
      const saved = profileStore.completeCup(
        this.profileId,
        this.snapshot.cup.id,
        medal,
        this.snapshot.score,
        this.snapshot.totalMisses,
        arcadeConfig,
      );
      const unlockNames = saved.newUnlockIds.flatMap((id) => {
        const name = arcadeConfig.cosmeticUnlocks.find((unlock) => unlock.id === id)?.name;
        return name ? [name] : [];
      });
      const rewardLine = unlockNames.length > 0
        ? `NEW GEAR: ${unlockNames.join(", ")}`
        : saved.starsAdded > 0
          ? `+${saved.starsAdded} mastery star${saved.starsAdded === 1 ? "" : "s"}`
          : "New personal best saved!";
      this.statusText.setText(`${medal.toUpperCase()} CUP! GOOD DOG!`);
      if (unlockNames.length > 0) gameAudio.unlock();
      this.time.delayedCall(this.reducedMotion ? 400 : 1200, () => {
        this.showResultCard(
          `${medal.toUpperCase()} CUP!`,
          `Score ${this.snapshot.score}  •  Misses ${this.snapshot.totalMisses}\n${rewardLine}`,
          "CUP SELECT",
          "cups",
          "REPLAY CUP",
          "replay",
        );
      });
      return;
    }

    profileStore.saveRun(this.profileId, this.session.progress());
    const streakLine = blitzActivated ? " BONE BLITZ!" : completion.firstAttempt ? ` Streak ×${completion.streak}!` : "";
    this.statusText.setText(`+${completion.scoreAwarded} points!${streakLine}`);
    this.time.delayedCall(this.reducedMotion ? 700 : isFinale ? 2200 : 1750, () => this.setupCurrentChallenge());
  }

  private handleTimedSuccess(successfulTarget: TargetView): void {
    const previousScore = this.snapshot.score;
    this.snapshot = this.timedSession!.resolveAttempt(successfulTarget.option.id, this.nowMs());
    const completion = this.snapshot.lastRound;
    if (!completion) return;
    const blitzActivated = completion.streak === 3;
    this.createSuccessBurst(successfulTarget.x, LAUNCH_TUNING.groundY - 42, false);
    this.createDogBoneSuccess(successfulTarget.x, false);
    this.createSuccessLabel(successfulTarget.x, completion.scoreAwarded, blitzActivated);
    this.animateScore(previousScore, this.snapshot.score);
    if (!this.reducedMotion) this.cameras.main.shake(150, 0.0045);
    if (blitzActivated) gameAudio.blitz();
    else gameAudio.success();
    const streakLine = blitzActivated ? " BONE BLITZ!" : ` Streak ×${completion.streak}!`;
    this.statusText.setText(`+${completion.scoreAwarded} points!${streakLine}`);
    this.refreshHud();
    this.timedTransitionPending = true;
    this.time.delayedCall(POWER_LAUNCH_TIMED.hitFeedbackMs, () => this.continueTimedAfterFeedback());
  }

  private continueTimedAfterFeedback(): void {
    if (this.mode !== "timed" || this.timedResultShown) return;
    this.timedTransitionPending = false;
    this.snapshot = this.timedSession!.tick(this.nowMs());
    if (this.snapshot.isComplete) {
      this.finishTimedRun();
      return;
    }
    this.setupCurrentChallenge();
  }

  private finishTimedRun(): void {
    if (this.mode !== "timed" || this.timedResultShown) return;
    this.timedResultShown = true;
    this.timedTransitionPending = false;
    this.snapshot = this.timedSession!.tick(this.nowMs());
    this.roundState = "complete";
    this.setButtonEnabled(this.fireButton, false);
    this.setButtonEnabled(this.clearButton, false);
    this.refreshTimedClock();
    const previousBest = profileStore.activeProfile()?.timedBestScore ?? 0;
    const saved = profileStore.recordTimedBest(this.profileId, this.snapshot.score);
    const bestLine = this.snapshot.score > previousBest
      ? `NEW PERSONAL BEST  ${saved.timedBestScore}!`
      : `Personal best  ${saved.timedBestScore}`;
    this.statusText.setText("TIME! Great launching!");
    this.showResultCard(
      "TIME!",
      `Score ${this.snapshot.score}  •  Hits ${this.snapshot.hits}\n${bestLine}`,
      "PLAY AGAIN",
      "replay",
      "MODES",
      "cups",
    );
  }

  private retryCurrentChallenge(): void {
    this.hideResultCard();
    this.roundState = "aiming";
    this.weightViews.forEach((view) => view.container.setVisible(true));
    this.unloadAllWeights(true);
    this.resetProjectile();
    this.cameras.main.stopFollow();
    if (!this.reducedMotion) {
      this.cameras.main.pan(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        450,
        Phaser.Math.Easing.Sine.Out,
      );
    }
    this.statusText.setText("Use the last landing marker to adjust your counterweights");
    this.refreshHud();
  }

  private goToCups(): void {
    if (this.mode === "timed") {
      profileStore.recordTimedBest(this.profileId, this.snapshot.score);
      this.scene.start("modes");
      return;
    }
    if (this.mode === "endless") {
      profileStore.recordEndlessBest(this.profileId, this.snapshot.score);
    } else if (!this.snapshot.isComplete) {
      profileStore.saveRun(this.profileId, this.session.progress());
    }
    this.scene.start("cups");
  }

  private replayCup(): void {
    if (this.mode !== "timed") profileStore.clearRun(this.profileId);
    this.scene.restart({ mode: this.mode, cupId: this.cupId } satisfies GameplayStartData);
  }

  private resetProjectile(): void {
    this.targetContact = false;
    this.hitTargetId = undefined;
    this.groundContactStarted = false;
    this.shotFinished = false;
    this.projectile
      .setStatic(true)
      .setPosition(LAUNCH_TUNING.launchX, LAUNCH_TUNING.launchY)
      .setRotation(0)
      .setVelocity(0, 0)
      .setAngularVelocity(0)
      .setVisible(true);
    this.weightViews.forEach((view) => view.container.setVisible(true));
    this.hatGraphics.setVisible(Boolean(profileStore.activeProfile()?.equippedCosmetics.hat));
    this.trebuchetTween?.stop();
    this.updateTrebuchetLoad(false);
    this.trailPoints = [];
    this.trailGraphics.clear();
  }

  private showResultCard(
    title: string,
    detail: string,
    primaryLabel: string,
    primaryAction: ResultAction,
    secondaryLabel = "",
    secondaryAction?: ResultAction,
  ): void {
    this.primaryAction = primaryAction;
    this.secondaryAction = secondaryAction;
    this.resultTitle.setText(title);
    this.resultDetail.setText(detail);
    this.resultCard.setVisible(true).setAlpha(1).setScale(1);
    if (!this.reducedMotion) {
      this.resultCard.setAlpha(0).setScale(0.88);
      this.tweens.add({ targets: this.resultCard, alpha: 1, scale: 1, duration: 220, ease: "Back.Out" });
    }
    const hasSecondary = Boolean(secondaryAction && secondaryLabel);
    this.primaryResultButton.label.setText(primaryLabel);
    this.primaryResultButton.container.setPosition(hasSecondary ? 525 : 640, 424).setVisible(Boolean(primaryAction));
    this.setButtonEnabled(this.primaryResultButton, Boolean(primaryAction));
    this.secondaryResultButton.label.setText(secondaryLabel);
    this.secondaryResultButton.container.setPosition(755, 424).setVisible(hasSecondary);
    this.setButtonEnabled(this.secondaryResultButton, hasSecondary);
  }

  private hideResultCard(): void {
    this.resultCard.setVisible(false);
    this.primaryResultButton.container.setVisible(false);
    this.secondaryResultButton.container.setVisible(false);
    this.primaryAction = undefined;
    this.secondaryAction = undefined;
  }

  private runResultAction(action: ResultAction): void {
    if (action === "retry") this.retryCurrentChallenge();
    else if (action === "cups") this.goToCups();
    else if (action === "replay") this.replayCup();
  }

  private createRoundAnnouncement(title: string, detail: string): void {
    const banner = this.add
      .text(VIEW_WIDTH / 2, 280, `${title}\n${detail}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#21184f",
        align: "center",
        backgroundColor: "#ffd84c",
        padding: { x: 28, y: 14 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(500);
    if (this.reducedMotion) {
      this.time.delayedCall(650, () => banner.destroy());
      return;
    }
    banner.setScale(0.3).setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: "Back.Out",
      yoyo: true,
      hold: 650,
      onComplete: () => banner.destroy(),
    });
  }

  private createLandingMarker(x: number, hit: boolean): void {
    this.landingMarker?.destroy();
    const color = hit ? COLORS.green : COLORS.coral;
    const stem = this.add.rectangle(0, -35, 4, 62, color);
    const diamond = this.add.rectangle(0, -68, 16, 16, color).setAngle(45).setStrokeStyle(3, COLORS.white);
    const label = this.add
      .text(0, -94, hit ? "LANDED!" : "LAST LANDING", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: hit ? "#178761" : "#d74e5c",
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5);
    this.landingMarker = this.add.container(x, LAUNCH_TUNING.groundY, [stem, diamond, label]).setDepth(10);
  }

  private createLandingPuff(x: number, y: number): void {
    const count = this.reducedMotion ? 3 : 8;
    for (let index = 0; index < count; index += 1) {
      const puff = this.add.circle(x, y + 8, Phaser.Math.Between(5, 11), COLORS.white, 0.72).setDepth(11);
      const angle = Phaser.Math.FloatBetween(Math.PI, Math.PI * 2);
      const distance = Phaser.Math.Between(32, 70);
      this.tweens.add({
        targets: puff,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.55,
        alpha: 0,
        scale: 1.5,
        duration: this.reducedMotion ? 180 : Phaser.Math.Between(420, 680),
        onComplete: () => puff.destroy(),
      });
    }
  }

  private createSuccessBurst(x: number, y: number, finale: boolean): void {
    const count = this.reducedMotion ? 8 : finale ? 58 : this.snapshot.boneBlitz ? 42 : 28;
    for (let index = 0; index < count; index += 1) {
      const color = Phaser.Utils.Array.GetRandom([COLORS.yellow, COLORS.coral, COLORS.green, COLORS.purple, COLORS.white, this.theme.accent]);
      const particle = this.add
        .rectangle(x, y, Phaser.Math.Between(5, 10), Phaser.Math.Between(9, 17), color)
        .setDepth(30)
        .setAngle(Phaser.Math.Between(0, 180));
      const angle = Phaser.Math.FloatBetween(Math.PI * 1.1, Math.PI * 1.9);
      const distance = Phaser.Math.Between(75, finale ? 300 : 210);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        angle: particle.angle + Phaser.Math.Between(120, 420),
        alpha: 0,
        duration: this.reducedMotion ? 350 : Phaser.Math.Between(700, finale ? 1450 : 1200),
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private createDogBoneSuccess(targetX: number, finale: boolean): void {
    this.projectile.setVisible(false);
    this.targetViews.forEach((target) => target.container.setVisible(false));
    this.landingMarker?.setVisible(false);
    this.successCharacter?.destroy();
    const finalScale = finale ? 0.72 : 0.54;
    this.successCharacter = this.add
      .image(targetX, LAUNCH_TUNING.groundY - (finale ? 82 : 67), DOG_BONE_SUCCESS_TEXTURE)
      .setDepth(25)
      .setAlpha(this.reducedMotion ? 1 : 0)
      .setScale(this.reducedMotion ? finalScale : finalScale * 0.18)
      .setAngle(this.reducedMotion ? 0 : -8);
    this.hatGraphics.setPosition(targetX, LAUNCH_TUNING.groundY - (finale ? 116 : 84)).setAngle(0).setScale(finale ? 1.7 : 1.35);
    if (this.reducedMotion) return;
    this.tweens.add({
      targets: this.successCharacter,
      alpha: 1,
      scale: finalScale,
      angle: 0,
      duration: finale ? 560 : 430,
      ease: "Back.Out",
      onComplete: () => {
        if (!this.successCharacter?.active) return;
        this.tweens.add({
          targets: this.successCharacter,
          y: this.successCharacter.y - 10,
          angle: 3,
          duration: 360,
          yoyo: true,
          repeat: finale ? 2 : 1,
          ease: "Sine.InOut",
        });
      },
    });
  }

  private createSuccessLabel(x: number, points: number, blitzActivated: boolean): void {
    const title = blitzActivated ? "BONE BLITZ!" : "GOOD DOG!";
    const label = this.add
      .text(x, LAUNCH_TUNING.groundY - 202, `${title}\n+${points} POINTS`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: blitzActivated ? "28px" : "23px",
        fontStyle: "bold",
        color: "#21184f",
        align: "center",
        backgroundColor: blitzActivated ? "#67f4db" : "#ffffff",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(35);
    if (this.reducedMotion) {
      this.time.delayedCall(650, () => label.destroy());
      return;
    }
    label.setAlpha(0).setScale(0.65);
    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1,
      y: label.y - 10,
      duration: 380,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          y: label.y - 22,
          delay: 720,
          duration: 350,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  private animateScore(from: number, to: number): void {
    if (this.reducedMotion) {
      this.scoreText.setText(`SCORE ${to}`);
      return;
    }
    this.tweens.addCounter({
      from,
      to,
      duration: 520,
      ease: "Cubic.Out",
      onUpdate: (tween) => this.scoreText.setText(`SCORE ${Math.round(tween.getValue() ?? to)}`),
    });
  }

  private drawEquippedHat(): void {
    const hat = profileStore.activeProfile()?.equippedCosmetics.hat;
    this.hatGraphics.clear().setVisible(Boolean(hat));
    if (hat === "hat-crown") {
      this.hatGraphics.fillStyle(0xffd23f, 1);
      this.hatGraphics.fillTriangle(-18, -23, -13, -43, -4, -24);
      this.hatGraphics.fillTriangle(-7, -24, 0, -48, 7, -24);
      this.hatGraphics.fillTriangle(4, -24, 14, -43, 19, -23);
      this.hatGraphics.fillRect(-18, -27, 37, 10);
      this.hatGraphics.lineStyle(2, COLORS.ink, 1).strokeRect(-18, -27, 37, 10);
    } else if (hat === "hat-propeller") {
      this.hatGraphics.fillStyle(0xff6b6b, 1).fillEllipse(0, -25, 42, 18);
      this.hatGraphics.fillStyle(0x65d4ff, 1).fillRect(-2, -44, 4, 18);
      this.hatGraphics.fillStyle(0xffd84c, 1).fillEllipse(-11, -46, 24, 7).fillEllipse(11, -46, 24, 7);
      this.hatGraphics.lineStyle(2, COLORS.ink, 1).strokeEllipse(0, -25, 42, 18);
    } else if (hat === "hat-space") {
      this.hatGraphics.fillStyle(0xdff8ff, 0.72).fillCircle(0, -23, 28);
      this.hatGraphics.lineStyle(4, 0x7f72e8, 1).strokeCircle(0, -23, 28);
      this.hatGraphics.fillStyle(0x65d4ff, 0.62).fillEllipse(7, -26, 31, 20);
    }
  }

  private syncHatToProjectile(): void {
    if (!this.hatGraphics?.visible || !this.projectile?.visible) return;
    this.hatGraphics.setPosition(this.projectile.x, this.projectile.y).setAngle(this.projectile.angle).setScale(1);
  }

  private syncProjectileFocus(): void {
    if (!this.projectileFocusHalo || !this.projectile) return;
    this.projectileFocusHalo
      .setVisible(this.projectile.visible)
      .setPosition(this.projectile.x, this.projectile.y);
  }

  private trailColors(): readonly number[] {
    const trail = profileStore.activeProfile()?.equippedCosmetics.trail;
    if (trail === "trail-leaves") return [0x4ed681, 0x98e66f, 0xffd84c];
    if (trail === "trail-rainbow") return [0xff6b6b, 0xffb93f, 0xffeb5c, 0x54d98b, 0x65d4ff, 0xa897ff];
    if (trail === "trail-stars") return [0xffd84c, 0xffffff, 0x87efff];
    return [COLORS.white];
  }

  private drawTrail(): void {
    this.trailGraphics.clear();
    const colors = this.trailColors();
    const trailId = profileStore.activeProfile()?.equippedCosmetics.trail;
    this.trailPoints.forEach((point, index) => {
      const progress = (index + 1) / this.trailPoints.length;
      const color = colors[index % colors.length];
      this.trailGraphics.fillStyle(color, progress * (this.snapshot.boneBlitz ? 0.78 : 0.46));
      const radius = 2 + progress * (this.snapshot.boneBlitz ? 7 : 5);
      if (trailId === "trail-leaves") this.trailGraphics.fillEllipse(point.x, point.y, radius * 1.8, radius);
      else if (trailId === "trail-stars") {
        this.trailGraphics.fillRect(point.x - radius * 0.35, point.y - radius, radius * 0.7, radius * 2);
        this.trailGraphics.fillRect(point.x - radius, point.y - radius * 0.35, radius * 2, radius * 0.7);
      }
      else this.trailGraphics.fillCircle(point.x, point.y, radius);
    });
  }
}
