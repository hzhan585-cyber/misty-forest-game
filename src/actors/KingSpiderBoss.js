import * as Phaser from "phaser";
import { createKingSpiderVisual } from "./SpiderVisual.js";

const RELEASE_LEAD_MS = 280;

export class KingSpiderBoss extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.maxHealth = 24;
    this.health = 24;
    this.state = "idle";
    this.stateUntil = scene.time.now + 1100;
    this.facing = -1;
    this.attackIndex = 0;
    this.attackToken = 0;
    this.attackDirectionLocked = false;
    this.lockedAttackDirection = -1;
    this.attackHitDone = false;
    this.summonStage = 0;

    const visual = createKingSpiderVisual(scene);
    this.model = visual.model; this.shadow = visual.shadow;
    this.abdomen = visual.abdomen; this.bodyPart = visual.bodyPart; this.head = visual.head;
    this.eyeA = visual.eyeA; this.eyeB = visual.eyeB; this.crown = visual.crown; this.legs = visual.legs;
    this.add([this.shadow, this.model]);
    this.body.setSize(170, 105);
    this.body.setOffset(-85, -52);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(520, 900);
  }

  update(time, player) {
    if (!this.active || !this.body || !player.active || this.state === "dead") return;
    if (!this.attackDirectionLocked) this.facing = Math.sign(player.x - this.x) || this.facing;
    this.model.scaleX = this.facing < 0 ? 1 : -1;
    this.animateLegs(time);

    if (this.state !== "idle") {
      if (this.state === "recover" && time >= this.stateUntil) {
        this.state = "idle";
        this.attackDirectionLocked = false;
        this.stateUntil = time + (this.health <= this.maxHealth / 2 ? 430 : 650);
      }
      return;
    }
    this.body.setVelocityX(Phaser.Math.Linear(this.body.velocity.x, 0, 0.18));
    if (time < this.stateUntil) return;

    const attacks = ["lunge", "web", "sweep"];
    const nextAttack = attacks[this.attackIndex % attacks.length];
    this.attackIndex += 1;
    if (nextAttack === "lunge") this.startLunge(player);
    if (nextAttack === "web") this.startWebFall(player);
    if (nextAttack === "sweep") this.startSweep(player);
  }

  startLunge(player) {
    const windup = this.health <= this.maxHealth / 2 ? 690 : 780;
    const token = this.beginAttack(windup);
    this.showGatherFlash(108);
    this.scene.time.delayedCall(windup - RELEASE_LEAD_MS, () => {
      if (!this.isAttackValid(token)) return;
      this.lockDirection();
      this.showReleaseFlash(115, 0xffd17a);
    });
    this.scene.time.delayedCall(windup, () => {
      if (!this.isAttackValid(token)) return;
      this.attackHitDone = false;
      this.body.setVelocityX(this.lockedAttackDirection * 500);
      [0, 70, 140].forEach((delay) => this.scene.time.delayedCall(delay, () => this.tryLungeHit(player, token)));
      this.finishAttackAfter(420);
    });
  }

  tryLungeHit(player, token) {
    if (!this.isAttackValid(token) || this.attackHitDone) return;
    if (Math.abs(player.x - this.x) < 145 && Math.abs(player.y - this.y) < 105) {
      this.attackHitDone = true;
      player.takeDamage(1, this.x);
    }
  }

  startWebFall(player) {
    const windup = 820;
    const token = this.beginAttack(windup);
    this.showGatherFlash(120, 0xb8dbe1);
    const targets = [Phaser.Math.Clamp(player.x, 190, 1510)];
    if (this.health <= this.maxHealth / 2) targets.push(Phaser.Math.Clamp(player.x + (player.x < this.x ? -175 : 175), 150, 1550));
    targets.forEach((targetX) => this.createWebWarning(targetX, windup, token, player));
    this.scene.time.delayedCall(windup - RELEASE_LEAD_MS, () => {
      if (this.isAttackValid(token)) this.showReleaseFlash(125, 0xc8edf1);
    });
    this.scene.time.delayedCall(windup, () => {
      if (!this.isAttackValid(token)) return;
      this.finishAttackAfter(520);
    });
  }

  createWebWarning(targetX, delay, token, player) {
    const warning = this.scene.add.rectangle(targetX, 610, 104, 18, 0x9bd9dc, 0.18)
      .setStrokeStyle(3, 0xd3f3f2, 0.82).setDepth(7);
    this.scene.tweens.add({ targets: warning, alpha: 0.72, duration: 180, yoyo: true, repeat: 2 });
    this.scene.time.delayedCall(delay, () => {
      if (!this.isAttackValid(token)) { warning.destroy(); return; }
      warning.destroy();
      const web = this.scene.add.rectangle(targetX, 395, 88, 430, 0xb8dadd, 0.24)
        .setStrokeStyle(4, 0xe2f1f0, 0.8).setDepth(8);
      const lines = this.scene.add.graphics().setDepth(9);
      lines.lineStyle(3, 0xd9eeee, 0.72);
      for (let offset = -36; offset <= 36; offset += 18) lines.lineBetween(targetX + offset, 190, targetX - offset, 610);
      if (Math.abs(player.x - targetX) < 58 && player.y > 405) player.takeDamage(1, targetX);
      this.scene.time.delayedCall(150, () => { web.destroy(); lines.destroy(); });
    });
  }

  startSweep(player) {
    const windup = 720;
    const token = this.beginAttack(windup);
    this.showGatherFlash(155, 0xe29476);
    const warning = this.scene.add.circle(this.x, this.y + 18, 175, 0xb74a43, 0.08)
      .setStrokeStyle(5, 0xe88d73, 0.58).setDepth(7);
    this.scene.tweens.add({ targets: warning, alpha: 0.3, scaleX: 1.08, scaleY: 1.08, duration: windup - 60 });
    this.scene.time.delayedCall(windup - RELEASE_LEAD_MS, () => {
      if (!this.isAttackValid(token)) return;
      this.lockDirection();
      this.showReleaseFlash(170, 0xff9c7c);
    });
    this.scene.time.delayedCall(windup, () => {
      warning.destroy();
      if (!this.isAttackValid(token)) return;
      const sweep = this.scene.add.rectangle(this.x, this.y + 12, 350, 42, 0xe36b58, 0.38).setDepth(8);
      const playerIsLow = player.y > this.y - 70;
      if (Math.abs(player.x - this.x) < 185 && playerIsLow) player.takeDamage(1, this.x);
      this.scene.tweens.add({ targets: sweep, alpha: 0, scaleX: 1.15, duration: 180, onComplete: () => sweep.destroy() });
      this.finishAttackAfter(470);
    });
  }

  beginAttack(windup = 720) {
    this.state = "windup";
    this.body.setVelocityX(0);
    this.attackDirectionLocked = false;
    this.eyeA.setFillStyle(0xffcf62); this.eyeB.setFillStyle(0xffcf62);
    this.scene.tweens.killTweensOf(this.model);
    this.scene.tweens.add({ targets: this.model, y: 9, scaleY: 0.84, duration: Math.min(310, windup * 0.45), ease: "Cubic.Out" });
    return ++this.attackToken;
  }

  lockDirection() {
    this.lockedAttackDirection = this.facing;
    this.attackDirectionLocked = true;
  }

  finishAttackAfter(duration) {
    this.state = "recover";
    this.stateUntil = this.scene.time.now + duration;
    this.eyeA.setFillStyle(0xe14c4c); this.eyeB.setFillStyle(0xe14c4c);
    this.scene.tweens.add({ targets: this.model, y: 0, scaleY: 1, duration: 230, ease: "Back.Out" });
  }

  animateLegs(time) {
    const moving = Math.abs(this.body.velocity.x) > 35;
    this.legs.forEach((leg) => leg.animateStep?.(time, moving, 1.2));
  }

  isAttackValid(token) { return this.active && this.state !== "dead" && token === this.attackToken; }

  showGatherFlash(radius, color = 0xffc966) {
    const ring = this.scene.add.circle(this.x, this.y, radius, color, 0.025).setStrokeStyle(5, color, 0.75).setDepth(8);
    this.scene.tweens.add({ targets: ring, scaleX: 0.18, scaleY: 0.18, alpha: 0.9, duration: 280, ease: "Cubic.In", onComplete: () => ring.destroy() });
  }

  showReleaseFlash(radius, color) {
    const flash = this.scene.add.circle(this.x, this.y, radius, color, 0.22).setStrokeStyle(7, 0xffffff, 0.9).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, scaleX: 1.32, scaleY: 1.32, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
  }

  takeDamage(amount, direction) {
    if (!this.active || this.state === "dead") return;
    this.health = Math.max(0, this.health - amount);
    this.body.setVelocityX(this.body.velocity.x + direction * 45);
    this.scene.updateBossHealth(this.health, this.maxHealth);
    this.scene.tweens.add({ targets: [this.abdomen, this.bodyPart, this.head], alpha: 0.28, duration: 55, yoyo: true });
    const reachedStage = this.health <= 8 ? 2 : this.health <= 16 ? 1 : 0;
    while (this.summonStage < reachedStage) {
      this.summonStage += 1;
      this.scene.summonCowSpiders?.(this.x, 2);
    }
    if (this.health <= 0) this.die();
  }

  die() {
    this.state = "dead";
    this.attackToken += 1;
    this.body.enable = false;
    this.scene.bossDefeated(this);
    this.scene.tweens.add({ targets: this, alpha: 0, scaleX: 1.25, scaleY: 0.2, duration: 700, onComplete: () => this.destroy() });
  }
}
