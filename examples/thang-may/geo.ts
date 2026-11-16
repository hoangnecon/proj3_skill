// Hình học thuần (không import React) — shotlist và script node dùng được.
export const wallTop = (x: number) => 560 - (x - 830) * 1.04;
export const wallBot = (x: number) => 1500 + (x - 830) * 1.2;
export const onWall = (x: number, v: number): [number, number] => [x, wallTop(x) + v * (wallBot(x) - wallTop(x))];
/** toạ độ nút tầng n trên bảng (0 = hầm) — dùng cho tay với bấm */
export const carBtn = (n: number): [number, number] => {
  if (n === 0) return onWall(915, 0.74);
  const c = (n - 1) % 2;
  const row = 8 - Math.floor((n - 1) / 2);
  return onWall(895 + c * 42, 0.34 + row * 0.042);
};

export const CORR_Y = 1650;

export const STAIR = {x0: 80, y0: 1760, x1: 900, y1: 1268};
export const stairY = (x: number) => (x <= STAIR.x0 ? STAIR.y0 : x >= STAIR.x1 ? STAIR.y1 : STAIR.y0 + ((x - STAIR.x0) / (STAIR.x1 - STAIR.x0)) * (STAIR.y1 - STAIR.y0));

export const FLH = 92;
export const BLD = {x0: 230, x1: 850, ground: 1700, shaft0: 500, shaft1: 580};
export const floorY = (f: number) => BLD.ground - (f + 1) * FLH; // đỉnh sàn tầng f (0 = sảnh)
