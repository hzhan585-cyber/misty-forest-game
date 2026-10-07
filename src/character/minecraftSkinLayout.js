// Minecraft skin UV rectangles are expressed as [x, y, width, height].
// The renderer will use these definitions to crop front and side faces onto the 2D cuboid rig.
export const MODERN_64_LAYOUT = {
  head: { front: [8, 8, 8, 8], right: [0, 8, 8, 8], left: [16, 8, 8, 8], overlayFront: [40, 8, 8, 8] },
  body: { front: [20, 20, 8, 12], right: [16, 20, 4, 12], left: [28, 20, 4, 12], overlayFront: [20, 36, 8, 12] },
  rightArm: { front: [44, 20, 4, 12], right: [40, 20, 4, 12], left: [48, 20, 4, 12], overlayFront: [44, 36, 4, 12] },
  leftArm: { front: [36, 52, 4, 12], right: [32, 52, 4, 12], left: [40, 52, 4, 12], overlayFront: [52, 52, 4, 12] },
  rightLeg: { front: [4, 20, 4, 12], right: [0, 20, 4, 12], left: [8, 20, 4, 12], overlayFront: [4, 36, 4, 12] },
  leftLeg: { front: [20, 52, 4, 12], right: [16, 52, 4, 12], left: [24, 52, 4, 12], overlayFront: [4, 52, 4, 12] },
};

export const LEGACY_64_32_LAYOUT = {
  head: MODERN_64_LAYOUT.head,
  body: { front: [20, 20, 8, 12], right: [16, 20, 4, 12], left: [28, 20, 4, 12] },
  rightArm: { front: [44, 20, 4, 12], right: [40, 20, 4, 12], left: [48, 20, 4, 12] },
  leftArm: { front: [44, 20, 4, 12], right: [48, 20, 4, 12], left: [40, 20, 4, 12], mirror: true },
  rightLeg: { front: [4, 20, 4, 12], right: [0, 20, 4, 12], left: [8, 20, 4, 12] },
  leftLeg: { front: [4, 20, 4, 12], right: [8, 20, 4, 12], left: [0, 20, 4, 12], mirror: true },
};

export function getSkinLayout(width, height) {
  if (width === 64 && height === 32) return { type: "legacy", parts: LEGACY_64_32_LAYOUT };
  if (width === 64 && height === 64) return { type: "modern", parts: MODERN_64_LAYOUT };
  return null;
}
