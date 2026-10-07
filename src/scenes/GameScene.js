import * as Phaser from "phaser";
import { Player } from "../actors/Player.js";
import { Enemy } from "../actors/Enemy.js";
import { KingSpiderBoss } from "../actors/KingSpiderBoss.js";
import { getLanguage, t } from "../i18n.js";
import { BASE_PULSE_SKILL } from "../combat/skillConfigs.js";
import {
  AREA_DEFINITIONS,
  EXPLORATION_PER_AREA,
  FINAL_GATE_REQUIREMENT,
  HIDDEN_ENTRANCE_AREA,
  ROOM_WIDTH,
  createRunState,
  getArea,
} from "../data/areas.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("background-forest-entrance", "assets/backgrounds/forest-entrance.webp");
    this.load.image("background-deep-woods", "assets/backgrounds/deep-woods.webp");
    this.load.image("background-webbed-grove", "assets/backgrounds/webbed-grove.webp");
    this.load.image("background-abandoned-caravan", "assets/backgrounds/abandoned-caravan.webp");
    this.load.image("background-king-spider-nest", "assets/backgrounds/king-spider-nest.webp");
  }

  create(data = {}) {
    this.language = getLanguage();
    this.tr = (key, values) => t(this.language, key, values);
    this.area = getArea(data.areaId ?? "forest-entrance");
    this.runState = data.resetRun ? createRunState() : data.runState ?? createRunState();
    this.playerSnapshot = data.resetRun ? null : data.playerStats ?? null;
    this.entrySide = data.entrySide ?? "left";
    this.transitioning = false;
    this.transitionReady = false;
    this.gameEnded = false;
    this.hiddenEntranceObjects = null;

    this.physics.world.setBounds(0, 0, ROOM_WIDTH, 720);
    this.drawEnvironment();
    this.createPlatforms();
    this.createRoomTitle();

    const spawnX = this.entrySide === "right" ? ROOM_WIDTH - 155 : 155;
    this.player = new Player(this, spawnX, 540);
    this.restorePlayerSnapshot();

    this.enemies = this.physics.add.group();
    this.spawnCurrentAreaEnemies();
    this.createTransitionCorridors();

    this.physics.add.collider(this.player, this.platforms);

    this.createControls();
    this.createHud();
    this.createGuidance();

    if (this.runState.hiddenEntranceUnlocked && this.area.id === HIDDEN_ENTRANCE_AREA) {
      this.revealHiddenEntrance(false);
    }

    this.cameras.main.setBounds(0, 0, ROOM_WIDTH, 720);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(180, 120);
    this.cameras.main.fadeIn(260, 4, 16, 19);

    this.statsHandler = (stats) => this.updateHud(stats);
    this.events.on("player-stats", this.statsHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off("player-stats", this.statsHandler);
      this.input.off("pointerdown", this.pointerHandler);
    });

    this.time.delayedCall(650, () => {
      this.transitionReady = true;
    });
    this.showToast(this.tr("enterArea", { area: this.areaName(this.area) }), this.area.accent, 1300);
  }

  drawEnvironment() {
    const palettes = {
      "forest-entrance": { sky: 0x0b252d, horizon: 0x31595c, far: 0x173a40, mid: 0x102b30, near: 0x0a2024, moss: 0x34534a, light: 0xe8a84f },
      "deep-woods": { sky: 0x081f27, horizon: 0x294c50, far: 0x13353a, mid: 0x0c272d, near: 0x071c21, moss: 0x27483f, light: 0xd59743 },
      "webbed-grove": { sky: 0x111f2c, horizon: 0x415466, far: 0x253644, mid: 0x172934, near: 0x0d1c25, moss: 0x3a4b50, light: 0xc9dce4 },
      "abandoned-caravan": { sky: 0x17272b, horizon: 0x596565, far: 0x354446, mid: 0x263638, near: 0x17282a, moss: 0x4c5548, light: 0xe0984e },
      "king-spider-nest": { sky: 0x1b111b, horizon: 0x5a3541, far: 0x3a202b, mid: 0x29151f, near: 0x180d14, moss: 0x4d3038, light: 0xd34f4a },
    };
    const palette = palettes[this.area.id];
    this.environmentPalette = palette;
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.IntegerToColor(palette.sky).rgba);

    const backdropKey = `background-${this.area.id}`;
    const hasBackdrop = this.textures.exists(backdropKey);
    this.hasGeneratedBackdrop = hasBackdrop;

    if (hasBackdrop) {
      // The painted plate carries the large ruins, lighting and distant forest. A little
      // overscan leaves room for subtle camera parallax without exposing its edges.
      this.add.image(640, 360, backdropKey)
        .setDisplaySize(1360, 765)
        .setScrollFactor(0.03);
      this.add.rectangle(640, 360, 1280, 720, palette.sky, 0.2).setScrollFactor(0);
      this.add.rectangle(640, 655, 1280, 150, palette.near, 0.42).setScrollFactor(0);
    } else {
      const sky = this.add.graphics().setScrollFactor(0);
      sky.fillStyle(palette.sky, 1); sky.fillRect(0, 0, 1280, 720);
      for (let band = 0; band < 7; band += 1) {
        sky.fillStyle(palette.horizon, 0.025 + band * 0.012);
        sky.fillRect(0, 190 + band * 58, 1280, 58);
      }
      this.drawBlockMoonAndRays(sky, palette);
    }
    this.drawBlockTreeLayer(0.12, palette.far, 490, 150, 250, hasBackdrop ? 0.12 : 0.72);
    if (!hasBackdrop) this.drawDistantRuins(palette);
    this.drawBlockTreeLayer(0.42, palette.mid, 565, this.area.id === "deep-woods" ? 104 : 132, 330, hasBackdrop ? 0.18 : 0.92);
    this.drawMistBands(palette);
    this.drawBlockTreeLayer(0.76, palette.near, 630, this.area.id === "deep-woods" ? 150 : 190, 410, hasBackdrop ? 0.28 : 0.82);

    if (this.area.id === "webbed-grove" || this.area.id === "king-spider-nest") this.drawWebs(hasBackdrop ? 0.12 : 0.34);
    if (!hasBackdrop && this.area.id === "abandoned-caravan") this.drawCaravan();
    if (!hasBackdrop && this.area.id === "forest-entrance") this.drawEntranceRuins();
    this.drawEnvironmentalStoryDetails(palette, hasBackdrop ? 0.34 : 0.86);
    this.drawGroundDetailLayer(palette);
    this.drawDriftingPixelFog(palette);
  }

  drawBlockMoonAndRays(sky, palette) {
    const moonX = this.area.id === "webbed-grove" ? 1030 : 990;
    const moonY = 112;
    sky.fillStyle(0xb9d5d5, 0.07);
    sky.fillRect(moonX - 86, moonY - 86, 172, 172);
    sky.fillStyle(0xd7e8e3, 0.22);
    const blocks = [
      [-24, -40, 48, 8], [-32, -32, 64, 16], [-40, -16, 80, 32],
      [-32, 16, 64, 16], [-24, 32, 48, 8],
    ];
    blocks.forEach(([x, y, width, height]) => sky.fillRect(moonX + x, moonY + y, width, height));
    sky.fillStyle(palette.horizon, 0.06);
    sky.fillRect(moonX - 130, moonY + 40, 54, 490);
    sky.fillRect(moonX - 38, moonY + 40, 82, 490);
    sky.fillRect(moonX + 92, moonY + 40, 42, 490);
  }

  drawBlockTreeLayer(scrollFactor, color, baseY, spacing, maxHeight, alpha) {
    const layer = this.add.graphics().setScrollFactor(scrollFactor).setAlpha(alpha);
    for (let x = -180; x < 2500; x += spacing) {
      const variation = Math.abs(((x + spacing) * 17) % 118);
      const height = maxHeight - variation * 0.55;
      const trunkWidth = Math.max(14, Math.round(spacing * 0.13 / 4) * 4);
      const center = x + Math.round(spacing * 0.5);
      layer.fillStyle(color, 1);
      layer.fillRect(center - trunkWidth / 2, baseY - height * 0.62, trunkWidth, height * 0.66);
      const tiers = 7;
      for (let tier = 0; tier < tiers; tier += 1) {
        const progress = tier / (tiers - 1);
        const tierY = baseY - height + progress * height * 0.72;
        const halfWidth = 14 + progress * spacing * 0.46;
        const block = Math.max(8, Math.round(halfWidth / 4) * 4);
        layer.fillRect(center - block, tierY, block * 2, 18 + progress * 8);
        layer.fillStyle(0x89aaa5, 0.055 + (tier % 2) * 0.025);
        layer.fillRect(center - block + 8, tierY + 3, Math.max(8, block * 0.62), 7);
        layer.fillStyle(color, 1);
        if (tier > 1) {
          layer.fillRect(center - block - 12, tierY + 12, 12, 12);
          layer.fillRect(center + block, tierY + 12, 12, 12);
        }
      }
      layer.fillStyle(0x020c0e, 0.2);
      layer.fillRect(center - trunkWidth / 2, baseY - height * 0.35, 4, height * 0.3);
    }
  }

  drawDistantRuins(palette) {
    const ruins = this.add.graphics().setScrollFactor(0.27).setAlpha(0.55);
    ruins.fillStyle(palette.mid, 1);
    for (let x = 90; x < 2300; x += 430) {
      const height = 120 + Math.abs((x * 7) % 95);
      ruins.fillRect(x, 520 - height, 38, height);
      ruins.fillRect(x + 12, 520 - height - 28, 14, 28);
      ruins.fillRect(x - 10, 520 - height, 58, 18);
      ruins.fillRect(x + 150, 440, 34, 80);
      ruins.fillRect(x + 24, 445, 150, 16);
      for (let block = 0; block < 5; block += 1) {
        ruins.fillRect(x + block * 38, 430 - (block % 2) * 8, 24, 15);
      }
    }
  }

  drawMistBands(palette) {
    const farMist = this.add.graphics().setScrollFactor(0.33).setAlpha(0.16);
    farMist.fillStyle(0xaac8c5, 1);
    for (let x = -80; x < 2400; x += 160) {
      const y = 420 + Math.abs((x * 3) % 65);
      farMist.fillRect(x, y, 132, 18);
      farMist.fillRect(x + 28, y - 12, 92, 12);
    }
    const nearMist = this.add.graphics().setScrollFactor(0.72).setAlpha(0.1);
    nearMist.fillStyle(palette.horizon, 1);
    for (let x = -160; x < 2400; x += 230) {
      const y = 545 + Math.abs((x * 5) % 34);
      nearMist.fillRect(x, y, 190, 22);
      nearMist.fillRect(x + 45, y - 14, 110, 14);
    }
  }

  drawEnvironmentalStoryDetails(palette, alpha = 0.86) {
    const details = this.add.graphics().setScrollFactor(0.82).setAlpha(alpha);
    const wood = this.area.id === "abandoned-caravan" ? 0x4b352b : 0x263333;
    const woodDark = 0x101b1c;

    // Broken fences and the remains of an old forest road.
    for (let start = 560; start < 2150; start += 510) {
      const baseY = 570 + Math.abs((start * 3) % 28);
      details.fillStyle(woodDark, 1);
      details.fillRect(start, baseY - 74, 13, 78);
      details.fillRect(start + 118, baseY - 58, 13, 62);
      details.fillStyle(wood, 1);
      details.fillRect(start + 7, baseY - 55, 124, 12);
      details.fillRect(start + 28, baseY - 31, 96, 9);
      details.fillStyle(0x52605a, 0.32);
      details.fillRect(start + 10, baseY - 52, 76, 3);
    }

    // Blocky hanging vines, with denser growth in the deep forest.
    const vineSpacing = this.area.id === "deep-woods" ? 150 : 260;
    details.fillStyle(palette.moss, 0.9);
    for (let x = 340; x < 2200; x += vineSpacing) {
      const length = 46 + Math.abs((x * 11) % 92);
      for (let y = 0; y < length; y += 14) {
        details.fillRect(x + (Math.floor(y / 14) % 2) * 6, 265 + y, 7, 12);
        if (y % 28 === 0) details.fillRect(x - 5, 271 + y, 12, 6);
      }
    }

    // A few snapped trunks create the ruined, storm-damaged silhouette from the concept art.
    for (let x = 760; x < 2100; x += 620) {
      details.fillStyle(0x172526, 1);
      details.fillRect(x, 408, 30, 210);
      details.fillRect(x + 22, 407, 22, 28);
      details.fillRect(x + 38, 397, 18, 20);
      details.fillStyle(0x43514b, 0.35);
      details.fillRect(x + 5, 420, 6, 176);
    }
  }

  drawGroundDetailLayer(palette) {
    const ground = this.add.graphics().setScrollFactor(1).setAlpha(0.95);
    const surfaceY = 626;

    // Uneven block-stone trail.
    for (let x = 40; x < ROOM_WIDTH; x += 52) {
      const width = 28 + Math.abs((x * 5) % 24);
      const y = surfaceY - 8 - Math.abs((x * 7) % 9);
      ground.fillStyle(x % 104 === 0 ? 0x344746 : 0x263a3b, 0.9);
      ground.fillRect(x, y, width, 8);
      ground.fillStyle(0x76908a, 0.13);
      ground.fillRect(x + 4, y, Math.max(8, width - 13), 2);
    }

    // Moss tufts and small cubic stones.
    for (let x = 95; x < ROOM_WIDTH; x += 137) {
      const offset = Math.abs((x * 13) % 19);
      ground.fillStyle(palette.moss, 0.82);
      ground.fillRect(x, surfaceY - 15 - offset * 0.15, 7, 15);
      ground.fillRect(x + 8, surfaceY - 10, 10, 10);
      ground.fillRect(x + 19, surfaceY - 18 + offset * 0.2, 6, 18);
      ground.fillStyle(0x182729, 1);
      ground.fillRect(x + 52, surfaceY - 9, 17, 9);
      ground.fillStyle(0x50605d, 0.55);
      ground.fillRect(x + 55, surfaceY - 12, 11, 5);
    }

    // Shallow puddles and stepped reflections, kept below the combat silhouettes.
    const puddleColor = this.area.id === "webbed-grove" ? 0x8aaeb8 : 0x527c7f;
    for (let x = 260; x < ROOM_WIDTH; x += 430) {
      ground.fillStyle(puddleColor, 0.24);
      ground.fillRect(x, surfaceY - 4, 126, 5);
      ground.fillRect(x + 22, surfaceY - 8, 78, 3);
      ground.fillStyle(0xb9d1cc, 0.18);
      ground.fillRect(x + 38, surfaceY - 6, 42, 2);
      if (this.area.id === "forest-entrance" || this.area.id === "abandoned-caravan") {
        ground.fillStyle(palette.light, 0.18);
        ground.fillRect(x + 61, surfaceY - 18, 7, 12);
        ground.fillRect(x + 56, surfaceY - 4, 18, 2);
      }
    }

    // Tiny mushrooms and abandoned supply blocks.
    for (let x = 420; x < ROOM_WIDTH; x += 590) {
      ground.fillStyle(0xc3a06a, 0.72); ground.fillRect(x, surfaceY - 17, 5, 15);
      ground.fillStyle(0x8a5d48, 0.9); ground.fillRect(x - 5, surfaceY - 21, 15, 6);
      ground.fillStyle(0x392d27, 0.95); ground.fillRect(x + 54, surfaceY - 24, 28, 24);
      ground.lineStyle(2, 0x72513a, 0.8); ground.strokeRect(x + 54, surfaceY - 24, 28, 24);
      ground.lineBetween(x + 68, surfaceY - 24, x + 68, surfaceY);
    }
  }

  drawDriftingPixelFog(palette) {
    for (let index = 0; index < 10; index += 1) {
      const width = 36 + (index % 4) * 22;
      const fog = this.add.rectangle(
        90 + index * 185,
        365 + (index % 5) * 43,
        width,
        7 + (index % 2) * 5,
        0xb4ceca,
        0.035 + (index % 3) * 0.018,
      ).setScrollFactor(0.55 + (index % 3) * 0.1);
      this.tweens.add({
        targets: fog,
        x: fog.x + 95 + (index % 3) * 28,
        alpha: { from: fog.alpha * 0.55, to: fog.alpha },
        duration: 6200 + index * 310,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
  }

  drawWebs(alpha = 0.34) {
    const webs = this.add.graphics().setAlpha(alpha);
    webs.lineStyle(2, 0xcadadd, 1);
    for (let x = 180; x < 1580; x += 270) {
      webs.lineBetween(x, 210, x + 190, 525);
      webs.lineBetween(x + 190, 210, x, 525);
      webs.strokeCircle(x + 95, 365, 68);
      webs.strokeCircle(x + 95, 365, 38);
    }
  }

  drawCaravan() {
    const caravan = this.add.graphics();
    caravan.fillStyle(0x4b3428, 1);
    caravan.fillRect(1120, 475, 260, 100);
    caravan.fillStyle(0x211a17, 1);
    caravan.fillCircle(1160, 590, 42);
    caravan.fillCircle(1340, 590, 42);
    caravan.lineStyle(6, 0x81583d, 1);
    caravan.strokeCircle(1160, 590, 42);
    caravan.strokeCircle(1340, 590, 42);
    caravan.lineBetween(1380, 515, 1520, 565);
  }

  drawEntranceRuins() {
    const ruins = this.add.graphics();
    const stone = 0x273b3b;
    const darkStone = 0x17292a;
    const moss = this.environmentPalette.moss;
    ruins.fillStyle(darkStone, 1);
    ruins.fillRect(190, 308, 72, 304);
    ruins.fillRect(430, 308, 72, 304);
    ruins.fillRect(190, 300, 312, 58);
    for (let y = 320; y < 600; y += 34) {
      ruins.fillStyle(stone, 1);
      ruins.fillRect(198 + ((y / 34) % 2) * 12, y, 52, 28);
      ruins.fillRect(438 - ((y / 34) % 2) * 8, y, 54, 28);
    }
    for (let x = 202; x < 490; x += 48) {
      ruins.fillStyle(stone, 1);
      ruins.fillRect(x, 308 + ((x / 48) % 2) * 9, 38, 38);
    }
    ruins.fillStyle(moss, 0.9);
    ruins.fillRect(190, 302, 96, 12);
    ruins.fillRect(432, 300, 70, 13);
    ruins.fillRect(214, 352, 14, 84);
    ruins.fillRect(456, 414, 12, 66);
    // Missing stones, cracks and loose overgrowth stop the gate from reading as a clean rectangle.
    ruins.fillStyle(0x091719, 1);
    ruins.fillRect(190, 300, 34, 22);
    ruins.fillRect(468, 300, 34, 31);
    ruins.fillRect(238, 352, 13, 17);
    ruins.fillRect(438, 476, 18, 20);
    ruins.lineStyle(4, 0x0b191a, 0.85);
    ruins.beginPath(); ruins.moveTo(228, 385); ruins.lineTo(240, 405); ruins.lineTo(230, 430); ruins.lineTo(244, 452); ruins.strokePath();
    ruins.beginPath(); ruins.moveTo(470, 350); ruins.lineTo(456, 375); ruins.lineTo(468, 397); ruins.strokePath();
    ruins.fillStyle(moss, 0.8);
    for (let x = 252; x < 432; x += 28) {
      ruins.fillRect(x, 302 + Math.abs((x * 3) % 8), 18, 7);
      if (x % 56 === 0) ruins.fillRect(x + 7, 309, 6, 28);
    }
    this.drawBlockLantern(286, 432);
    this.drawBlockLantern(408, 432);
  }

  drawBlockLantern(x, y) {
    const glow = this.add.rectangle(x, y, 92, 92, this.environmentPalette.light, 0.055);
    const lantern = this.add.graphics();
    lantern.fillStyle(0x151d1c, 1); lantern.fillRect(x - 12, y - 26, 24, 8);
    lantern.fillRect(x - 15, y - 18, 5, 35); lantern.fillRect(x + 10, y - 18, 5, 35);
    lantern.fillStyle(this.environmentPalette.light, 0.95); lantern.fillRect(x - 9, y - 15, 18, 28);
    lantern.fillStyle(0xffd58a, 0.9); lantern.fillRect(x - 5, y - 11, 10, 20);
    lantern.fillStyle(0x151d1c, 1); lantern.fillRect(x - 13, y + 15, 26, 7);
    this.tweens.add({ targets: glow, alpha: { from: 0.035, to: 0.1 }, duration: 850, yoyo: true, repeat: -1 });
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    const terrainProfiles = {
      "forest-entrance": [[0, 360, 630], [360, 700, 614], [700, 1040, 626], [1040, 1370, 608], [1370, 1700, 630]],
      "deep-woods": [[0, 300, 630], [300, 610, 604], [610, 900, 622], [900, 1190, 594], [1190, 1460, 612], [1460, 1700, 630]],
      "webbed-grove": [[0, 330, 630], [330, 650, 612], [650, 1000, 624], [1000, 1320, 600], [1320, 1700, 630]],
      "abandoned-caravan": [[0, 350, 630], [350, 700, 618], [700, 1060, 598], [1060, 1410, 616], [1410, 1700, 630]],
      "king-spider-nest": [[0, 260, 620], [260, 1440, 630], [1440, 1700, 620]],
    };
    this.terrainProfile = terrainProfiles[this.area.id];
    this.terrainMaterial = this.getTerrainMaterial();
    this.terrainProfile.forEach(([left, right, top]) => {
      const width = right - left;
      const height = 720 - top;
      this.addPlatform(left + width / 2, top + height / 2, width + 2, height);
    });
    this.drawMinecraftForegroundProps();
  }

  getTerrainTopAt(x) {
    const segment = this.terrainProfile?.find(([left, right]) => x >= left && x <= right);
    return segment?.[2] ?? 630;
  }

  addPlatform(x, y, width, height) {
    const platform = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.physics.add.existing(platform, true);
    this.platforms.add(platform);
    this.drawMinecraftTerrain(x - width / 2, y - height / 2, width, height);
    return platform;
  }

  getTerrainMaterial() {
    const materials = {
      "forest-entrance": {
        blocks: [0x263735, 0x2e403c, 0x344741, 0x20302f], top: 0x58705a, edge: 0x172523,
        fleck: 0x718276, foliage: 0x4c6b50, accent: 0xc69a53,
      },
      "deep-woods": {
        blocks: [0x1d302e, 0x263936, 0x29413b, 0x172827], top: 0x405f4b, edge: 0x101f1e,
        fleck: 0x60766b, foliage: 0x355c43, accent: 0xb88747,
      },
      "webbed-grove": {
        blocks: [0x29363d, 0x32424a, 0x233139, 0x1b2930], top: 0x607078, edge: 0x121e25,
        fleck: 0x91a5ad, foliage: 0x52656b, accent: 0xc9e1e6,
      },
      "abandoned-caravan": {
        blocks: [0x3a3d37, 0x44473e, 0x303630, 0x292f2b], top: 0x6d6b52, edge: 0x1c2421,
        fleck: 0x87836e, foliage: 0x596148, accent: 0xd18c49,
      },
      "king-spider-nest": {
        blocks: [0x241820, 0x311c25, 0x1d141a, 0x3a2028], top: 0x65404a, edge: 0x100b0f,
        fleck: 0x6e4850, foliage: 0x4b2632, accent: 0xd94943,
      },
    };
    return materials[this.area.id];
  }

  terrainHash(x, y, salt = 0) {
    const value = Math.imul(Math.floor(x) + salt * 37, 374761393)
      ^ Math.imul(Math.floor(y) + salt * 71, 668265263);
    return Math.abs(value ^ (value >>> 13));
  }

  drawMinecraftTerrain(left, top, width, height) {
    const blocks = this.add.graphics();
    const material = this.terrainMaterial;
    const blockSize = 32;

    for (let rowY = top; rowY < top + height; rowY += blockSize) {
      for (let columnX = left; columnX < left + width; columnX += blockSize) {
        const cellWidth = Math.min(blockSize, left + width - columnX);
        const cellHeight = Math.min(blockSize, top + height - rowY);
        const hash = this.terrainHash(columnX, rowY, this.area.id.length);
        const baseColor = material.blocks[hash % material.blocks.length];

        blocks.fillStyle(material.edge, 1);
        blocks.fillRect(columnX, rowY, cellWidth, cellHeight);
        blocks.fillStyle(baseColor, 1);
        blocks.fillRect(columnX + 2, rowY + 2, Math.max(1, cellWidth - 4), Math.max(1, cellHeight - 4));
        blocks.fillStyle(material.fleck, 0.18);
        blocks.fillRect(columnX + 5 + (hash % 9), rowY + 7 + ((hash >>> 3) % 8), 8 + (hash % 7), 4);
        if ((hash % 4) === 0 && cellHeight > 20) {
          blocks.fillStyle(material.edge, 0.55);
          blocks.fillRect(columnX + 18, rowY + 18, 3, 9);
          blocks.fillRect(columnX + 20, rowY + 24, 7, 3);
        }
        if (this.area.id === "king-spider-nest" && hash % 3 === 0) {
          blocks.fillStyle(material.accent, 0.72);
          blocks.fillRect(columnX + 8, rowY + 27, 11, 2);
          blocks.fillRect(columnX + 17, rowY + 22, 2, 7);
        }
      }
    }

    // A chunky top face and irregular overhang make the collision surface read as blocks,
    // rather than a dark rectangle placed in front of the environment plate.
    blocks.fillStyle(material.edge, 1); blocks.fillRect(left, top, width, 12);
    blocks.fillStyle(material.top, 1); blocks.fillRect(left, top, width, 7);
    blocks.fillStyle(material.fleck, 0.42); blocks.fillRect(left, top + 1, width, 2);
    for (let x = left + 8; x < left + width - 6; x += 24) {
      const hash = this.terrainHash(x, top, 9);
      blocks.fillStyle(hash % 3 === 0 ? material.foliage : material.top, 1);
      blocks.fillRect(x, top + 6, 7 + (hash % 8), 5 + (hash % 6));
      if (this.area.id === "webbed-grove" && hash % 2 === 0) {
        blocks.fillStyle(material.accent, 0.55); blocks.fillRect(x + 4, top - 2, 13, 2);
      }
    }
  }

  drawMinecraftForegroundProps() {
    const props = this.add.graphics();
    const material = this.terrainMaterial;

    this.terrainProfile.forEach(([left, right, top], segmentIndex) => {
      for (let x = left + 58; x < right - 40; x += 118) {
        const hash = this.terrainHash(x, top, segmentIndex + 14);
        if (hash % 3 === 0) {
          props.fillStyle(material.foliage, 1);
          props.fillRect(x, top - 15, 6, 15);
          props.fillRect(x + 7, top - 10, 8, 10);
          props.fillRect(x + 16, top - 20, 5, 20);
          props.fillStyle(material.fleck, 0.5); props.fillRect(x + 2, top - 17, 4, 4);
        } else if (hash % 3 === 1) {
          props.fillStyle(material.edge, 1); props.fillRect(x, top - 10, 22, 10);
          props.fillStyle(material.blocks[hash % material.blocks.length], 1); props.fillRect(x + 3, top - 13, 16, 9);
          props.fillStyle(material.fleck, 0.32); props.fillRect(x + 6, top - 11, 8, 2);
        }
      }
    });

    if (this.area.id === "deep-woods") {
      this.drawBlockRoot(props, 410, this.getTerrainTopAt(410));
      this.drawBlockRoot(props, 1260, this.getTerrainTopAt(1260));
    } else if (this.area.id === "webbed-grove") {
      this.drawSilkCocoon(props, 590, this.getTerrainTopAt(590));
      this.drawSilkCocoon(props, 1450, this.getTerrainTopAt(1450));
    } else if (this.area.id === "abandoned-caravan") {
      this.drawSupplyCrates(props, 810, this.getTerrainTopAt(810));
      this.drawBrokenWheel(props, 1320, this.getTerrainTopAt(1320));
    } else if (this.area.id === "king-spider-nest") {
      this.drawNestBrazier(props, 330, this.getTerrainTopAt(330));
      this.drawNestBrazier(props, 1370, this.getTerrainTopAt(1370));
    } else {
      this.drawRuinBlocks(props, 430, this.getTerrainTopAt(430));
      this.drawRuinBlocks(props, 1220, this.getTerrainTopAt(1220));
    }
  }

  drawBlockRoot(graphics, x, groundY) {
    graphics.fillStyle(0x172321, 1);
    graphics.fillRect(x, groundY - 54, 22, 54);
    graphics.fillRect(x + 18, groundY - 24, 48, 13);
    graphics.fillRect(x + 55, groundY - 13, 36, 13);
    graphics.fillStyle(0x34433b, 0.65); graphics.fillRect(x + 4, groundY - 50, 5, 38);
  }

  drawSilkCocoon(graphics, x, groundY) {
    graphics.fillStyle(0x1a272d, 1); graphics.fillRect(x - 4, groundY - 43, 34, 43);
    graphics.fillStyle(0xb9d1d6, 0.72);
    graphics.fillRect(x, groundY - 38, 26, 31);
    graphics.fillRect(x + 5, groundY - 43, 16, 41);
    graphics.fillStyle(0xe1edef, 0.5);
    for (let y = groundY - 35; y < groundY - 4; y += 8) graphics.fillRect(x - 3, y, 32, 3);
  }

  drawSupplyCrates(graphics, x, groundY) {
    [[0, 0, 35], [37, 0, 29], [18, -27, 28]].forEach(([offsetX, offsetY, size]) => {
      graphics.fillStyle(0x2a201b, 1); graphics.fillRect(x + offsetX, groundY - size + offsetY, size, size);
      graphics.fillStyle(0x6f4b33, 1); graphics.fillRect(x + offsetX + 3, groundY - size + 3 + offsetY, size - 6, size - 6);
      graphics.fillStyle(0xa06b42, 0.5); graphics.fillRect(x + offsetX + 6, groundY - size + 6 + offsetY, size - 12, 4);
      graphics.fillStyle(0x33231c, 1); graphics.fillRect(x + offsetX + size / 2 - 2, groundY - size + 3 + offsetY, 4, size - 6);
    });
  }

  drawBrokenWheel(graphics, x, groundY) {
    graphics.lineStyle(7, 0x34251f, 1); graphics.strokeCircle(x, groundY - 24, 22);
    graphics.lineStyle(4, 0x7b5339, 1); graphics.strokeCircle(x, groundY - 24, 18);
    graphics.lineBetween(x - 16, groundY - 24, x + 16, groundY - 24);
    graphics.lineBetween(x, groundY - 40, x, groundY - 8);
  }

  drawNestBrazier(graphics, x, groundY) {
    graphics.fillStyle(0x160e13, 1); graphics.fillRect(x - 18, groundY - 32, 36, 32);
    graphics.fillStyle(0x5b2930, 1); graphics.fillRect(x - 23, groundY - 38, 46, 10);
    graphics.fillStyle(0xd83f3d, 0.9); graphics.fillRect(x - 12, groundY - 51, 24, 13);
    graphics.fillStyle(0xff8a4e, 0.8); graphics.fillRect(x - 5, groundY - 60, 10, 18);
  }

  drawRuinBlocks(graphics, x, groundY) {
    const material = this.terrainMaterial;
    [[0, 0, 30, 24], [29, 0, 38, 31], [12, -24, 34, 22]].forEach(([offsetX, offsetY, width, height]) => {
      graphics.fillStyle(material.edge, 1); graphics.fillRect(x + offsetX, groundY - height + offsetY, width, height);
      graphics.fillStyle(material.blocks[1], 1); graphics.fillRect(x + offsetX + 3, groundY - height + 3 + offsetY, width - 6, height - 6);
      graphics.fillStyle(material.fleck, 0.35); graphics.fillRect(x + offsetX + 7, groundY - height + 6 + offsetY, 11, 3);
    });
  }

  createRoomTitle() {
    this.add
      .text(850, 185, this.areaName(this.area), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "34px",
        color: "#dfeae5",
        stroke: "#061013",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setAlpha(0.55);
    this.add
      .text(850, 224, this.areaSecondaryName(this.area), {
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        color: "#8baaa8",
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0.7);
  }

  spawnCurrentAreaEnemies() {
    this.remainingEnemies = 0;
    if (this.area.isBossArea) {
      this.boss = new KingSpiderBoss(this, 1120, 530);
      this.enemies.add(this.boss);
      this.physics.add.collider(this.boss, this.platforms);
      this.remainingEnemies = 1;
      return;
    }
    this.area.enemies.forEach((enemySpec, index) => {
      const spawnKey = `${this.area.id}-${index}`;
      if (this.runState.defeated[spawnKey]) return;

      const spec = typeof enemySpec === "number" ? { x: enemySpec, type: "parasitic" } : enemySpec;
      const enemy = new Enemy(this, spec.x, 550, index + 1, this.area.id, spec.type);
      enemy.spawnKey = spawnKey;
      this.enemies.add(enemy);
      this.physics.add.collider(enemy, this.platforms);
      this.remainingEnemies += 1;
    });
  }

  createTransitionCorridors() {
    if (this.area.leftExit) {
      this.leftCorridor = this.createCorridor(28, "left", this.area.leftExit);
    }
    if (this.area.rightExit) {
      this.rightCorridor = this.createCorridor(ROOM_WIDTH - 28, "right", this.area.rightExit);
    }
  }

  createCorridor(x, side, targetAreaId) {
    const targetArea = getArea(targetAreaId);
    const direction = side === "left" ? "←" : "→";
    const color = side === "left" ? 0x456b70 : 0x6b8d83;

    this.add.rectangle(x, 500, 56, 300, color, 0.22).setStrokeStyle(2, color);
    this.add
      .text(side === "left" ? 42 : ROOM_WIDTH - 42, 350, `${direction} ${this.areaName(targetArea)}`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "16px",
        color: "#afc9c4",
        stroke: "#061013",
        strokeThickness: 5,
      })
      .setOrigin(side === "left" ? 0 : 1, 0.5);

    const zone = this.add.zone(x, 515, 70, 300);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player, zone, () => {
      const entrySide = side === "left" ? "right" : "left";
      this.transitionTo(targetAreaId, entrySide);
    });
    return zone;
  }

  createControls() {
    this.controls = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      dodge: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      skill: Phaser.Input.Keyboard.KeyCodes.K,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
    });

    this.mouseActions = { attack: false, dodge: false, skill: false };
    this.input.mouse.disableContextMenu();
    this.pointerHandler = (pointer) => {
      if (pointer.leftButtonDown()) this.mouseActions.attack = true;
      if (pointer.rightButtonDown()) this.mouseActions.dodge = true;
      if (pointer.middleButtonDown()) this.mouseActions.skill = true;
    };
    this.input.on("pointerdown", this.pointerHandler);
  }

  createHud() {
    const leftPanel = this.add.rectangle(18, 18, 350, 88, 0x041013, 0.92).setOrigin(0).setScrollFactor(0).setDepth(30);
    leftPanel.setStrokeStyle(2, 0x315f60);
    this.add.rectangle(18, 18, 8, 88, this.area.accent, 0.9).setOrigin(0).setScrollFactor(0).setDepth(31);
    this.healthText = this.add.text(40, 32, "♥♥♥♥♥", {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "27px", color: "#e26761",
      stroke: "#37191a", strokeThickness: 5, letterSpacing: 2,
    }).setScrollFactor(0).setDepth(34);
    this.add.text(40, 70, this.tr("energy"), { ...this.hudStyle("#9cc7c5"), fontSize: "12px" })
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(32);
    this.add.rectangle(105, 70, 232, 15, 0x0a1c20, 1).setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x294749).setScrollFactor(0).setDepth(31);
    this.add.rectangle(107, 70, 228, 11, 0x53c6cf, 0.12).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32);
    this.energyFill = this.add.rectangle(107, 70, 228, 11, 0x53c6cf, 0.96).setOrigin(0, 0.5).setScrollFactor(0).setDepth(33);
    this.energyText = this.add.text(329, 70, "45 / 100", this.hudValueStyle()).setOrigin(1, 0.5).setScrollFactor(0).setDepth(34);

    this.createPlayerStaminaIndicator();
    this.createSkillCooldownIcon();

    const rightPanel = this.add.rectangle(1262, 18, 352, 132, 0x041013, 0.92).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
    rightPanel.setStrokeStyle(2, 0x315f60);
    this.areaText = this.add
      .text(1242, 29, this.areaName(this.area), { ...this.hudStyle("#e8ede8"), fontSize: "20px" })
      .setOrigin(1, 0)
      .setScrollFactor(0).setDepth(32);
    this.enemyText = this.add
      .text(1242, 61, this.getEnemyStatusText(), { ...this.hudStyle("#d8b870"), fontSize: "15px" })
      .setOrigin(1, 0)
      .setScrollFactor(0).setDepth(32);
    this.explorationText = this.add
      .text(1242, 88, this.tr("exploration", { value: this.runState.exploration }), { ...this.hudStyle("#8fbab6"), fontSize: "15px" })
      .setOrigin(1, 0)
      .setScrollFactor(0).setDepth(32);
    this.objectiveText = this.add
      .text(1242, 112, this.getObjectiveText(), { ...this.hudStyle("#c9a76b"), fontSize: "13px" })
      .setOrigin(1, 0)
      .setScrollFactor(0).setDepth(32);

    this.controlsText = this.add
      .text(640, 687, this.tr("controls"), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "14px",
        color: "#779b98",
        backgroundColor: "rgba(3, 12, 14, 0.72)",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0).setDepth(32);
    this.time.delayedCall(6500, () => {
      if (this.controlsText?.active) this.tweens.add({ targets: this.controlsText, alpha: 0, duration: 700 });
    });

    if (this.area.isBossArea) this.createBossHealthBar();
  }

  createPlayerStaminaIndicator() {
    this.staminaIndicator = this.add.container(0, 0).setScrollFactor(0).setDepth(36).setVisible(false);
    const back = this.add.rectangle(0, 0, 82, 10, 0x071315, 0.9).setStrokeStyle(1, 0x294b43);
    const track = this.add.rectangle(-38, 0, 76, 6, 0x18362f, 0.86).setOrigin(0, 0.5);
    this.staminaWorldFill = this.add.rectangle(-38, 0, 76, 6, 0x71c99c, 1).setOrigin(0, 0.5);
    this.staminaIndicator.add([back, track, this.staminaWorldFill]);
  }

  createSkillCooldownIcon() {
    const x = 1214; const y = 646;
    this.skillIconFrame = this.add.rectangle(x, y, 72, 72, 0x071315, 0.94)
      .setStrokeStyle(3, 0x4a898a).setScrollFactor(0).setDepth(32);
    this.add.rectangle(x, y, 43, 43, 0x18494d, 0.95).setAngle(45).setScrollFactor(0).setDepth(33);
    this.add.rectangle(x, y, 20, 20, 0x71dce0, 0.88).setAngle(45).setScrollFactor(0).setDepth(34);
    this.add.text(x + 27, y + 25, "K", {
      fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#a9c8c7", stroke: "#061013", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(36);
    this.skillCooldownShade = this.add.rectangle(x, y + 34, 66, 66, 0x020708, 0.72)
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(35).setVisible(false);
    this.skillCooldownText = this.add.text(x, y, "", {
      fontFamily: "Arial, sans-serif", fontSize: "25px", fontStyle: "bold", color: "#ffffff",
      stroke: "#061013", strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(36).setVisible(false);
  }

  createBossHealthBar() {
    this.bossBarBack = this.add.rectangle(640, 116, 520, 22, 0x10090d, 0.94)
      .setStrokeStyle(2, 0x9d5557).setScrollFactor(0).setDepth(34);
    this.bossBarFill = this.add.rectangle(382, 116, 516, 16, 0xb64a4a, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(35);
    this.bossNameText = this.add.text(640, 82, this.tr("bossName"), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "22px", color: "#f0c1ad", stroke: "#16090d", strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(35);
  }

  updateBossHealth(health, maxHealth) {
    if (!this.bossBarFill) return;
    this.bossBarFill.scaleX = Phaser.Math.Clamp(health / maxHealth, 0, 1);
  }

  createGuidance() {
    this.guideArrow = this.add
      .text(640, 188, "", {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "26px",
        color: "#f0cb6d",
        backgroundColor: "rgba(7, 18, 20, 0.82)",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(35)
      .setVisible(false);
  }

  hudStyle(color) {
    return {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: "19px",
      color,
    };
  }

  hudValueStyle() {
    return { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "12px", color: "#eff6f2", stroke: "#061013", strokeThickness: 3 };
  }

  areaName(area = this.area) { return this.language === "en" ? area.subtitle : area.name; }
  areaSecondaryName(area = this.area) { return (this.language === "en" ? area.name : area.subtitle).toUpperCase(); }

  update() {
    if (this.gameEnded) {
      if (Phaser.Input.Keyboard.JustDown(this.controls.restart)) {
        this.scene.restart({ resetRun: true });
      }
      return;
    }
    if (this.transitioning) return;

    this.player.update(this.time.now, this.game.loop.delta, this.controls, this.mouseActions);
    this.enemies.getChildren().forEach((enemy) => enemy.update(this.time.now, this.player));
    this.updateGuidance();

    this.mouseActions.attack = false;
    this.mouseActions.dodge = false;
    this.mouseActions.skill = false;
  }

  updateHud(stats) {
    this.energyFill.scaleX = Phaser.Math.Clamp(stats.energy / stats.maxEnergy, 0, 1);
    this.healthText.setText(`${"♥".repeat(stats.health)}${"♡".repeat(stats.maxHealth - stats.health)}`);
    this.energyText.setText(`${Math.round(stats.energy)} / ${stats.maxEnergy}`);

    const staminaVisible = stats.stamina < stats.maxStamina - 0.4;
    this.staminaIndicator.setVisible(staminaVisible);
    if (staminaVisible) {
      const screenX = Phaser.Math.Clamp(this.player.x - this.cameras.main.scrollX, 52, 1228);
      const screenY = Phaser.Math.Clamp(this.player.y - this.cameras.main.scrollY + 64, 36, 684);
      this.staminaIndicator.setPosition(screenX, screenY);
      this.staminaWorldFill.scaleX = Phaser.Math.Clamp(stats.stamina / stats.maxStamina, 0, 1);
    }

    const cooldownRatio = Phaser.Math.Clamp(stats.skillCooldown / BASE_PULSE_SKILL.cooldownMs, 0, 1);
    const coolingDown = stats.skillCooldown > 0;
    this.skillCooldownShade.setVisible(coolingDown).setScale(1, cooldownRatio);
    this.skillCooldownText.setVisible(coolingDown).setText(coolingDown ? (stats.skillCooldown / 1000).toFixed(1) : "");
    this.skillIconFrame.setStrokeStyle(coolingDown ? 2 : 3, coolingDown ? 0x385557 : 0x74d6d5);
  }

  registerCombatHit(strength = 1) {
    this.cameras.main.shake(strength > 1 ? 90 : 55, strength > 1 ? 0.0045 : 0.0025);
  }

  getEnemyStatusText() {
    if (this.area.isBossArea) return this.tr("finalBattle");
    if (this.runState.cleared[this.area.id]) return this.tr("areaClear");
    return this.tr("enemiesLeft", { count: this.remainingEnemies });
  }

  getObjectiveText() {
    if (this.area.isBossArea) return this.tr("objectiveBoss");
    if (!this.runState.hiddenEntranceUnlocked) {
      return this.tr("objectiveExplore", { value: FINAL_GATE_REQUIREMENT });
    }
    if (this.area.id === HIDDEN_ENTRANCE_AREA) {
      return this.tr("objectiveFollow");
    }
    return this.tr("objectiveGoWeb");
  }

  updateGuidance() {
    if (this.area.isBossArea) {
      this.guideArrow.setVisible(false);
      return;
    }
    if (!this.runState.hiddenEntranceUnlocked) {
      this.guideArrow.setVisible(false);
      return;
    }

    if (this.area.id !== HIDDEN_ENTRANCE_AREA) {
      const currentIndex = AREA_DEFINITIONS.findIndex((area) => area.id === this.area.id);
      const targetIndex = AREA_DEFINITIONS.findIndex((area) => area.id === HIDDEN_ENTRANCE_AREA);
      const direction = currentIndex < targetIndex ? "→" : "←";
      this.guideArrow.setText(this.tr("guideGoWeb", { direction })).setPosition(640, 188).setVisible(true);
      return;
    }

    const portalX = 850;
    const screenX = portalX - this.cameras.main.scrollX;
    if (screenX < 90) {
      this.guideArrow.setText(this.tr("hiddenEntranceLeft")).setPosition(120, 188).setVisible(true);
    } else if (screenX > 1190) {
      this.guideArrow.setText(this.tr("hiddenEntranceRight")).setPosition(1160, 188).setVisible(true);
    } else {
      this.guideArrow.setText(this.tr("hiddenEntranceDown")).setPosition(screenX, 188).setVisible(true);
    }
  }

  enemyDefeated(enemy) {
    if (!enemy.spawnKey) {
      this.player.restoreEnergy(8);
      this.showFloatingReward(this.tr("summonedEnergyReward"));
      return;
    }
    if (this.runState.defeated[enemy.spawnKey]) return;

    this.runState.defeated[enemy.spawnKey] = true;
    this.remainingEnemies = Math.max(0, this.remainingEnemies - 1);
    this.player.restoreEnergy(15);
    this.enemyText.setText(this.tr("enemiesLeft", { count: this.remainingEnemies }));
    this.showFloatingReward(this.tr("energyReward"));

    if (Phaser.Math.FloatBetween(0, 1) < 0.28) {
      this.createHealthDrop(enemy.x, enemy.y - 18);
    }

    if (this.remainingEnemies === 0) {
      this.clearCurrentArea();
    }
  }

  summonCowSpiders(_originX, count = 2) {
    for (let index = 0; index < count; index += 1) {
      const x = index % 2 === 0 ? 105 : ROOM_WIDTH - 105;
      const enemy = new Enemy(this, x, 470, 100 + index + this.time.now, this.area.id, "cow");
      enemy.spawnKey = null;
      this.enemies.add(enemy);
      this.physics.add.collider(enemy, this.platforms);
      const flash = this.add.circle(x, 500, 46, 0x73d27d, 0.2).setStrokeStyle(4, 0xa8efa8, 0.85).setDepth(9);
      this.tweens.add({ targets: flash, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    }
  }

  createHealthDrop(x, y) {
    const drop = this.add.container(x, y).setDepth(12);
    const glow = this.add.circle(0, 0, 16, 0xe36d69, 0.22).setStrokeStyle(2, 0xf4a09a, 0.9);
    const core = this.add.circle(0, 0, 10, 0xbe4f4f, 1);
    const crossA = this.add.rectangle(0, 0, 13, 4, 0xffdddd);
    const crossB = this.add.rectangle(0, 0, 4, 13, 0xffdddd);
    drop.add([glow, core, crossA, crossB]);
    this.physics.add.existing(drop);
    drop.body.setSize(30, 30).setOffset(-15, -15);
    drop.body.setBounce(0.45).setCollideWorldBounds(true);
    drop.body.setVelocity(Phaser.Math.Between(-90, 90), -290);
    this.physics.add.collider(drop, this.platforms);
    this.physics.add.overlap(this.player, drop, () => {
      if (!drop.active || drop.collected) return;
      drop.collected = true;
      drop.body.enable = false;
      this.player.restoreHealth(1);
      this.showFloatingReward(this.tr("healthReward"), "#f2a09a");
      this.tweens.add({ targets: drop, y: drop.y - 28, alpha: 0, scale: 1.45, duration: 180, onComplete: () => drop.destroy() });
    });
    this.tweens.add({ targets: glow, scaleX: 1.3, scaleY: 1.3, alpha: 0.08, duration: 520, yoyo: true, repeat: -1 });
    this.time.delayedCall(12000, () => {
      if (!drop.active || drop.collected) return;
      this.tweens.add({ targets: drop, alpha: 0, duration: 450, onComplete: () => drop.destroy() });
    });
  }

  clearCurrentArea() {
    if (this.runState.cleared[this.area.id]) return;

    this.runState.cleared[this.area.id] = true;
    const clearedCount = Object.values(this.runState.cleared).filter(Boolean).length;
    this.runState.exploration = Math.min(100, clearedCount * EXPLORATION_PER_AREA);
    this.player.restoreEnergy(20);
    this.player.restoreHealth(1);
    this.enemyText.setText(this.tr("areaClear"));
    this.explorationText.setText(this.tr("exploration", { value: this.runState.exploration }));
    this.showAreaClearBanner();

    if (
      this.runState.exploration >= FINAL_GATE_REQUIREMENT &&
      !this.runState.hiddenEntranceUnlocked
    ) {
      this.runState.hiddenEntranceUnlocked = true;
      this.objectiveText.setText(this.getObjectiveText());
      if (this.area.id === HIDDEN_ENTRANCE_AREA) this.revealHiddenEntrance(true);
      this.time.delayedCall(2450, () => {
        this.showToast(this.tr("gateDiscovered"), 0xe1bc63, 3000);
      });
    }
  }

  transitionTo(targetAreaId, entrySide) {
    if (!this.transitionReady || this.transitioning || this.gameEnded) return;

    this.transitioning = true;
    this.player.body.setVelocity(0, 0);
    const snapshot = this.getPlayerSnapshot();
    this.cameras.main.fadeOut(260, 4, 16, 19);
    this.time.delayedCall(280, () => {
      this.scene.restart({
        areaId: targetAreaId,
        entrySide,
        runState: this.runState,
        playerStats: snapshot,
      });
    });
  }

  getPlayerSnapshot() {
    return {
      health: this.player.health,
      stamina: this.player.stamina,
      energy: this.player.energy,
    };
  }

  restorePlayerSnapshot() {
    if (!this.playerSnapshot) return;
    this.player.health = Phaser.Math.Clamp(this.playerSnapshot.health, 1, this.player.maxHealth);
    this.player.stamina = Phaser.Math.Clamp(this.playerSnapshot.stamina, 0, this.player.maxStamina);
    this.player.energy = Phaser.Math.Clamp(this.playerSnapshot.energy, 0, this.player.maxEnergy);
  }

  revealHiddenEntrance(announce) {
    if (this.hiddenEntranceObjects) return;

    const glow = this.add.circle(850, 500, 88, 0xd8ad43, 0.1).setDepth(2);
    const outer = this.add.circle(850, 500, 58, 0x191f1e, 0.95).setStrokeStyle(5, 0xe1bc63).setDepth(3);
    const inner = this.add.circle(850, 500, 36, 0x050909, 1).setStrokeStyle(2, 0x8e7132).setDepth(4);
    const label = this.add
      .text(850, 405, this.tr("hiddenGate"), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "19px",
        color: "#f0d889",
        align: "center",
        stroke: "#071013",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(5);

    const zone = this.add.zone(850, 505, 105, 180);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player, zone, () => this.reachFinalArea());
    this.hiddenEntranceObjects = { glow, outer, inner, label, zone };

    this.tweens.add({
      targets: [glow, outer],
      alpha: { from: 0.25, to: 0.9 },
      scaleX: { from: 0.9, to: 1.08 },
      scaleY: { from: 0.9, to: 1.08 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    if (announce) this.showToast(this.tr("gateAppeared"), 0xe1bc63, 2200);
  }

  showFloatingReward(message, color = "#80e2df") {
    const rewardText = this.add
      .text(this.player.x, this.player.y - 85, message, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "17px",
        color,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: rewardText,
      y: rewardText.y - 42,
      alpha: 0,
      duration: 720,
      onComplete: () => rewardText.destroy(),
    });
  }

  showAreaClearBanner() {
    const banner = this.add
      .rectangle(640, 255, 720, 164, 0x07191c, 0.95)
      .setStrokeStyle(2, this.area.accent)
      .setScrollFactor(0)
      .setDepth(30);
    const title = this.add
      .text(640, 226, this.tr("areaClearTitle", { area: this.areaName(this.area) }), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "32px",
        color: "#f1dfad",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);
    const detail = this.add
      .text(640, 284, this.tr("areaClearDetail", { value: EXPLORATION_PER_AREA }), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "18px",
        color: "#9cc4bf",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);

    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: [banner, title, detail],
        alpha: 0,
        duration: 420,
        onComplete: () => {
          banner.destroy();
          title.destroy();
          detail.destroy();
        },
      });
    });
  }

  showToast(message, accent = 0x77b7b4, duration = 1400) {
    const toast = this.add
      .text(640, 172, message, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "20px",
        color: "#e9f2ed",
        backgroundColor: "rgba(4, 16, 19, 0.9)",
        padding: { x: 22, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(32);
    toast.setStroke(Phaser.Display.Color.IntegerToColor(accent).rgba, 1);
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        y: toast.y - 18,
        duration: 300,
        onComplete: () => toast.destroy(),
      });
    });
  }

  reachFinalArea() {
    if (!this.runState.hiddenEntranceUnlocked || this.gameEnded || this.transitioning) return;
    this.transitioning = true;
    const snapshot = this.getPlayerSnapshot();
    this.cameras.main.fadeOut(320, 10, 3, 7);
    this.time.delayedCall(340, () => {
      this.scene.restart({
        areaId: "king-spider-nest",
        entrySide: "left",
        runState: this.runState,
        playerStats: snapshot,
      });
    });
  }

  bossDefeated() {
    if (this.gameEnded) return;
    this.runState.bossDefeated = true;
    this.gameEnded = true;
    this.updateBossHealth(0, 1);
    this.cameras.main.shake(520, 0.012);
    this.time.delayedCall(760, () => {
      this.physics.pause();
      this.showEndOverlay(
        this.tr("endingTitle"),
        this.tr("endingDetail"),
        "#e3c36f",
      );
    });
  }

  gameOver() {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.physics.pause();
    this.showEndOverlay(this.tr("failedTitle"), this.tr("failedDetail"), "#e38a7b");
  }

  showEndOverlay(titleText, detailText, color) {
    this.add.rectangle(640, 360, 1280, 720, 0x020708, 0.74).setScrollFactor(0).setDepth(40);
    this.add
      .text(640, 288, titleText, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "48px",
        color,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(41);
    this.add
      .text(640, 372, detailText, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: "21px",
        color: "#d7e2df",
        align: "center",
        lineSpacing: 9,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(41);
  }
}
