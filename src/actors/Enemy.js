import * as Phaser from "phaser";

const RELEASE_WARNING_LEAD_MS = 280;

const ARCHETYPES = {
  parasitic: { zh: "砷铅铁寄生蛛", en: "PARASITIC SPIDER", role: "lunge", health: 4, speed: 78, body: 0x1a2627, edge: 0x55706d, eye: 0xe34e4e, bar: 0xc66558, scale: 1 },
  cow: { zh: "奶牛蜘蛛", en: "COW SPIDER", role: "hop", health: 2, speed: 124, body: 0x111817, edge: 0x4d785c, eye: 0x67ed72, bar: 0x73cf7c, scale: 0.82 },
  frost: { zh: "冰霜蜘蛛", en: "FROST SPIDER", role: "freeze", health: 1, speed: 62, body: 0x263b49, edge: 0x89c9df, eye: 0x78e8ff, bar: 0x7fcce2, scale: 1.06 },
  hair: { zh: "毛蜘蛛", en: "HAIR SPIDER", role: "hazard", health: 6, speed: 54, body: 0x342923, edge: 0x9a7254, eye: 0xe2a35e, bar: 0xb78258, scale: 1.14 },
  widow: { zh: "黑寡妇蜘蛛", en: "BLACK WIDOW", role: "poison", health: 4, speed: 145, body: 0x17151c, edge: 0xa13d54, eye: 0xff5368, bar: 0xd14c62, scale: 0.88 },
};

export class Enemy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, id, areaId, type = "parasitic") {
    super(scene, x, y);
    this.enemyId = id; this.areaId = areaId; this.type = ARCHETYPES[type] ? type : "parasitic";
    this.config = ARCHETYPES[this.type];
    this.maxHealth = this.config.health; this.health = this.maxHealth;
    this.state = "chase"; this.stateUntil = 0; this.facing = -1; this.attackToken = 0;
    this.attackDirectionLocked = false; this.lockedAttackDirection = -1; this.lockedTarget = null;
    scene.add.existing(this); scene.physics.add.existing(this);

    this.shadow = scene.add.ellipse(0, 25, 58, 13, 0x000000, 0.4);
    this.bodyPart = scene.add.ellipse(0, 4, 45, 30, this.config.body).setStrokeStyle(2, this.config.edge);
    this.head = scene.add.circle(-25, 7, 14, this.config.body).setStrokeStyle(2, this.config.edge);
    this.eyeA = scene.add.circle(-30, 3, 3, this.config.eye);
    this.eyeB = scene.add.circle(-21, 3, 3, this.config.eye);
    this.legs = [];
    for (let i = 0; i < 4; i += 1) {
      const yOffset = -5 + i * 8;
      const leftLeg = scene.add.rectangle(-26, yOffset, 30, 4, this.config.edge).setOrigin(1, 0.5);
      const rightLeg = scene.add.rectangle(26, yOffset, 30, 4, this.config.edge).setOrigin(0, 0.5);
      leftLeg.rotation = -0.5 + i * 0.27; rightLeg.rotation = 0.5 - i * 0.27;
      this.legs.push(leftLeg, rightLeg);
    }
    if (this.type === "hair") {
      this.hairs = scene.add.graphics(); this.hairs.lineStyle(2, 0xc49a70, 0.8);
      for (let xOffset = -18; xOffset <= 18; xOffset += 9) this.hairs.lineBetween(xOffset, -8, xOffset * 1.45, -25 - Math.abs(xOffset) * 0.2);
    }
    if (this.type === "widow") {
      this.mark = scene.add.rectangle(8, 3, 13, 13, 0xc63f51).setAngle(45);
    }
    this.healthBack = scene.add.rectangle(0, -37, 56, 7, 0x071010, 0.9);
    this.healthFill = scene.add.rectangle(-27, -37, 54, 5, this.config.bar).setOrigin(0, 0.5);
    this.nameLabel = scene.add.text(0, -55, scene.language === "en" ? this.config.en : this.config.zh, {
      fontFamily: '"Microsoft YaHei", sans-serif', fontSize: "10px", color: "#c9d8d5", stroke: "#061013", strokeThickness: 3,
    }).setOrigin(0.5);
    this.add([this.shadow, ...this.legs, this.bodyPart, this.hairs, this.mark, this.head, this.eyeA, this.eyeB, this.healthBack, this.healthFill, this.nameLabel].filter(Boolean));
    this.setScale(this.config.scale);
    this.body.setSize(58, 48); this.body.setOffset(-29, -24);
    this.body.setCollideWorldBounds(true); this.body.setMaxVelocity(520, 900);
  }

  update(time, player) {
    if (!this.active || !this.body || !player.active) return;
    this.guardAgainstTerrainSeams();
    const distance = player.x - this.x; const absoluteDistance = Math.abs(distance);
    if (!this.attackDirectionLocked) this.facing = Math.sign(distance) || this.facing;
    this.scaleX = (this.facing < 0 ? 1 : -1) * this.config.scale;

    if (this.state === "stagger" || this.state === "recover") {
      if (time >= this.stateUntil) { this.state = "chase"; this.attackDirectionLocked = false; }
      else { this.animateLegs(time, false); return; }
    }
    if (this.state === "windup") { this.body.setVelocityX(0); this.animateLegs(time, false); return; }

    if (this.config.role === "freeze" || this.config.role === "hazard") {
      this.updateRangedMovement(time, player, distance, absoluteDistance);
    } else {
      const attackRange = this.config.role === "poison" ? 125 : 96;
      if (absoluteDistance <= attackRange) this.startAttack(time, player);
      else if (absoluteDistance < 560) this.body.setVelocityX(this.facing * this.config.speed);
      else this.body.setVelocityX(0);
    }
    this.animateLegs(time, Math.abs(this.body.velocity.x) > 10);
  }

  updateRangedMovement(time, player, distance, absoluteDistance) {
    const preferred = this.config.role === "freeze" ? 315 : 250;
    if (absoluteDistance < preferred - 80) this.body.setVelocityX(-this.facing * this.config.speed);
    else if (absoluteDistance > preferred + 100 && absoluteDistance < 600) this.body.setVelocityX(this.facing * this.config.speed);
    else this.body.setVelocityX(0);
    if (absoluteDistance < 590 && time >= this.stateUntil) this.startAttack(time, player);
  }

  startAttack(time, player) {
    if (this.state !== "chase" || time < this.stateUntil) return;
    if (this.config.role === "freeze") this.startFreezeWeb(player);
    else if (this.config.role === "hazard") this.startHairHazard(player);
    else if (this.config.role === "poison") this.startPoisonDash(player);
    else if (this.config.role === "hop") this.startLunge(player, 440, 375, -220, 92, 540);
    else this.startLunge(player, 650, 290, -90, 112, 650);
  }

  beginWindup(windup, color = 0xffd071) {
    this.state = "windup"; this.body.setVelocityX(0); this.attackDirectionLocked = false;
    this.eyeA.setFillStyle(color); this.eyeB.setFillStyle(color);
    this.showGatherFlash(color);
    return ++this.attackToken;
  }

  lockAttack(player) {
    this.lockedAttackDirection = this.facing;
    this.lockedTarget = { x: player.x, y: player.y };
    this.attackDirectionLocked = true;
  }

  startLunge(player, windup, speed, lift, hitRange, recovery) {
    const token = this.beginWindup(windup);
    const lead = Math.min(RELEASE_WARNING_LEAD_MS, windup - 140);
    this.scene.time.delayedCall(windup - lead, () => {
      if (!this.isAttackValid(token)) return;
      this.lockAttack(player); this.showAttackFlash(0xffedaa);
    });
    this.scene.time.delayedCall(windup, () => {
      if (!this.isAttackValid(token)) return;
      this.body.setVelocity(this.lockedAttackDirection * speed, lift);
      let hit = false;
      [45, 115, 185].forEach((delay) => this.scene.time.delayedCall(delay, () => {
        if (hit || !this.isAttackValid(token)) return;
        if (Math.abs(player.x - this.x) < hitRange && Math.abs(player.y - this.y) < 90) {
          hit = true; player.takeDamage(1, this.x);
        }
      }));
      this.finishAttack(recovery);
    });
  }

  startFreezeWeb(player) {
    const windup = 860; const token = this.beginWindup(windup, 0x9de8ff);
    this.scene.time.delayedCall(windup - RELEASE_WARNING_LEAD_MS, () => {
      if (!this.isAttackValid(token)) return;
      this.lockAttack(player); this.showAttackFlash(0xc8f4ff);
      const marker = this.scene.add.circle(this.lockedTarget.x, this.lockedTarget.y, 26, 0x8eddf2, 0.08)
        .setStrokeStyle(3, 0xbfefff, 0.72).setDepth(8);
      this.scene.tweens.add({ targets: marker, alpha: 0, duration: RELEASE_WARNING_LEAD_MS + 160, onComplete: () => marker.destroy() });
    });
    this.scene.time.delayedCall(windup, () => {
      if (!this.isAttackValid(token)) return;
      this.fireFreezeProjectile(player, this.lockedTarget);
      this.finishAttack(1050);
    });
  }

  fireFreezeProjectile(player, target) {
    const bolt = this.scene.add.rectangle(this.x, this.y, 34, 18, 0xb9eff7, 0.9)
      .setStrokeStyle(2, 0xe9fcff).setDepth(9);
    const startX = this.x; const startY = this.y;
    const dx = target.x - startX; const dy = target.y - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const endX = startX + (dx / distance) * 680; const endY = startY + (dy / distance) * 680;
    let hit = false;
    this.scene.tweens.add({
      targets: bolt, x: endX, y: endY, duration: 720, ease: "Linear",
      onUpdate: () => {
        if (hit || !bolt.active || !player.active) return;
        if (Phaser.Math.Distance.Between(bolt.x, bolt.y, player.x, player.y) < 42) {
          hit = player.applyFreeze(680); if (hit) bolt.destroy();
        }
      },
      onComplete: () => { if (bolt.active) bolt.destroy(); },
    });
  }

  startHairHazard(player) {
    const windup = 760; const token = this.beginWindup(windup, 0xc6a263);
    this.scene.time.delayedCall(windup - RELEASE_WARNING_LEAD_MS, () => {
      if (!this.isAttackValid(token)) return;
      this.lockAttack(player); this.showAttackFlash(0xe5c47a);
      const groundY = this.scene.getTerrainTopAt(this.lockedTarget.x);
      this.hazardWarning = this.scene.add.rectangle(this.lockedTarget.x, groundY - 6, 158, 16, 0xb7cf62, 0.16)
        .setStrokeStyle(3, 0xe3ed91, 0.82).setDepth(8);
    });
    this.scene.time.delayedCall(windup, () => {
      if (!this.isAttackValid(token)) return;
      const warning = this.hazardWarning;
      this.hazardWarning = null;
      this.kickHairProjectile(this.lockedTarget.x, warning);
      this.finishAttack(1450);
    });
  }

  kickHairProjectile(targetX, warning) {
    const hindLegs = this.legs.slice(-2);
    hindLegs.forEach((leg, index) => {
      this.scene.tweens.add({ targets: leg, rotation: leg.rotation + (index === 0 ? -0.75 : 0.75), duration: 95, yoyo: true, ease: "Back.Out" });
    });

    const startX = this.x - this.lockedAttackDirection * 28;
    const startY = this.y - 2;
    const groundY = this.scene.getTerrainTopAt(targetX);
    const endY = groundY - 24;
    const projectile = this.scene.add.container(startX, startY).setDepth(10);
    const core = this.scene.add.circle(0, 0, 10, 0x9fb85c, 0.75).setStrokeStyle(2, 0xe0e99a, 0.9);
    const hairs = this.scene.add.graphics();
    hairs.lineStyle(2, 0xd8d98a, 0.82);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      hairs.lineBetween(Math.cos(angle) * 5, Math.sin(angle) * 5, Math.cos(angle) * 18, Math.sin(angle) * 18);
    }
    projectile.add([hairs, core]);

    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: 680, ease: "Linear",
      onUpdate: (tween) => {
        const progress = tween.getValue();
        projectile.x = Phaser.Math.Linear(startX, targetX, progress);
        projectile.y = Phaser.Math.Linear(startY, endY, progress) - Math.sin(Math.PI * progress) * 185;
        projectile.rotation += 0.14;
      },
      onComplete: () => {
        warning?.destroy(); projectile.destroy(); this.createToxicZone(targetX);
      },
    });
  }

  createToxicZone(targetX) {
    const groundY = this.scene.getTerrainTopAt(targetX);
    const cloud = this.scene.add.rectangle(targetX, groundY - 30, 170, 58, 0x667c3f, 0.28)
      .setStrokeStyle(3, 0xaec967, 0.72).setDepth(7);
    const spikes = this.scene.add.graphics().setDepth(8);
    spikes.fillStyle(0x34452c, 0.9);
    spikes.fillRect(targetX - 84, groundY - 10, 168, 10);
    spikes.fillStyle(0x93aa58, 0.42);
    spikes.fillRect(targetX - 76, groundY - 14, 152, 5);
    for (let offset = -74; offset <= 74; offset += 10) {
      const height = 22 + Math.abs((offset * 7) % 30);
      const lean = (Math.floor((offset + 74) / 10) % 2 === 0 ? -1 : 1) * (7 + Math.abs(offset % 9));
      spikes.lineStyle(3, 0xc1cf78, 0.95);
      spikes.lineBetween(targetX + offset, groundY - 8, targetX + offset + lean, groundY - 8 - height);
      spikes.lineStyle(1, 0xf0eda7, 0.82);
      spikes.lineBetween(targetX + offset + 2, groundY - 10, targetX + offset + lean + 2, groundY - 8 - height);
    }
    const zone = this.scene.add.zone(targetX, groundY - 42, 164, 84);
    this.scene.physics.add.existing(zone, true);
    const collider = this.scene.physics.add.overlap(this.scene.player, zone, () => this.scene.player.takeDamage(1, targetX));
    this.scene.tweens.add({ targets: cloud, alpha: { from: 0.12, to: 0.34 }, duration: 360, yoyo: true, repeat: 3 });
    this.scene.tweens.add({ targets: spikes, alpha: { from: 0.72, to: 1 }, duration: 280, yoyo: true, repeat: 4 });
    this.scene.time.delayedCall(2800, () => { collider.destroy(); zone.destroy(); cloud.destroy(); spikes.destroy(); });
  }

  startPoisonDash(player) {
    const windup = 520; const token = this.beginWindup(windup, 0xff6680);
    this.scene.time.delayedCall(windup - 230, () => {
      if (!this.isAttackValid(token)) return;
      this.lockAttack(player); this.showAttackFlash(0xff8b9c);
    });
    this.scene.time.delayedCall(windup, () => {
      if (!this.isAttackValid(token)) return;
      this.body.setVelocityX(this.lockedAttackDirection * 455);
      let hit = false;
      [35, 90, 145].forEach((delay) => this.scene.time.delayedCall(delay, () => {
        if (hit || !this.isAttackValid(token)) return;
        if (Math.abs(player.x - this.x) < 108 && Math.abs(player.y - this.y) < 86) {
          hit = true;
          if (player.takeDamage(1, this.x)) player.applyPoison(1, 1100, this.x);
        }
      }));
      this.scene.time.delayedCall(190, () => { if (this.active) this.body.setVelocityX(-this.lockedAttackDirection * 175); });
      this.finishAttack(760);
    });
  }

  finishAttack(recovery) {
    this.state = "recover"; this.stateUntil = this.scene.time.now + recovery;
    this.eyeA.setFillStyle(this.config.eye); this.eyeB.setFillStyle(this.config.eye);
  }

  isAttackValid(token) { return this.active && this.state !== "dead" && token === this.attackToken; }

  showGatherFlash(color) {
    const gather = this.scene.add.circle(this.x, this.y, 68, color, 0.04).setStrokeStyle(4, color, 0.72).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: gather, scaleX: 0.25, scaleY: 0.25, alpha: 0.9, duration: 250, ease: "Cubic.In", onComplete: () => gather.destroy() });
  }

  showAttackFlash(color) {
    const flash = this.scene.add.circle(this.x, this.y, 42, color, 0.3).setStrokeStyle(5, 0xffffff, 0.95).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, scaleX: 1.45, scaleY: 1.45, alpha: 0, duration: 105, ease: "Cubic.Out", onComplete: () => flash.destroy() });
  }

  animateLegs(time, moving) {
    const scuttle = moving ? Math.sin(time * 0.018 + this.enemyId) * 1.4 : 0;
    this.legs.forEach((leg, index) => { leg.y = -5 + Math.floor(index / 2) * 8 + (index % 2 === 0 ? scuttle : -scuttle); });
  }

  guardAgainstTerrainSeams() {
    const terrainTop = this.scene.getTerrainTopAt?.(this.x) ?? 630;
    const bodyHalfHeight = this.body.height * 0.5;
    if (this.y + bodyHalfHeight <= terrainTop + 18 && this.y < 690) return;
    this.setPosition(this.x, terrainTop - bodyHalfHeight - 1);
    this.body.setVelocityY(0); this.body.updateFromGameObject();
  }

  takeDamage(amount, direction, knockback = 280) {
    if (!this.active) return;
    this.attackToken += 1; this.health -= amount; this.attackDirectionLocked = false;
    this.hazardWarning?.destroy(); this.hazardWarning = null;
    this.state = "stagger"; this.stateUntil = this.scene.time.now + 180;
    this.eyeA.setFillStyle(this.config.eye); this.eyeB.setFillStyle(this.config.eye);
    this.body.setVelocity(direction * knockback, -150);
    this.healthFill.scaleX = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    this.scene.tweens.add({ targets: [this.bodyPart, this.head], alpha: 0.25, duration: 55, yoyo: true });
    if (this.health <= 0) this.die();
  }

  die() {
    if (!this.active) return;
    this.state = "dead"; this.attackToken += 1; this.body.enable = false;
    this.hazardWarning?.destroy(); this.scene.enemyDefeated(this);
    this.scene.tweens.add({ targets: this, alpha: 0, scaleY: 0.25, duration: 240, onComplete: () => this.destroy() });
  }
}
