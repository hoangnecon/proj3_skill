// EXEMPLAR cast from the episodes "Giỗ chia đất" + "Thang máy ăn bí mật".
// Read-only benchmark of how much character a Look carries. Episode shots must NOT use ex_* looks
// (lint fails) — design your own cast in src/cast.ts.
import type {Look} from '../chars';

export const EX_LOOKS: Record<string, Look> = {
  ex_ong: {name: 'ex_ong', ghost: true, top: 'aothe', topC: 'ghostDeep', topC2: 'white', pants: 'navy', hair: 'thin', hairC: 'white', hat: 'khanxep', hatC: 'navy', beard: 'long', beardC: 'white', brows: 'white', glasses: 'round', h: 1.0, head: 1.02},
  ex_ongPhoto: {name: 'ex_ongPhoto', top: 'aothe', topC: 'navy', topC2: 'white', pants: 'navy', hair: 'thin', hairC: 'white', hat: 'khanxep', hatC: 'navy', beard: 'long', beardC: 'white', brows: 'white', glasses: 'round'},
  ex_bacCa: {name: 'ex_bacCa', top: 'polo', topC: 'red', topC2: 'yellow', pants: 'navy', shoes: 'ink', hair: 'bald', mustache: true, chain: true, w: 1.22, belly: 1, head: 1.08},
  ex_coUt: {name: 'ex_coUt', top: 'blouse', topC: 'pink', pattern: 'dots', patC: 'yellow', pants: 'white', shoes: 'red', hair: 'curly', hairC: 'navy', glasses: 'sun', lips: true, earrings: true, w: 0.88},
  ex_bo: {name: 'ex_bo', top: 'shirt', topC: 'wallB', pants: 'blue', shoes: 'ink', hair: 'side', glasses: 'square', w: 0.86, h: 1.04},
  ex_congChung: {name: 'ex_congChung', top: 'suit', topC: 'blue', topC2: 'red', pants: 'navy', shoes: 'ink', hair: 'neat', glasses: 'square', w: 0.95},
  ex_diaChinh: {name: 'ex_diaChinh', top: 'uniform', topC: 'teal', pants: 'teal', shoes: 'ink', hair: 'short', hat: 'cap', hatC: 'teal', mustache: true},
  ex_diaChinhV: {name: 'ex_diaChinhV', top: 'uniform', topC: 'teal', pants: 'teal', shoes: 'ink', hair: 'short', hat: 'helmet', hatC: 'yellow', mustache: true, vest: true},
  ex_thayCung: {name: 'ex_thayCung', top: 'robe', topC: 'yellow', topC2: 'red', pants: 'red', hair: 'short', hat: 'band', hatC: 'red', beard: 'goatee', w: 0.95},
  ex_chef: {name: 'ex_chef', top: 'chef', topC: 'white', pants: 'navy', shoes: 'ink', hair: 'short', hat: 'chef', mustache: true, w: 1.05, belly: 0.4},
  ex_luatSu: {name: 'ex_luatSu', top: 'suit', topC: 'wood', topC2: 'yellow', pants: 'navy', shoes: 'ink', hair: 'neat', hairC: 'hairGrey', glasses: 'round', w: 0.92},
  // ---- tập Thang máy ----
  ex_tho: {name: 'ex_tho', top: 'uniform', topC: 'blue', pants: 'navy', shoes: 'wood', hair: 'short', hat: 'cap', hatC: 'navy', mustache: true, w: 1.0},
  ex_baHanh: {name: 'ex_baHanh', top: 'blouse', topC: 'pink', pattern: 'flowers', patC: 'yellow', pants: 'navy', shoes: 'white', hair: 'bun', hairC: 'hairGrey', glasses: 'round', earrings: true, w: 0.92, belly: 0.4},
  ex_anhToan: {name: 'ex_anhToan', top: 'tank', topC: 'white', pants: 'blue', shoes: 'red', hair: 'side', belly: 0.6, w: 1.02},
  ex_chu902: {name: 'ex_chu902', top: 'blouse', topC: 'teal', pattern: 'dots', patC: 'white', pants: 'wood', shoes: 'yellow', hair: 'curly', hairC: 'navy', w: 0.95},
  ex_cu: {name: 'ex_cu', top: 'tee', topC: 'yellow', pants: 'blue', shoes: 'red', hair: 'kid', w: 0.72, h: 0.7, head: 0.95},
  ex_ongBay: {name: 'ex_ongBay', top: 'shirt', topC: 'white', pants: 'navy', shoes: 'wood', hair: 'thin', hairC: 'white', glasses: 'square', mustache: true, beardC: 'white', brows: 'white', h: 0.95, w: 0.9},
  ex_conBay: {name: 'ex_conBay', top: 'polo', topC: 'teal', topC2: 'yellow', pants: 'navy', shoes: 'white', hair: 'neat', w: 1.08},
  ex_anhKhoa: {name: 'ex_anhKhoa', top: 'shirt', topC: 'pink', pattern: 'stripes', patC: 'white', pants: 'navy', shoes: 'white', hair: 'neat', chain: true, w: 0.98},
  ex_chiLan: {name: 'ex_chiLan', top: 'blouse', topC: 'red', pants: 'navy', shoes: 'white', hair: 'long', lips: true, earrings: true, w: 0.86},
  ex_banBM: {name: 'ex_banBM', top: 'suit', topC: 'wood', topC2: 'yellow', pants: 'navy', shoes: 'white', hair: 'neat', glasses: 'sun', mustache: true, chain: true, w: 1.05, belly: 0.5},
  ex_vo: {name: 'ex_vo', top: 'blouse', topC: 'yellow', pattern: 'dots', patC: 'red', pants: 'navy', shoes: 'red', hair: 'bun', w: 0.88},
  ex_chong: {name: 'ex_chong', top: 'shirt', topC: 'blue', pants: 'wood', shoes: 'white', hair: 'side', glasses: 'square', w: 0.98},
  ex_canBo: {name: 'ex_canBo', top: 'suit', topC: 'navy', topC2: 'red', pants: 'navy', shoes: 'wood', hair: 'neat', hairC: 'hairGrey', glasses: 'square', w: 1.0, belly: 0.5},
  ex_tho15: {name: 'ex_tho15', top: 'tee', topC: 'ink', pants: 'navy', shoes: 'white', hair: 'short', glasses: 'sun', w: 1.05},
  // họ hàng & hàng xóm
  ex_r1: {name: 'ex_r1', top: 'blouse', topC: 'yellow', pattern: 'flowers', patC: 'red', pants: 'navy', hair: 'bun', hairC: 'hairGrey', earrings: true, w: 0.9},
  ex_r2: {name: 'ex_r2', top: 'shirt', topC: 'blue', pattern: 'stripes', patC: 'trim', pants: 'navy', hair: 'short', w: 1.0},
  ex_r3: {name: 'ex_r3', top: 'tee', topC: 'orange', pants: 'blue', hair: 'long', w: 0.85},
  ex_r4: {name: 'ex_r4', top: 'tee', topC: 'teal', pants: 'navy', hair: 'kid', w: 0.75, h: 0.72, head: 0.95},
  ex_n1: {name: 'ex_n1', top: 'tank', topC: 'white', pants: 'blue', hair: 'thin', mustache: true, w: 0.95, belly: 0.6},
  ex_n2: {name: 'ex_n2', top: 'blouse', topC: 'teal', pattern: 'dots', patC: 'white', pants: 'navy', hair: 'bun', w: 0.9},
  ex_n3: {name: 'ex_n3', top: 'tee', topC: 'yellow', pants: 'navy', hair: 'short', hat: 'helmet', hatC: 'red', w: 0.95},
  ex_n4: {name: 'ex_n4', top: 'shirt', topC: 'pink', pants: 'blue', hair: 'long', w: 0.85},
  ex_n5: {name: 'ex_n5', top: 'tee', topC: 'red', pants: 'navy', hair: 'kid', w: 0.75, h: 0.72, head: 0.95},
  ex_n6: {name: 'ex_n6', top: 'polo', topC: 'blue', topC2: 'white', pants: 'navy', hair: 'thin', hairC: 'hairGrey', glasses: 'square', w: 0.95},
};
