const STORAGE_KEY = "misty-forest-player-skin-v1";

export function getSavedSkin() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSkin(skin) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(skin));
}

export function clearSavedSkin() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function chooseSkinFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const image = await loadImage(dataUrl);
        if (!((image.width === 64 && image.height === 32) || (image.width === 64 && image.height === 64))) {
          throw new Error("仅支持 64×32 或 64×64 的 Minecraft PNG 皮肤");
        }
        resolve({ dataUrl, width: image.width, height: image.height, name: file.name, model: "classic" });
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

export function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取皮肤图片"));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("无法读取所选文件"));
    reader.readAsDataURL(file);
  });
}

export function createCheckerSkin() {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 64, 64);
  const faces = [
    [8, 8, 8, 8, "#ef6461", "#7f252b"], [0, 8, 8, 8, "#d94b4b", "#64202a"], [16, 8, 8, 8, "#ff9a62", "#8c3f31"],
    [20, 20, 8, 12, "#4f8bd6", "#244878"], [16, 20, 4, 12, "#376cae", "#183457"], [28, 20, 4, 12, "#69a7ee", "#2e5687"],
    [44, 20, 4, 12, "#58bd79", "#23613a"], [40, 20, 4, 12, "#3e945b", "#17472a"], [48, 20, 4, 12, "#82d79b", "#39784a"],
    [36, 52, 4, 12, "#b369d1", "#5b2d70"], [32, 52, 4, 12, "#8c4baa", "#402052"], [40, 52, 4, 12, "#d597e8", "#704485"],
    [4, 20, 4, 12, "#e5bd4e", "#795d20"], [0, 20, 4, 12, "#bd9636", "#594313"], [8, 20, 4, 12, "#f1d471", "#89722d"],
    [20, 52, 4, 12, "#4fc4c6", "#22666b"], [16, 52, 4, 12, "#32999f", "#174d52"], [24, 52, 4, 12, "#81dfe0", "#3b7d7e"],
  ];
  faces.forEach(([x, y, width, height, a, b]) => paintChecker(context, x, y, width, height, a, b));
  context.fillStyle = "rgba(255,255,255,0.65)";
  context.fillRect(40, 8, 8, 1); context.fillRect(40, 15, 8, 1);
  context.fillRect(20, 36, 8, 1); context.fillRect(20, 47, 8, 1);
  return { dataUrl: canvas.toDataURL("image/png"), width: 64, height: 64, name: "UV 彩色测试皮肤", model: "classic" };
}

function paintChecker(context, x, y, width, height, colorA, colorB) {
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      context.fillStyle = (px + py) % 2 === 0 ? colorA : colorB;
      context.fillRect(x + px, y + py, 1, 1);
    }
  }
}
