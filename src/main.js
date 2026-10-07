import * as Phaser from "phaser";
import { StartScene } from "./scenes/StartScene.js";
import { GameScene } from "./scenes/GameScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 1280,
  height: 720,
  backgroundColor: "#07171c",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1800 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [StartScene, GameScene],
};

new Phaser.Game(config);
