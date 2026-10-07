import * as Phaser from "phaser";
import { chooseSkinFile, clearSavedSkin, createCheckerSkin, getSavedSkin, saveSkin } from "../character/skinStorage.js";
import { getLanguage, getSelectedCharacter, setLanguage, setSelectedCharacter, t } from "../i18n.js";

export class StartScene extends Phaser.Scene {
  constructor() { super("StartScene"); }

  create() {
    this.language = getLanguage();
    this.tr = (key, values) => t(this.language, key, values);
    this.cameras.main.setBackgroundColor("#061318");
    this.drawBackground();

    this.add.text(640, 66, this.tr("title"), {
      fontFamily: this.language === "zh" ? '"Microsoft YaHei", sans-serif' : "Georgia, serif",
      fontSize: this.language === "zh" ? "47px" : "42px", color: "#edf2e8", stroke: "#10252b", strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(640, 116, this.tr("subtitle"), {
      fontFamily: "Georgia, serif", fontSize: "17px", color: "#9ec1bd", letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(640, 151, this.tr("tagline"), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "17px", color: "#d8b870",
    }).setOrigin(0.5);

    const languageButton = this.makeButton(1177, 38, 150, 40, this.tr("languageButton"), true);
    languageButton.on("pointerdown", () => {
      setLanguage(this.language === "zh" ? "en" : "zh");
      this.scene.restart();
    });

    this.add.text(122, 184, this.tr("chooseCharacter"), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "20px", color: "#dce9e4",
    });
    this.add.rectangle(640, 305, 1060, 178, 0x07171b, 0.9).setStrokeStyle(2, 0x315b5d);
    this.createCharacterCard(300, "custom", this.tr("customCharacter"), this.tr("customCharacterDetail"), true);
    this.createCharacterCard(640, "future", this.tr("futureCharacter"), this.tr("comingLater"), false);
    this.createCharacterCard(980, "hidden", this.tr("hiddenCharacter"), this.tr("locked"), false);

    const importButton = this.makeButton(330, 435, 255, 42, this.tr("importSkin"));
    const testButton = this.makeButton(640, 435, 220, 42, this.tr("testSkin"));
    const resetButton = this.makeButton(925, 435, 220, 42, this.tr("resetSkin"));
    this.skinStatus = this.add.text(640, 477, this.skinStatusText(getSavedSkin()), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "14px", color: "#9bbab6",
    }).setOrigin(0.5);

    importButton.on("pointerdown", async () => {
      this.skinStatus.setColor("#9bbab6").setText(this.tr("readingSkin"));
      try {
        const skin = await chooseSkinFile();
        if (!skin) { this.refreshSkinStatus(); return; }
        saveSkin(skin);
        this.skinStatus.setText(this.tr("savedSkin", skin));
      } catch {
        this.skinStatus.setText(this.tr("skinError")).setColor("#e59a8b");
      }
    });
    testButton.on("pointerdown", () => {
      saveSkin(createCheckerSkin());
      this.skinStatus.setColor("#9bbab6").setText(this.tr("checkerEnabled"));
    });
    resetButton.on("pointerdown", () => {
      clearSavedSkin();
      this.refreshSkinStatus();
    });

    const startButton = this.makeButton(640, 548, 390, 62, this.tr("start"));
    this.add.text(640, 590, this.tr("startHint"), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "13px", color: "#729491",
    }).setOrigin(0.5);
    this.add.text(640, 655, this.tr("controls"), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "15px", color: "#86a8a5",
    }).setOrigin(0.5);

    const start = () => { if (this.scene.isActive("StartScene")) this.scene.start("GameScene"); };
    startButton.on("pointerdown", start);
    this.input.keyboard.once("keydown-SPACE", start);
  }

  drawBackground() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0e2a30, 1); graphics.fillRect(0, 0, 1280, 720);
    graphics.fillStyle(0x15383b, 0.58);
    for (let x = -40; x < 1320; x += 78) {
      const height = 170 + Math.abs((x * 17) % 125);
      graphics.fillTriangle(x, 470, x + 40, 470 - height, x + 80, 470);
      graphics.fillRect(x + 35, 470 - height * 0.18, 10, height * 0.7);
    }
    graphics.fillStyle(0x071215, 0.96); graphics.fillRect(0, 170, 1280, 550);
  }

  createCharacterCard(x, id, title, detail, enabled) {
    const selected = enabled && getSelectedCharacter() === id;
    const panel = this.add.rectangle(x, 305, 310, 132, selected ? 0x173b3f : 0x0b2227, 0.98)
      .setStrokeStyle(selected ? 3 : 1, selected ? 0xd0ad61 : 0x426765);
    this.add.rectangle(x - 122, 305, 42, 96, enabled ? 0x315b55 : 0x1a292b, 1)
      .setStrokeStyle(1, enabled ? 0x7eb1a8 : 0x405052);
    this.add.text(x - 122, 305, enabled ? "◇" : "×", {
      fontFamily: "Georgia, serif", fontSize: "24px", color: enabled ? "#e4c978" : "#667777",
    }).setOrigin(0.5);
    this.add.text(x - 88, 268, title, {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "18px", color: enabled ? "#edf2e8" : "#748483",
    });
    this.add.text(x - 88, 301, detail, {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "12px", color: enabled ? "#91b2ae" : "#596b6b",
      wordWrap: { width: 190 }, lineSpacing: 3,
    });
    if (selected) this.add.text(x + 132, 354, this.tr("selected"), {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "11px", color: "#e4c978",
    }).setOrigin(1, 0.5);
    if (enabled) panel.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      setSelectedCharacter(id);
      this.scene.restart();
    });
  }

  makeButton(x, y, width, height, label, compact = false) {
    const button = this.add.rectangle(x, y, width, height, 0x102b31, 0.98)
      .setStrokeStyle(1, 0x65918d).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: compact ? "13px" : "16px", color: "#e4eeea",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    text.on("pointerdown", () => button.emit("pointerdown"));
    button.on("pointerover", () => button.setFillStyle(0x1b454b, 1));
    button.on("pointerout", () => button.setFillStyle(0x102b31, 0.98));
    return button;
  }

  skinStatusText(savedSkin) {
    return this.tr("currentSkin", { name: savedSkin?.name ?? this.tr("whiteRig") });
  }

  refreshSkinStatus() {
    this.skinStatus.setColor("#9bbab6").setText(this.skinStatusText(getSavedSkin()));
  }
}
