const LANGUAGE_KEY = "misty-forest-language-v1";
const CHARACTER_KEY = "misty-forest-character-v1";

const COPY = {
  zh: {
    title: "《晨曦传记：迷雾森林》", subtitle: "DAWN BIOGRAPHY: MISTY FOREST", tagline: "横版动作探索 · 多区域灰盒",
    chooseCharacter: "选择角色", customCharacter: "自定义皮肤角色", customCharacterDetail: "当前测试角色 · 可使用本地 Minecraft 皮肤",
    futureCharacter: "角色槽位 02", hiddenCharacter: "隐藏角色", comingLater: "后续版本开放", locked: "尚未解锁", selected: "已选择",
    importSkin: "导入本地皮肤", testSkin: "UV 测试皮肤", resetSkin: "恢复白模", currentSkin: "当前皮肤：{name}", whiteRig: "无皮肤白模",
    readingSkin: "正在读取皮肤……", savedSkin: "已保存：{name}（{width}×{height}）", skinError: "皮肤读取失败", checkerEnabled: "已启用 UV 彩色测试皮肤",
    start: "开始探索", startHint: "点击按钮或按空格", controls: "A/D 移动 · W/空格 跳跃 · 左键/J 攻击 · Shift/右键 闪避 · 中键/K 技能", languageButton: "ENGLISH",
    enterArea: "进入区域：{area}", health: "生命", stamina: "体力", energy: "技能", ready: "就绪",
    finalBattle: "最终区域 · 首领战", areaClear: "区域已清空", enemiesLeft: "剩余敌人：{count}", exploration: "探索度 {value}%",
    objectiveBoss: "目标：击败国王蜘蛛", objectiveExplore: "目标：探索度达到 {value}%", objectiveFollow: "隐藏入口：跟随金色指引", objectiveGoWeb: "隐藏入口：前往蜘蛛活动区",
    guideGoWeb: "{direction} 前往蜘蛛活动区寻找隐藏入口", hiddenEntranceLeft: "← 隐藏入口", hiddenEntranceRight: "隐藏入口 →", hiddenEntranceDown: "↓ 隐藏入口",
    energyReward: "+15 技能能量", summonedEnergyReward: "+8 技能能量", healthReward: "+1 生命", gateDiscovered: "发现异常震动：蜘蛛活动区出现隐藏入口",
    hiddenGate: "隐藏入口\n国王蜘蛛巢", gateAppeared: "隐藏入口已经显现", areaClearTitle: "{area} · 区域已清空",
    areaClearDetail: "探索度 +{value}% · 技能能量恢复 · 生命恢复 1", bossName: "国王蜘蛛",
    endingTitle: "结局 A · 迷雾出口", endingDetail: "国王蜘蛛已经倒下，封锁森林的蛛网开始消散\n你在遗迹深处找到了一条离开迷雾森林的道路",
    failedTitle: "探索失败", failedDetail: "按 R 从森林入口重新开始",
  },
  en: {
    title: "DAWN BIOGRAPHY: MISTY FOREST", subtitle: "A MISTY FOREST CHRONICLE", tagline: "SIDE-SCROLLING ACTION · MULTI-AREA PROTOTYPE",
    chooseCharacter: "SELECT CHARACTER", customCharacter: "Custom Skin Adventurer", customCharacterDetail: "Current test character · Supports local Minecraft skins",
    futureCharacter: "Character Slot 02", hiddenCharacter: "Hidden Character", comingLater: "Coming in a later build", locked: "Not yet unlocked", selected: "SELECTED",
    importSkin: "Import Local Skin", testSkin: "UV Test Skin", resetSkin: "Restore White Rig", currentSkin: "Current skin: {name}", whiteRig: "White test rig",
    readingSkin: "Reading skin...", savedSkin: "Saved: {name} ({width}×{height})", skinError: "Could not read the skin", checkerEnabled: "UV checker skin enabled",
    start: "BEGIN EXPLORATION", startHint: "Click the button or press Space", controls: "A/D Move · W/Space Jump · LMB/J Attack · Shift/RMB Dodge · MMB/K Skill", languageButton: "中文",
    enterArea: "Entering: {area}", health: "HP", stamina: "STAMINA", energy: "SKILL", ready: "READY",
    finalBattle: "FINAL AREA · BOSS BATTLE", areaClear: "AREA CLEARED", enemiesLeft: "Enemies remaining: {count}", exploration: "Exploration {value}%",
    objectiveBoss: "Objective: Defeat the King Spider", objectiveExplore: "Objective: Reach {value}% exploration", objectiveFollow: "Hidden entrance: Follow the golden guide", objectiveGoWeb: "Hidden entrance: Travel to the Web-Infested Zone",
    guideGoWeb: "{direction} Find the hidden entrance in the Web-Infested Zone", hiddenEntranceLeft: "← Hidden Entrance", hiddenEntranceRight: "Hidden Entrance →", hiddenEntranceDown: "↓ Hidden Entrance",
    energyReward: "+15 Skill Energy", summonedEnergyReward: "+8 Skill Energy", healthReward: "+1 Health", gateDiscovered: "A strange tremor: a hidden entrance opened in the Web-Infested Zone",
    hiddenGate: "HIDDEN ENTRANCE\nKING SPIDER'S NEST", gateAppeared: "The hidden entrance has appeared", areaClearTitle: "{area} · AREA CLEARED",
    areaClearDetail: "+{value}% Exploration · Skill energy restored · Health +1", bossName: "KING SPIDER",
    endingTitle: "ENDING A · EXIT FROM THE MIST", endingDetail: "The King Spider has fallen and the webs sealing the forest begin to fade.\nDeep in the ruins, you discover a path out of the Misty Forest.",
    failedTitle: "EXPEDITION FAILED", failedDetail: "Press R to restart from the Forest Entrance",
  },
};

export function getLanguage() {
  try { return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh"; } catch { return "zh"; }
}
export function setLanguage(language) {
  try { localStorage.setItem(LANGUAGE_KEY, language === "en" ? "en" : "zh"); } catch { /* unavailable */ }
}
export function t(language, key, values = {}) {
  const template = COPY[language]?.[key] ?? COPY.zh[key] ?? key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
}
export function getSelectedCharacter() {
  try { return localStorage.getItem(CHARACTER_KEY) ?? "custom"; } catch { return "custom"; }
}
export function setSelectedCharacter(characterId) {
  try { localStorage.setItem(CHARACTER_KEY, characterId); } catch { /* unavailable */ }
}
