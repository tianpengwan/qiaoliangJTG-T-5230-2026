// =====================================================================
// JTG/T 5230—2026《公路桥梁技术状况评定标准》——桥型/部件/权重/评定模板
// 依据：第 3 章基本规定、第 4~15 章评定标度、附录 B 部件组成及评定参数
// 标准数据表（表4.1.2~表15.1.2）见 std5230_data.js
// =====================================================================
const DATA = require("./std5230_data");

const STANDARD = {
  code: "JTG/T 5230—2026",
  name: "公路桥梁技术状况评定标准",
  issued: "2026-08-26",
  effective: "2026-11-01",
};

const BRIDGE_TYPES = ["梁桥", "拱桥", "组合体系拱桥", "悬索桥", "斜拉桥"];
const PARTS = ["桥面系", "上部结构", "下部结构", "附属构造"];

// 构件材料类别（第 4 章）：耐久性缺损按材料分别评定
const MATERIALS = {
  concrete: { name: "配筋混凝土构件", tables: ["4.1.2", "4.1.3"] },
  steel: { name: "钢构件", tables: ["4.2.2", "4.2.3"] },
  masonry: { name: "圬工构件", tables: ["4.3.2"] },
};

function table(id) {
  return DATA[id] || null;
}
function tableLabel(id) {
  const t = table(id);
  return t ? t.title.replace(/评定$/, "") : id;
}

// 构件类型字典：structural 为可选的结构性缺损评定表，efi 为功能状况评定表
const COMPONENT_CATALOG = {
  deck_pavement: {
    label: "桥面铺装", unit: "跨", materials: ["concrete"],
    structural: ["5.2.1", "5.2.2"], defaultStructural: "5.2.1", efi: "14.2.2",
  },
  expansion: {
    label: "伸缩装置", unit: "道", materials: ["steel"],
    structural: ["5.3.1", "5.3.2", "5.3.3", "5.3.4"], defaultStructural: "5.3.2", efi: "14.2.3",
  },
  railing: {
    label: "护栏及人行道", unit: "跨", materials: ["concrete", "steel"],
    structural: ["5.4.1", "5.4.2", "5.4.3", "5.4.4", "5.4.5", "5.5.1", "5.5.2"],
    defaultStructural: "5.4.1", efi: "14.2.4",
  },
  drainage: {
    label: "排水系统", unit: "跨", materials: ["concrete", "steel"],
    structural: ["5.6.1"], defaultStructural: "5.6.1", efi: "14.2.5",
  },
  slab: {
    label: "实心板/空心板", unit: "片", materials: ["concrete"],
    structural: ["6.2.1", "6.2.2", "6.2.3", "6.2.4", "6.2.5"], defaultStructural: "6.2.4",
    efi: "14.3.2", major: true,
  },
  hinge: {
    label: "铰缝", unit: "道", materials: ["concrete"],
    structural: ["6.3.1"], defaultStructural: "6.3.1", efi: "14.3.3",
  },
  girder: {
    label: "主梁", unit: "片", materials: ["concrete", "steel"],
    structural: ["6.2.6", "6.2.7", "6.2.8", "6.2.9", "6.2.10", "6.2.11", "6.2.12", "6.2.13", "6.2.14", "6.2.15", "6.2.16"],
    defaultStructural: "6.2.7", efi: "14.3.2", major: true,
  },
  box_girder: {
    label: "箱梁", unit: "跨", materials: ["concrete"],
    structural: ["6.2.9", "6.2.10", "6.2.11"], defaultStructural: "6.2.10",
    efi: "14.3.2", major: true,
  },
  steel_girder: {
    label: "钢主梁", unit: "跨", materials: ["steel"],
    structural: ["6.2.12", "6.2.13", "6.2.14", "6.2.15"], defaultStructural: "6.2.12",
    efi: "14.3.2", major: true,
  },
  deck_slab: {
    label: "桥面板", unit: "跨", materials: ["concrete"],
    structural: ["6.2.1", "6.2.2", "6.2.3", "6.2.4", "6.2.5", "7.4.9"], defaultStructural: "6.2.4",
    efi: "14.3.2", major: true,
  },
  diaphragm: {
    label: "横隔板", unit: "道", materials: ["concrete", "steel"],
    structural: ["6.3.2", "6.3.3", "7.5.1"], defaultStructural: "6.3.2", efi: "14.3.3",
  },
  lateral: {
    label: "横向联系", unit: "道", materials: ["concrete", "steel"],
    structural: ["6.3.2", "6.3.3", "6.3.4", "7.5.1", "7.5.2", "7.5.3", "8.3.1", "8.3.2"],
    defaultStructural: "6.3.3", efi: "14.3.3",
  },
  bearing: {
    label: "支座", unit: "个", materials: ["steel"],
    structural: ["6.4.1", "6.4.2", "6.4.3", "6.4.4", "6.4.5"], defaultStructural: "6.4.1",
    efi: "14.3.5", major: true,
  },
  arch_ring: {
    label: "主拱圈", unit: "跨", materials: ["concrete", "masonry", "steel"],
    structural: ["7.2.1", "7.2.2", "7.2.3", "7.2.4", "7.2.5", "7.2.6", "7.2.9", "7.2.10", "7.2.11"],
    defaultStructural: "7.2.3", efi: "14.3.2", major: true,
  },
  arch_rib: {
    label: "拱肋", unit: "道", materials: ["concrete", "steel"],
    structural: ["7.2.4", "7.2.9", "7.2.10"], defaultStructural: "7.2.4", efi: "14.3.2", major: true,
  },
  arch_box: {
    label: "拱箱", unit: "跨", materials: ["concrete"],
    structural: ["7.2.5"], defaultStructural: "7.2.5", efi: "14.3.2", major: true,
  },
  side_wall: {
    label: "侧墙", unit: "跨", materials: ["concrete", "masonry"],
    structural: ["7.3.5", "7.3.6"], defaultStructural: "7.3.6", efi: "14.3.2",
  },
  spandrel_pier_wall: {
    label: "腹拱墩和侧墙", unit: "道", materials: ["concrete", "masonry"],
    structural: ["7.3.1", "7.3.2", "7.3.3", "7.3.4", "7.3.5", "7.3.6"],
    defaultStructural: "7.3.2", efi: "14.3.2", major: true,
  },
  spandrel_arch: {
    label: "腹拱圈或桥面板", unit: "跨", materials: ["concrete", "masonry"],
    structural: ["7.4.1", "7.4.2", "7.4.9", "6.2.1", "6.2.2", "6.2.3", "6.2.4", "6.2.5"],
    defaultStructural: "7.4.2", efi: "14.3.2", major: true,
  },
  truss_arch: {
    label: "桁架拱片", unit: "片", materials: ["concrete"],
    structural: ["7.2.7"], defaultStructural: "7.2.7", efi: "14.3.2", major: true,
  },
  frame_arch: {
    label: "刚架拱片", unit: "组", materials: ["concrete"],
    structural: ["7.2.8"], defaultStructural: "7.2.8", efi: "14.3.2", major: true,
  },
  tie_rod_steel: {
    label: "系杆索", unit: "组", materials: ["steel"],
    structural: ["8.4.3"], defaultStructural: "8.4.3", efi: "14.3.4", major: true,
  },
  tie_rod_concrete: {
    label: "系杆", unit: "道", materials: ["concrete"],
    structural: ["6.2.6", "6.2.7"], defaultStructural: "6.2.7", efi: "14.3.2", major: true,
  },
  suspender: {
    label: "吊索或立柱", unit: "根（道）", materials: ["steel", "concrete"],
    structural: ["8.5.1", "8.5.2", "7.3.2", "7.3.3", "7.3.4"], defaultStructural: "8.5.2",
    efi: "14.3.4", major: true,
  },
  cross_beam: {
    label: "横梁、纵梁及桥面板", unit: "跨", materials: ["concrete", "steel"],
    structural: ["8.6.2", "8.6.3", "8.6.4", "8.6.5", "8.6.6", "6.2.1", "6.2.2", "6.2.3", "6.2.4", "6.2.5"],
    defaultStructural: "8.6.3", efi: "14.3.2", major: true,
  },
  stiffening_girder: {
    label: "加劲梁", unit: "段", materials: ["steel", "concrete"],
    structural: ["6.2.10", "6.2.12", "6.2.13", "6.2.14", "6.2.15"], defaultStructural: "6.2.12",
    efi: "14.3.2", major: true,
  },
  suspender_clamp: {
    label: "吊索及索夹", unit: "根（套）", materials: ["steel"],
    structural: ["9.3.1", "9.3.2", "9.3.3"], defaultStructural: "9.3.1", efi: "14.3.4", major: true,
  },
  main_cable: {
    label: "主缆", unit: "根", materials: ["steel"],
    structural: ["9.4.1", "9.4.2"], defaultStructural: "9.4.2", efi: "14.3.4", major: true,
  },
  tower_saddle: {
    label: "索塔及索鞍", unit: "座", materials: ["concrete", "steel"],
    structural: ["9.5.1", "9.5.2", "9.5.3"], defaultStructural: "9.5.1", efi: "14.3.2", major: true,
  },
  anchor_system: {
    label: "锚固系统", unit: "套", materials: ["steel"],
    structural: ["9.7.1", "11.5.4"], defaultStructural: "9.7.1", efi: "14.3.2", major: true,
  },
  anchorage: {
    label: "锚碇及锚固系统", unit: "座", materials: ["concrete"],
    structural: ["11.5.1", "11.5.2", "11.5.3", "11.5.4"], defaultStructural: "11.5.1",
    efi: "14.3.2", major: true,
  },
  cable: {
    label: "斜拉索", unit: "根", materials: ["steel"],
    structural: ["10.3.1", "10.3.2"], defaultStructural: "10.3.1", efi: "14.3.4", major: true,
  },
  main_girder: {
    label: "主梁", unit: "段", materials: ["concrete", "steel"],
    structural: ["6.2.7", "6.2.10", "6.2.12", "6.2.13", "6.2.15"], defaultStructural: "6.2.10",
    efi: "14.3.2", major: true,
  },
  tower: {
    label: "索塔", unit: "座", materials: ["concrete", "steel"],
    structural: ["9.5.1", "9.5.2"], defaultStructural: "9.5.1", efi: "14.3.2", major: true,
  },
  bearing_constraint: {
    label: "支座及约束体系", unit: "套", materials: ["steel"],
    structural: ["6.4.1", "6.4.2", "6.4.3", "6.4.4", "6.4.5", "9.6.2"],
    defaultStructural: "6.4.1", efi: "14.3.5", major: true,
  },
  pier_abutment: {
    label: "桥墩或桥台", unit: "个", materials: ["concrete", "masonry"],
    structural: ["11.2.1", "11.2.2", "11.2.3", "11.2.4", "11.3.1", "11.3.2", "11.3.3"],
    defaultStructural: "11.2.2", efi: "14.4.2", major: true,
  },
  foundation: {
    label: "墩台基础", unit: "个", materials: ["concrete", "masonry"],
    structural: ["11.4.1", "11.4.2", "11.4.3", "11.4.4"], defaultStructural: "11.4.2",
    efi: "14.4.3", major: true,
  },
  river: {
    label: "河床及调治构造物", unit: "跨", materials: ["masonry", "concrete"],
    structural: ["12.2.1", "12.2.2"], defaultStructural: "12.2.1", efi: "14.5.2",
  },
  wing: {
    label: "翼墙、锥坡、护坡", unit: "处", materials: ["masonry", "concrete"],
    structural: ["12.3.1"], defaultStructural: "12.3.1", efi: "14.5.3",
  },
  other: {
    label: "其他附属设施", unit: "跨", materials: ["concrete", "steel"],
    structural: ["12.4.1"], defaultStructural: "12.4.1", efi: "14.5.4",
  },
};

// 生成部件定义
function cmp(key, weight, overrides = {}) {
  const c = COMPONENT_CATALOG[key];
  if (!c) throw new Error("未知构件类型: " + key);
  return {
    key,
    name: overrides.name || c.label,
    weight,
    material: overrides.material || c.materials[0],
    materials: c.materials,
    structural: c.structural,
    defaultStructural: overrides.structural || c.defaultStructural,
    efi: overrides.efi || c.efi,
    is_major: overrides.major !== undefined ? overrides.major : !!c.major,
    unit: overrides.unit || c.unit,
  };
}

function parts(deck, upper, lower, ancillary) {
  return { 桥面系: deck, 上部结构: upper, 下部结构: lower, 附属构造: ancillary };
}

// 标准桥面系（含伸缩装置）
const DECK_FULL = [
  ["deck_pavement", 40], ["expansion", 25], ["railing", 20], ["drainage", 15],
];
// 实腹式板拱桥（无伸缩装置）
const DECK_ARCH_SOLID = [["deck_pavement", 50], ["railing", 30], ["drainage", 20]];
// 附属构造
const ANCILLARY = [["river", 35], ["wing", 35], ["other", 30]];
const ANCILLARY_CABLE = [["river", 25], ["wing", 25], ["other", 50]];

function build(list) {
  return list.map(([k, w, o]) => cmp(k, w, o));
}

// 附录 B 表 B.2.2~B.6.3：桥型结构形式、影响系数 γ、部件权重 ω
const STRUCTURE_FORMS = {
  "整体式板桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.40, 下部结构: 0.40, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["slab", 75], ["bearing", 25]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "整体式实心板桥、整体式空心板桥；每跨板梁划分为 1 个构件。",
  },
  "装配式板桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.40, 下部结构: 0.40, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["slab", 60], ["hinge", 25], ["bearing", 15]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "装配式实心板桥、装配式空心板桥；每片板梁划分为 1 个构件。",
  },
  "装配式组合箱梁桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.42, 下部结构: 0.38, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["girder", 55], ["diaphragm", 20], ["bearing", 25]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每片梁划分为 1 个构件；设置横隔板的，每道横隔板划分为 1 个构件。",
  },
  "装配式肋梁桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.42, 下部结构: 0.38, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["girder", 55], ["diaphragm", 20], ["bearing", 25]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "T 梁、Ⅰ形梁、Ⅱ形梁、矩形梁等；每片梁划分为 1 个构件。",
  },
  "整体现浇箱梁桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.45, 下部结构: 0.40, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["box_girder", 70], ["bearing", 30]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每跨划分为 1 个构件。",
  },
  "悬臂浇筑箱梁桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.45, 下部结构: 0.40, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["box_girder", 70], ["bearing", 30]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "主梁按施工节段划分，节段连接处缺损计入靠近桥墩一侧节段。",
  },
  "钢及钢-混凝土组合梁桥": {
    bridgeType: "梁桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.50, 下部结构: 0.35, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["steel_girder", 45], ["deck_slab", 25], ["lateral", 10], ["bearing", 20]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "钢箱梁、钢桁梁、钢板梁和钢-混凝土组合梁；主梁和桥面板每跨 1 个构件。",
  },

  "实腹式板拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.45, 下部结构: 0.40, 附属构造: 0.05 },
    parts: parts(
      build(DECK_ARCH_SOLID),
      build([["arch_ring", 70], ["side_wall", 30]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "主拱圈每跨划分为 1 个构件。",
  },
  "空腹式板拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.45, 下部结构: 0.35, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_ring", 55], ["spandrel_pier_wall", 20], ["spandrel_arch", 25]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "主拱圈每跨划分为 1 个构件。",
  },
  "肋拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.48, 下部结构: 0.32, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_rib", 50], ["lateral", 10], ["spandrel_pier_wall", 20], ["spandrel_arch", 20]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "矩形、工字形、箱形等截面肋拱桥；每道拱肋划分为 1 个构件。",
  },
  "箱形拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.42, 下部结构: 0.38, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_box", 55], ["spandrel_pier_wall", 20], ["spandrel_arch", 25]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "主拱圈每跨划分为 1 个构件。",
  },
  "双曲拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.48, 下部结构: 0.32, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_ring", 50], ["lateral", 10], ["spandrel_pier_wall", 20], ["spandrel_arch", 20]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "主拱圈每跨划分为 1 个构件。",
  },
  "桁架拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.45, 下部结构: 0.35, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["truss_arch", 50], ["lateral", 20], ["deck_slab", 30]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每个桁架拱片划分为 1 个构件。",
  },
  "刚架拱桥": {
    bridgeType: "拱桥",
    gamma: { 桥面系: 0.15, 上部结构: 0.45, 下部结构: 0.35, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["frame_arch", 50], ["lateral", 20], ["deck_slab", 30]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每组刚架拱片划分为 1 个构件。",
  },

  "无系杆组合体系拱桥": {
    bridgeType: "组合体系拱桥",
    gamma: { 桥面系: 0.12, 上部结构: 0.53, 下部结构: 0.30, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_rib", 35], ["lateral", 10], ["suspender", 30], ["cross_beam", 25]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每道拱肋、每道纵梁、每跨桥面板各划分为 1 个构件。",
  },
  "柔性系杆组合体系拱桥": {
    bridgeType: "组合体系拱桥",
    gamma: { 桥面系: 0.12, 上部结构: 0.55, 下部结构: 0.28, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_rib", 20], ["tie_rod_steel", 20], ["lateral", 10], ["suspender", 30], ["cross_beam", 15], ["bearing", 5]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每道拱肋、每组系杆索、每道纵梁、每跨桥面板各划分为 1 个构件。",
  },
  "刚性系杆组合体系拱桥": {
    bridgeType: "组合体系拱桥",
    gamma: { 桥面系: 0.12, 上部结构: 0.53, 下部结构: 0.30, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["arch_rib", 25], ["tie_rod_concrete", 10], ["lateral", 10], ["suspender", 35], ["cross_beam", 15], ["bearing", 5]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY)
    ),
    note: "每道拱肋、每道系杆、每道纵梁、每跨桥面板各划分为 1 个构件。",
  },

  "自锚式悬索桥": {
    bridgeType: "悬索桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.55, 下部结构: 0.30, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["stiffening_girder", 20], ["suspender_clamp", 20], ["main_cable", 20], ["tower_saddle", 20], ["anchor_system", 10], ["bearing_constraint", 10]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY_CABLE)
    ),
    note: "加劲梁每两个吊点之间划分为 1 个构件；索塔与主索鞍作为 1 个构件。",
  },
  "地锚式悬索桥": {
    bridgeType: "悬索桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.50, 下部结构: 0.35, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["stiffening_girder", 20], ["suspender_clamp", 25], ["main_cable", 25], ["tower_saddle", 20], ["bearing_constraint", 10]]),
      build([["pier_abutment", 36], ["foundation", 24], ["anchorage", 40]]),
      build(ANCILLARY_CABLE)
    ),
    note: "加劲梁每两个吊点之间划分为 1 个构件；锚碇及锚固系统作为 1 个构件。",
  },
  "斜拉桥": {
    bridgeType: "斜拉桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.55, 下部结构: 0.30, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["main_girder", 30], ["cable", 35], ["tower", 25], ["bearing_constraint", 10]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY_CABLE)
    ),
    note: "主梁每两个吊点之间划分为 1 个构件。",
  },
  "部分斜拉桥": {
    bridgeType: "斜拉桥",
    gamma: { 桥面系: 0.10, 上部结构: 0.55, 下部结构: 0.30, 附属构造: 0.05 },
    parts: parts(
      build(DECK_FULL),
      build([["main_girder", 35], ["cable", 30], ["tower", 25], ["bearing_constraint", 10]]),
      build([["pier_abutment", 60], ["foundation", 40]]),
      build(ANCILLARY_CABLE)
    ),
    note: "主梁每两个吊点之间划分为 1 个构件。",
  },
};

// 第 3.4.5 条：16 条全桥 5 类单项控制指标
const FIVE_CLASS_INDICATORS = [
  "落梁或梁板断裂。",
  "主梁控制截面全截面开裂。",
  "组合结构主梁结合面贯通开裂，组合作用失效。",
  "主梁明显永久变形，变形大于规范值并伴随严重开裂。",
  "拱桥主拱圈严重变形。",
  "圬工拱桥主拱圈砌体大范围断裂、脱落。",
  "拱桥拱脚固结失效、明显变位。",
  "拱桥腹拱圈、桥面板塌陷或断裂。",
  "主要构件混凝土压溃或构件有失稳趋势。",
  "上部结构主要构件异常错位，有失稳或落梁趋势。",
  "主缆、拉吊索、系杆严重锈蚀或断裂。",
  "桥墩、桥台严重倾斜。",
  "扩大基础冲刷至基础底面，冲空面积大于 20%。",
  "桩柱连接钢筋失效或桩柱严重错位。",
  "桩基础核心混凝土大范围缺失。",
  "墩台基础、锚碇明显位移、下沉、倾斜。",
];

// 构件技术状况等级（表 3.2.6）
function eciToGrade(eci) {
  if (eci <= 1) return 1;
  if (eci <= 2) return 2;
  if (eci <= 3) return 3;
  if (eci <= 4) return 4;
  return 5;
}
// 桥跨技术状况等级（表 3.3.2）
function bsciToGrade(b) {
  if (b > 90) return 1;
  if (b > 75) return 2;
  if (b > 60) return 3;
  if (b > 40) return 4;
  return 5;
}
const GRADE_LIMIT = { 1: 100, 2: 90, 3: 75, 4: 60, 5: 40 };
const GRADE_TEXT = { 1: "优", 2: "良", 3: "中", 4: "次", 5: "差" };
const GRADE_ACTION = {
  1: "日常养护",
  2: "日常养护、预防养护",
  3: "预防养护、修复养护",
  4: "修复养护",
  5: "修复养护",
};

// 标准表查询辅助
function tableFor(category, id) {
  return table(id);
}
function componentDef(structForm, key) {
  const sf = STRUCTURE_FORMS[structForm];
  if (!sf) return null;
  for (const part of PARTS) {
    const c = sf.parts[part].find((x) => x.key === key);
    if (c) return { ...c, part, gamma: sf.gamma[part] };
  }
  return null;
}

module.exports = {
  STANDARD,
  DATA,
  BRIDGE_TYPES,
  PARTS,
  MATERIALS,
  COMPONENT_CATALOG,
  STRUCTURE_FORMS,
  FIVE_CLASS_INDICATORS,
  eciToGrade,
  bsciToGrade,
  GRADE_LIMIT,
  GRADE_TEXT,
  GRADE_ACTION,
  table,
  tableLabel,
  tableFor,
  componentDef,
};
