import * as Phaser from "phaser";

const DARK = 0x071012;

function shade(color, amount) {
  const source = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    Phaser.Math.Clamp(source.red + amount, 0, 255),
    Phaser.Math.Clamp(source.green + amount, 0, 255),
    Phaser.Math.Clamp(source.blue + amount, 0, 255),
  );
}

function voxelBlock(scene, x, y, width, height, front, edge, depth = 4, seed = 0) {
  const block = scene.add.container(x, y);
  const top = scene.add.rectangle(depth * 0.5, -height * 0.5 - depth * 0.5, width, depth, shade(front, 22), 0.9)
    .setStrokeStyle(1, DARK, 0.9);
  const face = scene.add.rectangle(0, 0, width, height, front).setStrokeStyle(2, edge, 1);
  const side = scene.add.rectangle(width * 0.5 + depth * 0.5, depth * 0.5, depth, height, shade(front, -24), 0.95)
    .setStrokeStyle(1, edge, 0.72);
  block.add([top, face, side]);

  // Temporary code-generated texels make each cube read as a material surface.
  // Final art can replace these with pixel texture maps without changing the rig.
  const patchColor = shade(front, seed % 2 === 0 ? 18 : -17);
  const patchCount = Math.max(2, Math.floor(width / 15));
  for (let index = 0; index < patchCount; index += 1) {
    const patchWidth = 4 + ((seed + index * 3) % 5);
    const patchHeight = 3 + ((seed + index * 5) % 4);
    const px = -width * 0.34 + ((seed * 7 + index * 17) % Math.max(8, Math.floor(width * 0.68)));
    const py = -height * 0.28 + ((seed * 11 + index * 9) % Math.max(7, Math.floor(height * 0.56)));
    block.add(scene.add.rectangle(px, py, patchWidth, patchHeight, patchColor, 0.52));
  }
  return block;
}

function setSegment(segment, x1, y1, x2, y2, thickness) {
  if (segment.drawBetween) {
    segment.drawBetween(x1, y1, x2, y2);
    return;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  segment.setPosition((x1 + x2) * 0.5, (y1 + y2) * 0.5);
  // Each segment is created as a 1px-wide rectangle. Scaling from that fixed
  // geometry avoids Phaser accumulating display-size changes every animation frame.
  segment.setScale(Math.hypot(dx, dy), 1);
  segment.setRotation(Math.atan2(dy, dx));
}

function pixelBone(scene, thickness, front, edge, stroke) {
  const bone = scene.add.graphics();
  bone.drawBetween = (x1, y1, x2, y2) => {
    bone.clear();
    bone.lineStyle(thickness + stroke * 2, edge, 1);
    bone.lineBetween(x1, y1, x2, y2);
    bone.lineStyle(thickness, front, 1);
    bone.lineBetween(x1, y1, x2, y2);
  };
  return bone;
}

function articulatedLeg(scene, spec) {
  const leg = scene.add.container(0, 0);
  const footOverlay = scene.add.container(0, 0);
  const upper = pixelBone(scene, spec.thickness, spec.front, spec.edge, spec.stroke);
  const middle = pixelBone(scene, spec.thickness, shade(spec.front, -4), spec.edge, spec.stroke);
  const lower = pixelBone(scene, spec.thickness, shade(spec.front, -10), spec.edge, spec.stroke);
  const shoulder = scene.add.rectangle(0, 0, spec.thickness + 2, spec.thickness + 2, spec.edge)
    .setStrokeStyle(1, DARK, 0.9);
  const joint = scene.add.rectangle(0, 0, spec.thickness + 1, spec.thickness + 1, shade(spec.front, -6))
    .setStrokeStyle(1, spec.edge, 0.45)
    .setVisible(false);
  const foot = scene.add.rectangle(0, 0, spec.footWidth, Math.max(4, Math.round(spec.thickness * 0.7)), shade(spec.front, 34))
    .setStrokeStyle(2, shade(spec.edge, 58), 1);
  const sole = scene.add.rectangle(0, 0, spec.footWidth, 2, DARK, 0.9);
  leg.add([upper, middle, lower, shoulder, joint]);
  footOverlay.add([foot, sole]);
  leg.setAlpha(spec.alpha ?? 1);
  footOverlay.setAlpha(spec.alpha ?? 1);
  leg.footOverlay = footOverlay;
  leg.phaseOffset = spec.phaseOffset ?? 0;
  leg.spec = spec;

  leg.pose = (stride = 0, lift = 0) => {
    const direction = Math.sign(spec.footX - spec.attachX) || 1;
    const footX = spec.footX + stride;
    const footY = spec.footY - lift;
    const footHeight = Math.max(4, Math.round(spec.thickness * 0.7));
    const ankleX = footX - direction * spec.footWidth * 0.22;
    const ankleY = footY - footHeight * 0.5;
    const elbowX = spec.elbowX - stride * 0.08;
    const elbowY = spec.elbowY - lift * 0.12;
    const kneeX = spec.kneeX - stride * 0.18;
    const kneeY = spec.kneeY - lift * 0.3;
    setSegment(upper, spec.attachX, spec.attachY, elbowX, elbowY, spec.thickness);
    setSegment(middle, elbowX, elbowY, kneeX, kneeY, spec.thickness);
    // The shin terminates at the inner top edge of the foot. It never continues
    // through the foot centre, which previously looked like a spike in the ground.
    setSegment(lower, kneeX, kneeY, ankleX, ankleY, spec.thickness);
    shoulder.setPosition(elbowX, elbowY);
    joint.setPosition(kneeX, kneeY);
    foot.setPosition(footX, footY).setRotation(0);
    sole.setPosition(footX, footY + footHeight * 0.5 - 1).setRotation(0);
  };

  leg.animateStep = (time, moving, strideScale = 1) => {
    if (!moving) {
      leg.pose(0, Math.sin(time * 0.003 + leg.phaseOffset) * 0.45);
      return;
    }
    const wave = Math.sin(time * 0.018 + leg.phaseOffset);
    const stride = wave * 5.5 * strideScale;
    const lift = Math.max(0, Math.cos(time * 0.018 + leg.phaseOffset)) * 4.5 * strideScale;
    leg.pose(stride, lift);
  };

  leg.pose();
  return leg;
}

function createSpiderLegRig(scene, colors, scale = 1) {
  // Four lanes radiate from each visible side of the body. This follows the
  // broad arched stance in the moodboard instead of flattening every leg into
  // one side-view plane.
  const lanes = [
    { hip: 13, attachY: -16, shoulder: 31, shoulderY: -19, knee: 52, kneeY: -4, foot: 72, footY: 20 },
    { hip: 11, attachY: -12, shoulder: 27, shoulderY: -13, knee: 47, kneeY: 1, foot: 62, footY: 20 },
    { hip: 9, attachY: -8, shoulder: 24, shoulderY: -8, knee: 42, kneeY: 5, foot: 52, footY: 20 },
    { hip: 8, attachY: -11, shoulder: 21, shoulderY: -14, knee: 35, kneeY: 0, foot: 44, footY: 20 },
  ];
  const farLegs = [];
  const nearLegs = [];
  const feet = [];
  const rightLegs = [];

  lanes.forEach((lane, laneIndex) => {
    [-1, 1].forEach((side) => {
      const isFar = laneIndex === 1 || laneIndex === 2;
      const depthOffset = isFar ? -2 * scale : 1.5 * scale;
      const leg = articulatedLeg(scene, {
        attachX: side * lane.hip * scale,
        attachY: lane.attachY * scale + depthOffset,
        elbowX: side * lane.shoulder * scale,
        elbowY: lane.shoulderY * scale + depthOffset,
        kneeX: side * lane.knee * scale,
        kneeY: lane.kneeY * scale + depthOffset,
        footX: side * lane.foot * scale,
        footY: lane.footY * scale,
        thickness: colors.thickness,
        footWidth: colors.footWidth,
        front: isFar ? shade(colors.front, -24) : colors.front,
        edge: isFar ? shade(colors.edge, -28) : colors.edge,
        stroke: colors.stroke,
        alpha: isFar ? 0.58 : 1,
        phaseOffset: laneIndex * Math.PI * 0.5 + (side > 0 ? Math.PI : 0),
      });
      if (isFar) farLegs.push(leg); else nearLegs.push(leg);
      feet.push(leg.footOverlay);
      if (side > 0) rightLegs.push(leg);
    });
  });

  return {
    farLegs,
    nearLegs,
    legs: [...farLegs, ...nearLegs],
    feet,
    // The rig is authored facing left, so its positive-X legs are the rear pair.
    hindLegs: [rightLegs[0], rightLegs[3]],
  };
}

function addVariantDetails(scene, type, config) {
  let hairs = null;
  let mark = null;
  if (type === "parasitic") {
    mark = scene.add.container(10, -30);
    [-14, 0, 14].forEach((x, index) => mark.add(scene.add.rectangle(x, -index * 2, 7, 16 + index * 4, 0x4f8f67)
      .setStrokeStyle(2, 0xa0d28e).setAngle(index === 0 ? -18 : index === 2 ? 18 : 0)));
  } else if (type === "cow") {
    mark = scene.add.container(2, -13);
    mark.add([
      scene.add.rectangle(10, -3, 15, 10, 0xd7ddd4).setStrokeStyle(1, 0x65716c),
      scene.add.rectangle(-9, 6, 11, 8, 0xd7ddd4).setStrokeStyle(1, 0x65716c),
      scene.add.rectangle(-30, 5, 7, 7, 0xd7ddd4),
    ]);
  } else if (type === "frost") {
    mark = scene.add.container(10, -31);
    [-14, 0, 14].forEach((x, index) => mark.add(scene.add.rectangle(x, index === 1 ? -4 : 0, 8, index === 1 ? 22 : 16, 0x8fd7e8, 0.82)
      .setStrokeStyle(2, 0xd3f6ff).setAngle(index === 0 ? -14 : index === 2 ? 14 : 0)));
  } else if (type === "hair") {
    hairs = scene.add.container(10, -29);
    for (let index = 0; index < 7; index += 1) {
      hairs.add(scene.add.rectangle(-21 + index * 7, -Math.abs(index - 3) * 1.5, 4, 19, 0xa98261)
        .setStrokeStyle(1, 0xe0bd8b).setAngle((index - 3) * 8));
    }
  } else if (type === "widow") {
    mark = scene.add.container(12, -13);
    mark.add([
      scene.add.rectangle(0, -5, 11, 11, 0xb53649).setAngle(45).setStrokeStyle(1, 0xef6a72),
      scene.add.rectangle(0, 6, 9, 9, 0x7f2636).setAngle(45),
    ]);
  }
  return { hairs, mark };
}

export function createSpiderVisual(scene, type, config) {
  const model = scene.add.container(0, 0);
  const shadow = scene.add.rectangle(0, 29, 176, 10, 0x000000, 0.34);
  const legLayers = createSpiderLegRig(scene, { front: config.body, edge: config.edge, thickness: 6, footWidth: 15, stroke: 2 });
  const abdomenWidth = type === "widow" ? 48 : type === "cow" ? 40 : 44;
  const abdomenHeight = type === "frost" ? 28 : type === "hair" ? 34 : 31;
  const bodyPart = voxelBlock(scene, 11, -13, abdomenWidth, abdomenHeight, config.body, config.edge, 5, 2);
  const thorax = voxelBlock(scene, -11, -10, 19, 23, config.body, config.edge, 4, 5);
  const head = voxelBlock(scene, -29, -8, 25, 23, config.body, config.edge, 4, 8);
  const eyeA = scene.add.rectangle(-35, -12, 6, 6, config.eye).setStrokeStyle(1, 0xf7f0d3, 0.45);
  const eyeB = scene.add.rectangle(-25, -12, 6, 6, config.eye).setStrokeStyle(1, 0xf7f0d3, 0.45);
  const mouth = scene.add.rectangle(-30, 0, 13, 4, DARK).setStrokeStyle(1, config.edge, 0.7);
  const details = addVariantDetails(scene, type, config);

  model.add(legLayers.farLegs);
  model.add([bodyPart, thorax, head, mouth]);
  if (details.hairs) model.add(details.hairs);
  if (details.mark) model.add(details.mark);
  model.add([eyeA, eyeB]);
  model.add(legLayers.nearLegs);
  model.add(legLayers.feet);
  return {
    model, shadow, bodyPart, head, eyeA, eyeB,
    legs: legLayers.legs,
    hindLegs: legLayers.hindLegs,
    ...details,
  };
}

export function createKingSpiderVisual(scene) {
  const model = scene.add.container(0, 0);
  const shadow = scene.add.rectangle(0, 53, 390, 18, 0x000000, 0.38);
  const legLayers = createSpiderLegRig(scene, { front: 0x24272b, edge: 0x874c4e, thickness: 13, footWidth: 34, stroke: 3 }, 2.15);
  const abdomen = voxelBlock(scene, 38, -34, 98, 64, 0x211d24, 0x78434a, 8, 3);
  const bodyPart = voxelBlock(scene, -31, -29, 70, 52, 0x181c20, 0x693b43, 7, 7);
  const head = voxelBlock(scene, -78, -20, 48, 44, 0x11171a, 0x744049, 6, 11);
  const eyeA = scene.add.rectangle(-91, -27, 10, 10, 0xe14c4c).setStrokeStyle(2, 0xffb277, 0.55);
  const eyeB = scene.add.rectangle(-74, -27, 10, 10, 0xe14c4c).setStrokeStyle(2, 0xffb277, 0.55);
  const fangs = scene.add.container(-87, 5);
  fangs.add([
    scene.add.rectangle(-9, 4, 8, 18, 0x9d8b78).setStrokeStyle(2, 0x372a28),
    scene.add.rectangle(9, 4, 8, 18, 0x9d8b78).setStrokeStyle(2, 0x372a28),
  ]);
  const crown = scene.add.container(-76, -76);
  crown.add([
    scene.add.rectangle(0, 15, 58, 12, 0xa47a35).setStrokeStyle(3, 0xe0b75b),
    scene.add.rectangle(-22, 1, 11, 28, 0xb68b3e).setStrokeStyle(2, 0xe7c56b),
    scene.add.rectangle(0, -6, 12, 42, 0xc09241).setStrokeStyle(2, 0xf0d276),
    scene.add.rectangle(22, 2, 11, 26, 0xb68b3e).setStrokeStyle(2, 0xe7c56b),
  ]);
  const royalMark = scene.add.container(49, -34);
  royalMark.add([
    scene.add.rectangle(0, 0, 30, 30, 0x6f2633).setAngle(45).setStrokeStyle(3, 0xd05b55),
    scene.add.rectangle(0, 0, 12, 12, 0xcf9545).setAngle(45),
  ]);

  model.add(legLayers.farLegs);
  model.add([abdomen, bodyPart, head, royalMark, fangs, eyeA, eyeB, crown]);
  model.add(legLayers.nearLegs);
  model.add(legLayers.feet);
  return { model, shadow, abdomen, bodyPart, head, eyeA, eyeB, crown, legs: legLayers.legs };
}
