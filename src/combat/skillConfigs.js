export const BASE_PULSE_SKILL = {
  id: "energy-pulse",
  name: "能量脉冲",
  manaCost: 30,
  cooldownMs: 1100,
  maxCharges: 1,
  chargeTimeMs: 0,
  requiresCondition: false,
  killEffectMode: "none",
};

// Future character skills can reuse the same fields while changing behavior:
// - chargeTimeMs > 0: charged skill
// - killEffectMode: skill strengthened or refreshed by kills
// - cooldownMs = 0 and requiresCondition = true: conditional skill
// - maxCharges > 1: stored multi-use skill
