import Phaser from "phaser";
import { MAX_LOCAL_PROFILES } from "../domain/profileStore";
import { DOG_PROJECTILE_TEXTURE, MENU_BACKDROP_TEXTURE } from "./assets";
import { gameAudio, profileStore } from "./runtime";

const AVATAR_COLORS = [0xffd84c, 0x65d4ff, 0xff8c8c, 0x8f79ff, 0x55d69c, 0xffad73];

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super({ key: "profiles" });
  }

  create(): void {
    if (profileStore.snapshot().profiles.length === 0) {
      profileStore.createProfile();
    }
    this.cameras.main.setBackgroundColor(0xc8e7ef);
    this.add.image(640, 360, MENU_BACKDROP_TEXTURE).setDisplaySize(1280, 720).setDepth(-20);
    this.add.rectangle(640, 360, 1280, 720, 0x17334b, 0.28).setDepth(-19);
    this.add
      .text(640, 47, "AOTEAROA LAUNCH", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "42px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#274b65",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#153047", 0.35);
    this.add
      .text(640, 98, "WHO'S LAUNCHING?", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "25px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#274b65",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(640, 130, "Choose your dog pilot", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#eefaff",
      })
      .setOrigin(0.5);

    const profiles = profileStore.snapshot().profiles;
    const cardWidth = 220;
    const spacing = 245;
    const startX = 640 - ((profiles.length - 1) * spacing) / 2;
    profiles.forEach((profile, index) => {
      const x = startX + index * spacing;
      const shadow = this.add.rectangle(8, 10, cardWidth, 270, 0x050312, 0.36);
      const background = this.add
        .rectangle(0, 0, cardWidth, 270, 0x2c225f)
        .setStrokeStyle(5, AVATAR_COLORS[profile.avatarIndex]);
      const badge = this.add.circle(0, -50, 70, AVATAR_COLORS[profile.avatarIndex], 1);
      const dog = this.add.image(0, -50, DOG_PROJECTILE_TEXTURE).setDisplaySize(112, 112);
      const name = this.add
        .text(0, 45, profile.name, {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "25px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      const play = this.add
        .text(0, 99, "PLAY", {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "20px",
          fontStyle: "bold",
          color: "#21184f",
          backgroundColor: "#ffd84c",
          padding: { x: 34, y: 10 },
        })
        .setOrigin(0.5);
      const container = this.add
        .container(x, 350, [shadow, background, badge, dog, name, play])
        .setSize(cardWidth, 270)
        .setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => container.setScale(0.97));
      container.on("pointerup", () => {
        container.setScale(1);
        gameAudio.tile();
        profileStore.selectProfile(profile.id);
        this.scene.start("modes");
      });

      const deleteButton = this.add
        .text(x + 92, 226, "×", {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "25px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#c84e64",
          padding: { x: 8, y: 2 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      deleteButton.on("pointerup", () => {
        if (window.confirm(`Remove ${profile.name} from this device?`)) {
          profileStore.deleteProfile(profile.id);
          this.scene.restart();
        }
      });
    });

    if (profiles.length < MAX_LOCAL_PROFILES) {
      const add = this.add
        .text(640, 558, "+  ADD PLAYER", {
          fontFamily: "Trebuchet MS, sans-serif",
          fontSize: "21px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#7759f7",
          padding: { x: 28, y: 14 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      add.on("pointerup", () => {
        const name = window.prompt("Player name (optional, 12 letters max):", "");
        if (name !== null) {
          profileStore.createProfile(name);
          gameAudio.unlock();
          this.scene.restart();
        }
      });
    }

    this.add
      .text(640, 665, "Progress stays only on this device", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "15px",
        color: "#eefaff",
        stroke: "#274b65",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
  }
}
