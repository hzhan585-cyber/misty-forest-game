import * as Phaser from "phaser";
import { BASE_PULSE_SKILL } from "../combat/skillConfigs.js";
import { IDLE_WEAPON_ROTATION, MinecraftRig } from "./MinecraftRig.js";
import { getSavedSkin, loadImage } from "../character/skinStorage.js";

const GROUND_COMBO = [
  { name: "横斩", anticipation: 65, swing: 105, recovery: 95, damage: 1, width: 112, height: 76, x: 64, y: -4, knockback: 260, start: -1.05, end: 1.38, backStart: 0.42, backEnd: -0.28, leanStart: -0.09, leanEnd: 0.11, trail: "horizontal" },
  { name: "纵斩", anticipation: 82, swing: 122, recovery: 105, damage: 1, width: 124, height: 132, x: 66, y: -20, knockback: 310, start: -2.3, end: 0.88, backStart: 0.72, backEnd: -0.48, leanStart: -0.13, leanEnd: 0.08, trail: "vertical" },
  { name: "强力终结", anticipation: 125, swing: 145, recovery: 155, damage: 2, width: 126, height: 98, x: 70, y: -3, knockback: 520, start: -1.55, end: 1.82, backStart: 0.92, backEnd: -0.7, leanStart: -0.2, leanEnd: 0.22, trail: "finisher" },
];

export class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.maxHealth = 5; this.health = 5;
    this.maxStamina = 100; this.stamina = 100;
    this.maxEnergy = 100; this.energy = 45;
    this.facing = 1; this.maxJumps = 2; this.jumpsUsed = 0; this.wasGrounded = false;
    this.isDodging = false; this.isAttacking = false; this.invulnerableUntil = 0;
    this.skillReadyAt = 0; this.skillPoseUntil = 0; this.landingPoseUntil = 0; this.comboIndex = 0; this.comboExpiresAt = 0;
    this.frozenUntil = 0; this.poisonToken = 0;
    this.attackQueued = false; this.attackToken = 0; this.attackTweens = [];

    this.shadow = scene.add.ellipse(0, 45, 52, 12, 0x000000, 0.36);
    this.rig = new MinecraftRig(scene);
    this.add([this.shadow, this.rig]);
    this.frontArm = this.rig.frontArm; this.backArm = this.rig.backArm;
    this.frontLeg = this.rig.frontLeg; this.backLeg = this.rig.backLeg;
    this.weapon = this.rig.weapon; this.weaponPivot = this.rig.weaponPivot;
    this.head = this.rig.head; this.bodyPart = this.rig.torso;

    this.body.setSize(46, 96); this.body.setOffset(-23, -52);
    this.body.setCollideWorldBounds(true); this.body.setMaxVelocity(700, 1000);
    this.applySavedSkin();
  }

  async applySavedSkin() {
    const saved = getSavedSkin();
    if (!saved) return;
    try {
      const image = await loadImage(saved.dataUrl);
      if (this.active) this.rig.applySkinImage(image, saved.width, saved.height);
    } catch (error) {
      console.warn("Saved Minecraft skin could not be applied.", error);
    }
  }

  update(time, delta, controls, mouseActions) {
    if (!this.active || !this.body) return;
    this.stamina = Phaser.Math.Clamp(this.stamina + delta * 0.035, 0, this.maxStamina);
    const left = controls.left.isDown || controls.a.isDown;
    const right = controls.right.isDown || controls.d.isDown;
    const grounded = this.body.blocked.down || this.body.touching.down;
    const frozen = time < this.frozenUntil;
    if (grounded && !this.wasGrounded) {
      this.jumpsUsed = 0;
      this.playLandingSquash();
    }
    this.wasGrounded = grounded;

    if (!this.isDodging && !this.isAttacking && !frozen) {
      if (left !== right) { this.facing = left ? -1 : 1; this.body.setVelocityX(this.facing * 245); }
      else this.body.setVelocityX(Phaser.Math.Linear(this.body.velocity.x, 0, 0.22));
    } else if (frozen && !this.isDodging) {
      this.body.setVelocityX(Phaser.Math.Linear(this.body.velocity.x, 0, 0.5));
    }
    this.rig.setFacing(this.facing);

    const jumpPressed = Phaser.Input.Keyboard.JustDown(controls.jump) || Phaser.Input.Keyboard.JustDown(controls.w);
    if (jumpPressed && !frozen && !this.isDodging && (grounded || this.jumpsUsed < this.maxJumps)) {
      if (grounded) this.jumpsUsed = 0;
      this.jumpsUsed += 1; this.body.setVelocityY(-670);
      if (this.jumpsUsed === 2) this.showDoubleJumpEffect();
    }
    if (Phaser.Input.Keyboard.JustDown(controls.dodge) || mouseActions.dodge) this.dodge(time);
    if (Phaser.Input.Keyboard.JustDown(controls.attack) || mouseActions.attack) this.attack(time, grounded);
    if (Phaser.Input.Keyboard.JustDown(controls.skill) || mouseActions.skill) this.castSkill(time);
    if (!this.isAttacking && time > this.comboExpiresAt) this.comboIndex = 0;
    this.animateRig(time, grounded);
    this.scene.events.emit("player-stats", this.getStats(time));
  }

  animateRig(time, grounded) {
    if (this.isAttacking || this.isDodging || time < this.skillPoseUntil || time < this.landingPoseUntil) return;
    this.rig.animateLocomotion(time, grounded, this.body.velocity.x, this.body.velocity.y);
  }

  dodge(time) {
    if (this.isDodging || this.stamina < 25) return;
    this.cancelAttack();
    this.frozenUntil = 0;
    this.stamina -= 25; this.isDodging = true; this.invulnerableUntil = time + 360;
    this.body.setVelocityX(this.facing * 610); this.body.setVelocityY(-80);
    this.setAlpha(0.58); this.rig.poseDodge(this.facing);
    this.createDodgeAfterimage();
    this.scene.time.delayedCall(95, () => { if (this.active && this.isDodging) this.createDodgeAfterimage(); });
    this.scene.tweens.add({ targets: this.rig, angle: this.rig.angle + 10 * this.facing, duration: 150, yoyo: true });
    this.scene.time.delayedCall(300, () => {
      if (!this.active) return;
      this.isDodging = false; this.setAlpha(1); this.rig.resetScale();
    });
  }

  attack(time, grounded) {
    if (this.isDodging) return;
    if (this.isAttacking) { this.attackQueued = true; return; }
    if (!grounded) { this.startAirAttack(); return; }
    if (time > this.comboExpiresAt) this.comboIndex = 0;
    this.startComboAttack(this.comboIndex);
  }

  startComboAttack(index) {
    const attack = GROUND_COMBO[index];
    const token = ++this.attackToken;
    this.stopAttackTweens();
    this.isAttacking = true; this.attackQueued = false;
    this.body.setVelocityX(this.facing * 24);
    this.addAttackTween({ targets: this.frontArm, rotation: attack.start, duration: attack.anticipation, ease: "Cubic.Out", onComplete: () => this.beginComboSwing(index, attack, token) });
    this.addAttackTween({ targets: this.backArm, rotation: attack.backStart, duration: attack.anticipation, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.rig, rotation: attack.leanStart, y: index === 2 ? 5 : 2, duration: attack.anticipation, ease: "Cubic.Out" });
    this.addAttackTween({
      targets: this.weaponPivot,
      rotation: IDLE_WEAPON_ROTATION + (index === 1 ? -0.38 : -0.18),
      duration: attack.anticipation,
      ease: "Quad.Out",
    });
    this.addAttackTween({ targets: this.frontLeg, rotation: index === 2 ? -0.38 : -0.16, duration: attack.anticipation });
    this.addAttackTween({ targets: this.backLeg, rotation: index === 2 ? 0.48 : 0.2, duration: attack.anticipation });
    this.addAttackTween({ targets: this.head, rotation: index === 2 ? 0.13 : -0.06, duration: attack.anticipation });
  }

  beginComboSwing(index, attack, token) {
    if (!this.active || !this.isAttacking || token !== this.attackToken) return;
    this.body.setVelocityX(this.facing * (index === 2 ? 165 : 102));
    this.scene.time.delayedCall(Math.round(attack.swing * 0.46), () => {
      if (!this.active || !this.isAttacking || token !== this.attackToken) return;
      this.showAttackTrail(attack.trail);
      this.createAttackHitbox(attack);
    });
    this.addAttackTween({ targets: this.frontArm, rotation: attack.end, duration: attack.swing, ease: index === 2 ? "Power4" : "Cubic.In", onComplete: () => this.beginComboRecovery(index, attack, token) });
    this.addAttackTween({ targets: this.backArm, rotation: attack.backEnd, duration: attack.swing, ease: "Cubic.In" });
    this.addAttackTween({ targets: this.rig, rotation: attack.leanEnd, y: index === 2 ? -1 : 0, duration: attack.swing, ease: "Cubic.In" });
    this.addAttackTween({
      targets: this.weaponPivot,
      rotation: IDLE_WEAPON_ROTATION + (index === 2 ? 0.28 : 0.12),
      duration: attack.swing,
      ease: "Cubic.In",
    });
    this.addAttackTween({ targets: this.head, rotation: index === 2 ? -0.18 : 0.09, duration: attack.swing, ease: "Cubic.In" });
  }

  beginComboRecovery(index, attack, token) {
    if (!this.active || token !== this.attackToken) return;
    this.addAttackTween({ targets: this.frontArm, rotation: -0.06, duration: attack.recovery, ease: "Cubic.Out", onComplete: () => this.finishComboAttack(index, token) });
    this.addAttackTween({ targets: this.backArm, rotation: 0.06, duration: attack.recovery, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.rig, rotation: 0, y: 0, duration: attack.recovery, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.weaponPivot, rotation: IDLE_WEAPON_ROTATION, duration: attack.recovery, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.frontLeg, rotation: 0.04, duration: attack.recovery, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.backLeg, rotation: -0.04, duration: attack.recovery, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.head, rotation: 0, duration: attack.recovery, ease: "Cubic.Out" });
  }

  finishComboAttack(index, token) {
    if (!this.active || token !== this.attackToken) return;
    this.isAttacking = false; this.attackTweens = [];
    this.comboIndex = (index + 1) % GROUND_COMBO.length;
    this.comboExpiresAt = this.scene.time.now + 600;
    if (this.attackQueued) this.startComboAttack(this.comboIndex);
  }

  startAirAttack() {
    const token = ++this.attackToken;
    this.stopAttackTweens();
    this.isAttacking = true; this.attackQueued = false;
    this.addAttackTween({ targets: this.frontArm, rotation: -1.5, duration: 55, ease: "Cubic.Out", onComplete: () => this.beginAirSwing(token) });
    this.addAttackTween({ targets: this.backArm, rotation: 0.65, duration: 55 });
    this.addAttackTween({ targets: this.frontLeg, rotation: -0.68, duration: 55 });
    this.addAttackTween({ targets: this.backLeg, rotation: 0.74, duration: 55 });
    this.addAttackTween({ targets: this.rig, rotation: -0.12, duration: 55 });
  }

  beginAirSwing(token) {
    if (!this.active || !this.isAttacking || token !== this.attackToken) return;
    this.scene.time.delayedCall(50, () => {
      if (!this.active || !this.isAttacking || token !== this.attackToken) return;
      this.showAttackTrail("air");
      this.createAttackHitbox({ damage: 1, width: 112, height: 86, x: 64, y: -2, knockback: 280 });
    });
    this.addAttackTween({ targets: this.frontArm, rotation: 1.62, duration: 118, ease: "Cubic.In", onComplete: () => this.beginAirRecovery(token) });
    this.addAttackTween({ targets: this.rig, rotation: 0.16, duration: 118, ease: "Cubic.In" });
    this.addAttackTween({ targets: this.backArm, rotation: -0.32, duration: 118, ease: "Cubic.In" });
  }

  beginAirRecovery(token) {
    if (!this.active || token !== this.attackToken) return;
    this.addAttackTween({ targets: this.frontArm, rotation: 0.22, duration: 105, ease: "Cubic.Out", onComplete: () => {
      if (this.active && token === this.attackToken) { this.isAttacking = false; this.attackTweens = []; }
    } });
    this.addAttackTween({ targets: this.backArm, rotation: -0.25, duration: 105, ease: "Cubic.Out" });
    this.addAttackTween({ targets: this.rig, rotation: 0.08, duration: 105, ease: "Cubic.Out" });
  }

  addAttackTween(config) {
    const tween = this.scene.tweens.add(config);
    this.attackTweens.push(tween);
    return tween;
  }

  stopAttackTweens() {
    this.attackTweens.forEach((tween) => tween?.stop());
    this.attackTweens = [];
  }

  cancelAttack() {
    if (!this.isAttacking) return;
    this.attackToken += 1; this.stopAttackTweens();
    this.isAttacking = false; this.attackQueued = false;
    this.comboIndex = 0; this.comboExpiresAt = 0;
  }

  createAttackHitbox(attack) {
    const hitbox = this.scene.add.zone(this.x + this.facing * attack.x, this.y + attack.y, attack.width, attack.height);
    this.scene.physics.add.existing(hitbox); hitbox.body.setAllowGravity(false);
    const struck = new Set();
    this.scene.physics.overlap(hitbox, this.scene.enemies, (_zone, enemy) => {
      if (struck.has(enemy) || !enemy.active) return;
      struck.add(enemy); enemy.takeDamage(attack.damage, this.facing, attack.knockback);
      this.scene.registerCombatHit?.(attack.damage);
    });
    this.scene.time.delayedCall(75, () => hitbox.destroy());
  }

  showAttackTrail(type) {
    const styles = {
      horizontal: { radius: 108, start: -0.95, end: 0.7, width: 12, y: -4, color: 0xb8f3eb },
      vertical: { radius: 116, start: -1.78, end: 0.34, width: 12, y: -10, color: 0xd4f6ef },
      finisher: { radius: 124, start: -1.18, end: 0.82, width: 18, y: -2, color: 0xffe2a3 },
      air: { radius: 108, start: -1.25, end: 0.62, width: 11, y: -4, color: 0x9de8e3 },
    };
    const style = styles[type] ?? styles.horizontal;
    const trail = this.scene.add.graphics().setPosition(this.x + this.facing * 10, this.y + style.y).setDepth(9);
    trail.setScale(this.facing, 1); trail.setBlendMode(Phaser.BlendModes.ADD);
    trail.lineStyle(style.width, style.color, 0.78);
    trail.beginPath(); trail.arc(0, 0, style.radius, style.start, style.end, false); trail.strokePath();
    trail.lineStyle(Math.max(2, style.width * 0.28), 0xffffff, 0.9);
    trail.beginPath(); trail.arc(0, 0, style.radius - 5, style.start + 0.08, style.end - 0.08, false); trail.strokePath();
    this.scene.tweens.add({ targets: trail, alpha: 0, duration: type === "finisher" ? 240 : 170, ease: "Quad.Out", onComplete: () => trail.destroy() });
  }

  castSkill(time) {
    const skill = BASE_PULSE_SKILL;
    if (this.isDodging || this.isAttacking || this.energy < skill.manaCost || time < this.skillReadyAt) return;
    this.energy -= skill.manaCost; this.skillReadyAt = time + skill.cooldownMs; this.skillPoseUntil = time + 270;
    this.rig.playSkillPose();
    const pulse = this.scene.add.circle(this.x, this.y, 28, 0x75e3df, 0.25).setDepth(8);
    this.scene.tweens.add({
      targets: pulse, radius: 130, alpha: 0, duration: 330,
      onStart: () => {
        const zone = this.scene.add.zone(this.x, this.y, 245, 150);
        this.scene.physics.add.existing(zone); zone.body.setAllowGravity(false);
        const struck = new Set();
        this.scene.physics.overlap(zone, this.scene.enemies, (_zone, enemy) => {
          if (struck.has(enemy) || !enemy.active) return;
          struck.add(enemy); const direction = Math.sign(enemy.x - this.x) || this.facing;
          enemy.takeDamage(2, direction, 440); this.scene.registerCombatHit?.(2);
        });
        this.scene.time.delayedCall(80, () => zone.destroy());
      },
      onComplete: () => pulse.destroy(),
    });
  }

  showDoubleJumpEffect() {
    const ring = this.scene.add.ellipse(this.x, this.y + 40, 48, 13).setStrokeStyle(3, 0xa6e4dd, 0.8);
    this.scene.tweens.add({ targets: ring, scaleX: 2.2, scaleY: 1.7, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
  }

  playLandingSquash() {
    if (this.isAttacking || this.isDodging) return;
    this.landingPoseUntil = this.scene.time.now + 125;
    this.rig.scaleY = 0.9;
    this.rig.y = 4;
    this.scene.tweens.add({ targets: this.rig, scaleY: 1, y: 0, duration: 125, ease: "Back.Out" });
  }

  createDodgeAfterimage() {
    const ghost = this.scene.add.rectangle(this.x - this.facing * 18, this.y - 3, 38, 82, 0x9ad7d1, 0.12).setDepth(5);
    ghost.setStrokeStyle(2, 0xc7efea, 0.22);
    this.scene.tweens.add({ targets: ghost, x: ghost.x - this.facing * 30, alpha: 0, scaleY: 0.8, duration: 210, onComplete: () => ghost.destroy() });
  }

  restoreEnergy(amount) { this.energy = Phaser.Math.Clamp(this.energy + amount, 0, this.maxEnergy); }
  restoreHealth(amount) { this.health = Phaser.Math.Clamp(this.health + amount, 0, this.maxHealth); }

  applyFreeze(duration = 650) {
    const now = this.scene.time.now;
    if (now < this.invulnerableUntil || this.isDodging || !this.active) return false;
    this.frozenUntil = Math.max(this.frozenUntil, now + duration);
    this.body.setVelocityX(0);
    const shell = this.scene.add.rectangle(this.x, this.y - 2, 54, 92, 0x9eeafa, 0.18)
      .setStrokeStyle(3, 0xc9f6ff, 0.72).setDepth(10);
    this.scene.tweens.add({ targets: shell, alpha: 0, duration, onComplete: () => shell.destroy() });
    return true;
  }

  applyPoison(ticks = 1, interval = 1100, sourceX = this.x) {
    if (this.isDodging || !this.active) return false;
    const token = ++this.poisonToken;
    for (let index = 1; index <= ticks; index += 1) {
      this.scene.time.delayedCall(interval * index, () => {
        if (!this.active || token !== this.poisonToken) return;
        const mist = this.scene.add.circle(this.x, this.y - 18, 26, 0x8bc65b, 0.2).setDepth(10);
        this.scene.tweens.add({ targets: mist, y: mist.y - 28, alpha: 0, duration: 420, onComplete: () => mist.destroy() });
        this.takeDamage(1, sourceX);
      });
    }
    return true;
  }

  takeDamage(amount, sourceX) {
    const now = this.scene.time.now;
    if (now < this.invulnerableUntil || this.isDodging || !this.active) return false;
    this.health = Math.max(0, this.health - amount); this.invulnerableUntil = now + 900;
    const direction = Math.sign(this.x - sourceX) || 1;
    this.body.setVelocity(direction * 360, -280); this.scene.cameras.main.shake(90, 0.006);
    this.scene.tweens.add({ targets: this, alpha: 0.25, duration: 90, repeat: 4, yoyo: true, onComplete: () => this.setAlpha(1) });
    if (this.health <= 0) this.scene.gameOver();
    return true;
  }

  getStats(time = this.scene.time.now) {
    return { health: this.health, maxHealth: this.maxHealth, stamina: this.stamina, maxStamina: this.maxStamina,
      energy: this.energy, maxEnergy: this.maxEnergy, skillCooldown: Math.max(0, this.skillReadyAt - time) };
  }
}
