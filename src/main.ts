import Phaser from "phaser";
import "./style.css";
import { PowerLaunchScene } from "./game/PowerLaunchScene";
import { PreloadScene } from "./game/PreloadScene";
import { ProfileScene } from "./game/ProfileScene";
import { CupSelectScene } from "./game/CupSelectScene";
import { ModeSelectScene } from "./game/ModeSelectScene";

/**
 * Mobile Safari's CSS layout viewport can remain taller than the actually
 * visible page while its address and tab bars are open. Drive the game shell
 * from VisualViewport so Phaser always fits inside the usable screen.
 */
const syncViewportCss = (): void => {
  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width ?? window.innerWidth);
  const height = Math.round(viewport?.height ?? window.innerHeight);
  document.documentElement.style.setProperty("--app-viewport-width", `${width}px`);
  document.documentElement.style.setProperty("--app-viewport-height", `${height}px`);
};

syncViewportCss();

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

let resizeFrame = 0;
const refreshViewport = (): void => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    syncViewportCss();
    game.scale.refresh();
  });
};

window.addEventListener("resize", refreshViewport);
window.addEventListener("orientationchange", refreshViewport);
window.addEventListener("pageshow", refreshViewport);
window.visualViewport?.addEventListener("resize", refreshViewport);
window.visualViewport?.addEventListener("scroll", refreshViewport);

window.addEventListener("beforeunload", () => {
  window.removeEventListener("resize", refreshViewport);
  window.removeEventListener("orientationchange", refreshViewport);
  window.removeEventListener("pageshow", refreshViewport);
  window.visualViewport?.removeEventListener("resize", refreshViewport);
  window.visualViewport?.removeEventListener("scroll", refreshViewport);
  game.destroy(true);
});
