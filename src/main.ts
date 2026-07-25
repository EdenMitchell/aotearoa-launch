import Phaser from "phaser";
import "./style.css";
import { PowerLaunchScene } from "./game/PowerLaunchScene";
import { PreloadScene } from "./game/PreloadScene";
import { ProfileScene } from "./game/ProfileScene";
import { CupSelectScene } from "./game/CupSelectScene";
import { ModeSelectScene } from "./game/ModeSelectScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#65d4ff",
  physics: {
    default: "matter",
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: false,
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 3,
  },
  scene: [PreloadScene, ProfileScene, ModeSelectScene, CupSelectScene, PowerLaunchScene],
  callbacks: {
    postBoot: (bootedGame) => {
      bootedGame.canvas.setAttribute("role", "application");
      bootedGame.canvas.setAttribute(
        "aria-label",
        "Aotearoa Launch arcade. Choose a 120-second adaptive Timed Mode or a Cup-based Journey, then load kilogram counterweights to launch a dog toward its bone.",
      );
    },
  },
});

window.addEventListener("beforeunload", () => game.destroy(true));
