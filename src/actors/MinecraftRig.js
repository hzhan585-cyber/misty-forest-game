import * as Phaser from "phaser";
import { getSkinLayout } from "../character/minecraftSkinLayout.js";

export const IDLE_WEAPON_ROTATION = Math.PI / 2;

export class MinecraftRig extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.parts = {};

    this.backArm = this.createCuboid("leftArm", 12, 36, 0xc9d0ca, 0xaeb8b3).setPosition(-16, -28);
    this.backLeg = this.createCuboid("leftLeg", 12, 36, 0xb7c0ba, 0x929f99).setPosition(-5, 8);
    this.torso = this.createCuboid("body", 24, 36, 0xe4e8e2, 0xbfc8c2).setPosition(0, -28);
    this.head = this.createCuboid("head", 24, 24, 0xf4f5ef, 0xcbd1cc).setPosition(3, -52);
    this.frontLeg = this.createCuboid("rightLeg", 12, 36, 0xd7dcd6, 0xaeb8b1).setPosition(7, 8);
    this.frontArm = this.createCuboid("rightArm", 12, 36, 0xf0f2ec, 0xc3cbc5).setPosition(19, -28);

    this.directionEye = scene.add.rectangle(5, 8, 4, 4, 0x446662, 0.78).setOrigin(0.5, 0);
    this.head.add(this.directionEye);

    this.weaponPivot = scene.add.container(0, 31);
    this.weaponPivot.rotation = IDLE_WEAPON_ROTATION;
    this.weaponGuard = scene.add.rectangle(0, -2, 22, 5, 0x6c8582).setStrokeStyle(1, 0x233536);
    this.weapon = scene.add.rectangle(0, -25, 7, 55, 0xa7d2cd).setOrigin(0.5, 0.88).setStrokeStyle(2, 0x3f6261);
    this.weaponShine = scene.add.rectangle(-1, -34, 2, 32, 0xdaf7f1, 0.72).setOrigin(0.5, 0.5);
    this.weaponPivot.add([this.weapon, this.weaponShine, this.weaponGuard]);
    this.frontArm.add(this.weaponPivot);

    this.add([this.backArm, this.backLeg, this.torso, this.head, this.frontLeg, this.frontArm]);
    this.currentFacing = 0;
    this.setFacing(1);
  }

  createCuboid(slot, width, height, frontColor, sideColor) {
    const part = this.scene.add.container(0, 0);
    const front = this.scene.add.rectangle(0, 0, width, height, frontColor).setOrigin(0.5, 0).setStrokeStyle(2, 0x65716d, 0.8);
    const side = this.scene.add.rectangle(width / 2 - 3, 2, 4, height - 4, sideColor).setOrigin(0, 0).setStrokeStyle(1, 0x59645f, 0.72);
    const top = this.scene.add.rectangle(0, 1, width - 4, 3, 0xffffff, 0.28).setOrigin(0.5, 0);
    const shade = this.scene.add.rectangle(-width / 2 + 2, height - 4, width - 4, 3, 0x5f6a66, 0.22).setOrigin(0, 0);
    part.add([front, side, top, shade]);
    part.skinSlot = slot;
    part.partWidth = width;
    part.partHeight = height;
    part.sideWidth = Math.max(4, Math.round(width * (slot === "head" ? 0.36 : 0.3)));
    part.frontWidth = width - part.sideWidth;
    front.setDisplaySize(part.frontWidth, height).setPosition(part.sideWidth / 2, 0);
    side.setDisplaySize(part.sideWidth, height - 4).setPosition(-width / 2, 2);
    top.setDisplaySize(Math.max(3, part.frontWidth - 3), 3).setPosition(part.sideWidth / 2, 1);
    shade.setDisplaySize(Math.max(3, part.frontWidth - 3), 3).setPosition(-width / 2 + part.sideWidth + 1, height - 4);
    part.faces = { front, side, top, shade };
    this.parts[slot] = part;
    return part;
  }

  applySkinImage(image, width, height) {
    const skinLayout = getSkinLayout(width, height);
    if (!skinLayout) throw new Error("不支持的 Minecraft 皮肤尺寸");
    const textureKey = `player-skin-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const texture = this.scene.textures.addImage(textureKey, image);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.skinTextureKey = textureKey;
    this.skinLayout = skinLayout;

    Object.entries(this.parts).forEach(([slot, part]) => {
      const uv = skinLayout.parts[slot];
      if (!uv) return;
      part.skinMirror = Boolean(uv.mirror);
      this.attachSkinFace(texture, textureKey, part, slot, "front", uv.front);
      this.attachSkinFace(texture, textureKey, part, slot, "right", uv.right);
      this.attachSkinFace(texture, textureKey, part, slot, "left", uv.left);
      if (uv.overlayFront) this.attachSkinOverlay(texture, textureKey, part, slot, uv.overlayFront);
    });
    this.directionEye.setVisible(false);
    this.updateSideFaces(this.scaleX >= 0 ? 1 : -1);
  }

  attachSkinFace(texture, textureKey, part, slot, faceName, rect) {
    const frameName = `${slot}-${faceName}`;
    if (!texture.has(frameName)) texture.add(frameName, 0, ...rect);
    const image = this.scene.add.image(0, 0, textureKey, frameName).setOrigin(0.5, 0);
    image.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (faceName === "front") {
      image.setDisplaySize(part.frontWidth, part.partHeight).setPosition(part.sideWidth / 2, 0);
      image.setFlipX(part.skinMirror);
      part.frontSkin = image;
    } else {
      image.setOrigin(0, 0).setPosition(-part.partWidth / 2, 2)
        .setDisplaySize(part.sideWidth, part.partHeight - 4).setVisible(false);
      part[`${faceName}Skin`] = image;
    }
    part.add(image);
  }

  attachSkinOverlay(texture, textureKey, part, slot, rect) {
    const frameName = `${slot}-overlay-front`;
    if (!texture.has(frameName)) texture.add(frameName, 0, ...rect);
    const overlay = this.scene.add.image(0, -1, textureKey, frameName).setOrigin(0.5, 0)
      .setDisplaySize(part.frontWidth + 2, part.partHeight + 2)
      .setPosition(part.sideWidth / 2, -1);
    overlay.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    part.overlaySkin = overlay;
    part.add(overlay);
  }

  updateSideFaces(facing) {
    Object.values(this.parts).forEach((part) => {
      if (!part.rightSkin || !part.leftSkin) return;
      part.rightSkin.setVisible(facing < 0);
      part.leftSkin.setVisible(facing > 0);
    });
  }

  setFacing(facing) {
    if (facing !== this.currentFacing) {
      this.updateLimbLayers(facing);
      this.currentFacing = facing;
    }
    this.scaleX = facing;
    this.updateSideFaces(facing);
    this.head.x = 3;
    this.torso.x = 0;
    this.frontArm.x = 19;
    this.backArm.x = -16;
    this.frontLeg.x = 7;
    this.backLeg.x = -5;
  }

  updateLimbLayers(facing) {
    // Horizontal mirroring does not reverse a Container's display-list order.
    // `frontArm/frontLeg` are the anatomical right limbs, not the limbs that
    // should always be drawn in front. Facing right exposes the character's
    // left side; facing left exposes the right side. Keep the torso between
    // the far and near limb pairs so its visible side agrees with occlusion.
    const order = facing > 0
      ? [this.frontArm, this.frontLeg, this.torso, this.head, this.backLeg, this.backArm]
      : [this.backArm, this.backLeg, this.torso, this.head, this.frontLeg, this.frontArm];
    order.forEach((part, index) => this.moveTo(part, index));
  }

  animateLocomotion(time, grounded, velocityX, velocityY) {
    const moving = Math.abs(velocityX) > 20;
    const breath = Math.sin(time * 0.0055);
    this.y = grounded ? (moving ? Math.abs(Math.sin(time * 0.014)) * -2 : breath * 0.8) : 0;
    this.torso.scaleY = 1 + breath * 0.012;
    this.head.y = -52 + breath * 0.45;

    if (grounded && moving) {
      const stride = Math.sin(time * 0.014) * 0.72;
      this.frontLeg.rotation = stride;
      this.backLeg.rotation = -stride;
      this.frontArm.rotation = -stride * 0.72;
      this.backArm.rotation = stride * 0.72;
      this.head.rotation = -stride * 0.035;
      this.rotation = Phaser.Math.Linear(this.rotation, -stride * 0.025, 0.3);
    } else if (grounded) {
      this.frontLeg.rotation = Phaser.Math.Linear(this.frontLeg.rotation, 0.04, 0.18);
      this.backLeg.rotation = Phaser.Math.Linear(this.backLeg.rotation, -0.04, 0.18);
      this.frontArm.rotation = Phaser.Math.Linear(this.frontArm.rotation, -0.06 + breath * 0.025, 0.18);
      this.backArm.rotation = Phaser.Math.Linear(this.backArm.rotation, 0.06 - breath * 0.025, 0.18);
      this.head.rotation = breath * 0.012;
      this.rotation = Phaser.Math.Linear(this.rotation, 0, 0.2);
    } else {
      const rising = velocityY < 0;
      this.frontLeg.rotation = Phaser.Math.Linear(this.frontLeg.rotation, rising ? -0.48 : 0.32, 0.18);
      this.backLeg.rotation = Phaser.Math.Linear(this.backLeg.rotation, rising ? 0.56 : -0.24, 0.18);
      this.frontArm.rotation = Phaser.Math.Linear(this.frontArm.rotation, rising ? -0.72 : 0.28, 0.18);
      this.backArm.rotation = Phaser.Math.Linear(this.backArm.rotation, rising ? 0.4 : -0.42, 0.18);
      this.rotation = Phaser.Math.Linear(this.rotation, rising ? -0.06 : 0.08, 0.12);
    }
    this.weaponPivot.rotation = Phaser.Math.Linear(this.weaponPivot.rotation, IDLE_WEAPON_ROTATION, 0.2);
  }

  poseDodge(facing) {
    // The rig's own rotation sits outside its horizontal scale, so it must be
    // reversed explicitly to produce a genuinely mirrored dodge silhouette.
    this.rotation = 0.32 * facing;
    this.frontLeg.rotation = -0.82;
    this.backLeg.rotation = 0.72;
    this.frontArm.rotation = 0.78;
    this.backArm.rotation = -0.58;
    this.head.rotation = -0.18;
    this.y = 6;
  }

  playSkillPose() {
    const tweens = [];
    tweens.push(this.scene.tweens.add({ targets: this.frontArm, rotation: -1.35, duration: 90, yoyo: true, hold: 80 }));
    tweens.push(this.scene.tweens.add({ targets: this.backArm, rotation: 1.35, duration: 90, yoyo: true, hold: 80 }));
    tweens.push(this.scene.tweens.add({ targets: this, scaleY: 1.06, duration: 80, yoyo: true, hold: 70 }));
    return tweens;
  }

  resetScale() {
    this.scaleY = 1;
    this.torso.scaleY = 1;
  }
}
