export const ROOM_WIDTH = 1700;
export const EXPLORATION_PER_AREA = 25;
export const FINAL_GATE_REQUIREMENT = 75;
export const HIDDEN_ENTRANCE_AREA = "webbed-grove";

export const AREA_DEFINITIONS = [
  {
    id: "forest-entrance",
    name: "森林入口",
    subtitle: "Forest Entrance",
    accent: 0xd6a24d,
    fogColor: 0x183b3b,
    enemies: [{ x: 620, type: "parasitic" }, { x: 980, type: "parasitic" }],
    leftExit: null,
    rightExit: "deep-woods",
  },
  {
    id: "deep-woods",
    name: "深处林地",
    subtitle: "Deep Forest",
    accent: 0x64a49d,
    fogColor: 0x173438,
    enemies: [{ x: 500, type: "parasitic" }, { x: 850, type: "frost" }, { x: 1220, type: "parasitic" }],
    leftExit: "forest-entrance",
    rightExit: "webbed-grove",
  },
  {
    id: "webbed-grove",
    name: "蜘蛛活动区",
    subtitle: "Web-Infested Zone",
    accent: 0x9aa7bf,
    fogColor: 0x202e38,
    enemies: [{ x: 470, type: "hair" }, { x: 760, type: "widow" }, { x: 1080, type: "frost" }, { x: 1370, type: "parasitic" }],
    leftExit: "deep-woods",
    rightExit: "abandoned-caravan",
  },
  {
    id: "abandoned-caravan",
    name: "破损商队",
    subtitle: "Wrecked Caravan",
    accent: 0xb8825f,
    fogColor: 0x2f3433,
    enemies: [{ x: 560, type: "widow" }, { x: 930, type: "hair" }, { x: 1280, type: "widow" }],
    leftExit: "webbed-grove",
    rightExit: null,
  },
  {
    id: "king-spider-nest",
    name: "国王蜘蛛巢",
    subtitle: "King Spider's Nest",
    accent: 0xb9514f,
    fogColor: 0x291b24,
    enemies: [],
    leftExit: null,
    rightExit: null,
    isBossArea: true,
  },
];

export function getArea(areaId) {
  return AREA_DEFINITIONS.find((area) => area.id === areaId) ?? AREA_DEFINITIONS[0];
}

export function createRunState() {
  return {
    cleared: {},
    defeated: {},
    exploration: 0,
    hiddenEntranceUnlocked: false,
    bossDefeated: false,
  };
}
