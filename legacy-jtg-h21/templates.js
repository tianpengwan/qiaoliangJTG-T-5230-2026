// 桥梁技术状况评定 —— 桥型 / 部件 / 病害 配置（JTG/T H21—2011）
// 提供给前端下拉联动与后端校验使用。
// 结构：BRIDGE_TYPES[桥型] = { parts: [ { name, weight, components:[ {name, weight, major, defects:[缺陷名] } ] } ] }
// DEFECT_META[缺陷名] = 最高标度类别(3/4/5)，用于自动查 DP 扣分值。

const DEFECT_META = {
  // 通用（混凝土）
  "裂缝": 5, "剥落露筋": 5, "钢筋锈蚀": 4, "混凝土疏松孔洞": 5, "跨中挠度": 5,
  "混凝土强度不足": 5, "铰缝损伤": 4, "连接松动": 4, "老化开裂": 4, "变形": 4,
  "脱位": 4, "脱空": 4, "剪切变形超限": 4, "钢板锈蚀": 4, "支座缺失": 4,
  "破损": 4, "移位": 4, "塌陷": 4, "砌体损坏": 4, "冲刷": 4, "倾斜变位": 5,
  "风化腐蚀": 4, "水蚀": 4, "沉降变位": 5, "开裂": 5, "河床变迁": 5, "淤积": 4,
  "坑槽": 4, "车辙拥包": 4, "堵塞": 4, "渗漏": 4, "钢构件锈蚀": 4, "锚固区开裂": 4,
  "伸缩失效": 4, "缺损": 4, "松动": 4, "锈蚀": 4, "失效": 4, "缺失": 4,
  // 拱桥 / 缆索桥专用
  "主拱圈裂缝": 5, "拱圈变形": 5, "砌体断裂": 5, "拱上结构损坏": 5, "横向联结系损伤": 4,
  "主缆锈蚀断丝": 5, "吊索损伤": 5, "斜拉索护套破损": 5, "索塔裂缝": 5, "锚碇位移": 5,
  "加劲梁损伤": 5, "系杆吊杆锈蚀断裂": 5, "立柱损伤": 5, "行车道板损伤": 5,
};

// 各桥型权重与部件（依据标准表 4.2.1 ~ 4.2.5）
const BRIDGE_TYPES = {
  "梁式桥": {
    parts: [
      { name: "上部结构", weight: 0.40, components: [
        { name: "上部承重构件（主梁、挂梁）", weight: 0.70, major: true,
          defects: ["裂缝", "剥落露筋", "钢筋锈蚀", "混凝土疏松孔洞", "跨中挠度", "混凝土强度不足", "铰缝损伤"] },
        { name: "上部一般构件（湿接缝、横隔板等）", weight: 0.18, major: false,
          defects: ["裂缝", "剥落露筋", "钢筋锈蚀", "连接松动"] },
        { name: "支座", weight: 0.12, major: true,
          defects: ["老化开裂", "变形", "脱位", "脱空", "剪切变形超限", "钢板锈蚀", "支座缺失"] },
      ]},
      { name: "下部结构", weight: 0.40, components: [
        { name: "翼墙、耳墙", weight: 0.02, major: false, defects: ["破损", "裂缝", "移位"] },
        { name: "锥坡、护坡", weight: 0.01, major: false, defects: ["塌陷", "砌体损坏", "冲刷"] },
        { name: "桥墩", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "风化腐蚀", "水蚀"] },
        { name: "桥台", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "台背填土沉降", "水蚀"] },
        { name: "墩台基础", weight: 0.28, major: true, defects: ["冲刷", "沉降变位", "开裂", "风化腐蚀"] },
        { name: "河床", weight: 0.07, major: false, defects: ["河床变迁", "冲刷", "淤积"] },
        { name: "调治构造物", weight: 0.02, major: false, defects: ["破损", "冲刷", "砌体损坏"] },
      ]},
      { name: "桥面系", weight: 0.20, components: [
        { name: "桥面铺装", weight: 0.40, major: false, defects: ["破损", "裂缝", "坑槽", "车辙拥包"] },
        { name: "伸缩缝装置", weight: 0.25, major: false, defects: ["堵塞", "渗漏", "钢构件锈蚀", "锚固区开裂", "伸缩失效"] },
        { name: "人行道", weight: 0.10, major: false, defects: ["破损", "缺损", "松动"] },
        { name: "栏杆、护栏", weight: 0.10, major: false, defects: ["缺损", "锈蚀", "松动", "变形"] },
        { name: "排水系统", weight: 0.10, major: false, defects: ["堵塞", "破损", "缺失"] },
        { name: "照明、标志", weight: 0.05, major: false, defects: ["失效", "缺失", "锈蚀"] },
      ]},
    ]
  },

  "板拱桥/肋拱桥/箱形拱桥/双曲拱桥": {
    parts: [
      { name: "上部结构", weight: 0.40, components: [
        { name: "主拱圈", weight: 0.70, major: true,
          defects: ["主拱圈裂缝", "拱圈变形", "砌体断裂", "剥落露筋", "钢筋锈蚀"] },
        { name: "拱上结构", weight: 0.20, major: true, defects: ["拱上结构损坏", "裂缝", "变形"] },
        { name: "桥面板", weight: 0.10, major: true, defects: ["裂缝", "剥落露筋", "钢筋锈蚀", "坑槽"] },
      ]},
      { name: "下部结构", weight: 0.40, components: [
        { name: "翼墙、耳墙", weight: 0.02, major: false, defects: ["破损", "裂缝", "移位"] },
        { name: "锥坡、护坡", weight: 0.01, major: false, defects: ["塌陷", "砌体损坏", "冲刷"] },
        { name: "桥墩", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "风化腐蚀"] },
        { name: "桥台", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "台背填土沉降"] },
        { name: "墩台基础", weight: 0.28, major: true, defects: ["冲刷", "沉降变位", "开裂", "风化腐蚀"] },
        { name: "河床", weight: 0.07, major: false, defects: ["河床变迁", "冲刷", "淤积"] },
        { name: "调治构造物", weight: 0.02, major: false, defects: ["破损", "冲刷", "砌体损坏"] },
      ]},
      { name: "桥面系", weight: 0.20, components: [
        { name: "桥面铺装", weight: 0.40, major: false, defects: ["破损", "裂缝", "坑槽", "车辙拥包"] },
        { name: "伸缩缝装置", weight: 0.25, major: false, defects: ["堵塞", "渗漏", "钢构件锈蚀", "锚固区开裂", "伸缩失效"] },
        { name: "人行道", weight: 0.10, major: false, defects: ["破损", "缺损", "松动"] },
        { name: "栏杆、护栏", weight: 0.10, major: false, defects: ["缺损", "锈蚀", "松动", "变形"] },
        { name: "排水系统", weight: 0.10, major: false, defects: ["堵塞", "破损", "缺失"] },
        { name: "照明、标志", weight: 0.05, major: false, defects: ["失效", "缺失", "锈蚀"] },
      ]},
    ]
  },

  "刚架拱桥/桁架拱桥": {
    parts: [
      { name: "上部结构", weight: 0.40, components: [
        { name: "刚架（桁架）拱片", weight: 0.50, major: true, defects: ["裂缝", "拱圈变形", "剥落露筋", "钢筋锈蚀"] },
        { name: "横向联结系", weight: 0.25, major: true, defects: ["横向联结系损伤", "连接松动", "变形"] },
        { name: "桥面板", weight: 0.25, major: true, defects: ["裂缝", "剥落露筋", "钢筋锈蚀", "坑槽"] },
      ]},
      { name: "下部结构", weight: 0.40, components: [
        { name: "翼墙、耳墙", weight: 0.02, major: false, defects: ["破损", "裂缝", "移位"] },
        { name: "锥坡、护坡", weight: 0.01, major: false, defects: ["塌陷", "砌体损坏", "冲刷"] },
        { name: "桥墩", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "风化腐蚀"] },
        { name: "桥台", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "台背填土沉降"] },
        { name: "墩台基础", weight: 0.28, major: true, defects: ["冲刷", "沉降变位", "开裂", "风化腐蚀"] },
        { name: "河床", weight: 0.07, major: false, defects: ["河床变迁", "冲刷", "淤积"] },
        { name: "调治构造物", weight: 0.02, major: false, defects: ["破损", "冲刷", "砌体损坏"] },
      ]},
      { name: "桥面系", weight: 0.20, components: [
        { name: "桥面铺装", weight: 0.40, major: false, defects: ["破损", "裂缝", "坑槽", "车辙拥包"] },
        { name: "伸缩缝装置", weight: 0.25, major: false, defects: ["堵塞", "渗漏", "钢构件锈蚀", "锚固区开裂", "伸缩失效"] },
        { name: "人行道", weight: 0.10, major: false, defects: ["破损", "缺损", "松动"] },
        { name: "栏杆、护栏", weight: 0.10, major: false, defects: ["缺损", "锈蚀", "松动", "变形"] },
        { name: "排水系统", weight: 0.10, major: false, defects: ["堵塞", "破损", "缺失"] },
        { name: "照明、标志", weight: 0.05, major: false, defects: ["失效", "缺失", "锈蚀"] },
      ]},
    ]
  },

  "钢-混凝土组合拱桥": {
    parts: [
      { name: "上部结构", weight: 0.40, components: [
        { name: "拱肋", weight: 0.28, major: true, defects: ["主拱圈裂缝", "拱圈变形", "钢构件锈蚀", "开裂"] },
        { name: "横向联结系", weight: 0.05, major: true, defects: ["横向联结系损伤", "连接松动", "变形"] },
        { name: "立柱", weight: 0.13, major: true, defects: ["立柱损伤", "裂缝", "变形"] },
        { name: "吊杆", weight: 0.13, major: true, defects: ["系杆吊杆锈蚀断裂", "变形"] },
        { name: "系杆（含锚具）", weight: 0.28, major: true, defects: ["系杆吊杆锈蚀断裂", "锚固区开裂"] },
        { name: "桥面板（梁）", weight: 0.08, major: true, defects: ["行车道板损伤", "裂缝", "坑槽"] },
        { name: "支座", weight: 0.05, major: true, defects: ["老化开裂", "变形", "脱位", "脱空", "钢板锈蚀"] },
      ]},
      { name: "下部结构", weight: 0.40, components: [
        { name: "翼墙、耳墙", weight: 0.02, major: false, defects: ["破损", "裂缝", "移位"] },
        { name: "锥坡、护坡", weight: 0.01, major: false, defects: ["塌陷", "砌体损坏", "冲刷"] },
        { name: "桥墩", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "风化腐蚀"] },
        { name: "桥台", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "台背填土沉降"] },
        { name: "墩台基础", weight: 0.28, major: true, defects: ["冲刷", "沉降变位", "开裂", "风化腐蚀"] },
        { name: "河床", weight: 0.07, major: false, defects: ["河床变迁", "冲刷", "淤积"] },
        { name: "调治构造物", weight: 0.02, major: false, defects: ["破损", "冲刷", "砌体损坏"] },
      ]},
      { name: "桥面系", weight: 0.20, components: [
        { name: "桥面铺装", weight: 0.40, major: false, defects: ["破损", "裂缝", "坑槽", "车辙拥包"] },
        { name: "伸缩缝装置", weight: 0.25, major: false, defects: ["堵塞", "渗漏", "钢构件锈蚀", "锚固区开裂", "伸缩失效"] },
        { name: "人行道", weight: 0.10, major: false, defects: ["破损", "缺损", "松动"] },
        { name: "栏杆、护栏", weight: 0.10, major: false, defects: ["缺损", "锈蚀", "松动", "变形"] },
        { name: "排水系统", weight: 0.10, major: false, defects: ["堵塞", "破损", "缺失"] },
        { name: "照明、标志", weight: 0.05, major: false, defects: ["失效", "缺失", "锈蚀"] },
      ]},
    ]
  },

  "悬索桥": {
    parts: [
      { name: "上部结构", weight: 0.40, components: [
        { name: "加劲梁", weight: 0.15, major: true, defects: ["加劲梁损伤", "裂缝", "变形"] },
        { name: "索塔", weight: 0.20, major: true, defects: ["索塔裂缝", "倾斜变位", "混凝土强度不足"] },
        { name: "支座", weight: 0.05, major: true, defects: ["老化开裂", "变形", "脱位", "钢板锈蚀"] },
        { name: "主鞍", weight: 0.04, major: true, defects: ["移位", "钢构件锈蚀"] },
        { name: "主缆", weight: 0.25, major: true, defects: ["主缆锈蚀断丝", "防护层破损"] },
        { name: "索夹", weight: 0.04, major: true, defects: ["松动", "钢构件锈蚀"] },
        { name: "吊索及钢护筒", weight: 0.17, major: true, defects: ["吊索损伤", "钢构件锈蚀", "变形"] },
      ]},
      { name: "下部结构", weight: 0.40, components: [
        { name: "锚杆", weight: 0.10, major: true, defects: ["锈蚀", "断裂", "锚固区开裂"] },
        { name: "锚碇", weight: 0.40, major: true, defects: ["锚碇位移", "开裂", "沉降变位"] },
        { name: "索塔基础", weight: 0.30, major: true, defects: ["沉降变位", "冲刷", "开裂"] },
        { name: "散索鞍", weight: 0.15, major: true, defects: ["移位", "钢构件锈蚀"] },
        { name: "河床", weight: 0.10, major: false, defects: ["河床变迁", "冲刷", "淤积"] },
        { name: "调治构造物", weight: 0.05, major: false, defects: ["破损", "冲刷", "砌体损坏"] },
      ]},
      { name: "桥面系", weight: 0.20, components: [
        { name: "桥面铺装", weight: 0.40, major: false, defects: ["破损", "裂缝", "坑槽", "车辙拥包"] },
        { name: "伸缩缝装置", weight: 0.25, major: false, defects: ["堵塞", "渗漏", "钢构件锈蚀", "锚固区开裂", "伸缩失效"] },
        { name: "人行道", weight: 0.10, major: false, defects: ["破损", "缺损", "松动"] },
        { name: "栏杆、护栏", weight: 0.10, major: false, defects: ["缺损", "锈蚀", "松动", "变形"] },
        { name: "排水系统", weight: 0.10, major: false, defects: ["堵塞", "破损", "缺失"] },
        { name: "照明、标志", weight: 0.05, major: false, defects: ["失效", "缺失", "锈蚀"] },
      ]},
    ]
  },

  "斜拉桥": {
    parts: [
      { name: "上部结构", weight: 0.40, components: [
        { name: "斜拉索系统（斜拉索、锚具、护套、减震装置）", weight: 0.40, major: true,
          defects: ["斜拉索护套破损", "主缆锈蚀断丝", "锚固区开裂", "松动"] },
        { name: "主梁", weight: 0.25, major: true, defects: ["加劲梁损伤", "裂缝", "变形", "跨中挠度"] },
        { name: "索塔", weight: 0.25, major: true, defects: ["索塔裂缝", "倾斜变位", "混凝土强度不足"] },
        { name: "支座", weight: 0.10, major: true, defects: ["老化开裂", "变形", "脱位", "钢板锈蚀"] },
      ]},
      { name: "下部结构", weight: 0.40, components: [
        { name: "翼墙、耳墙", weight: 0.02, major: false, defects: ["破损", "裂缝", "移位"] },
        { name: "锥坡、护坡", weight: 0.01, major: false, defects: ["塌陷", "砌体损坏", "冲刷"] },
        { name: "桥墩", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "风化腐蚀"] },
        { name: "桥台", weight: 0.30, major: true, defects: ["裂缝", "倾斜变位", "剥落露筋", "钢筋锈蚀", "台背填土沉降"] },
        { name: "墩台基础", weight: 0.28, major: true, defects: ["冲刷", "沉降变位", "开裂", "风化腐蚀"] },
        { name: "河床", weight: 0.07, major: false, defects: ["河床变迁", "冲刷", "淤积"] },
        { name: "调治构造物", weight: 0.02, major: false, defects: ["破损", "冲刷", "砌体损坏"] },
      ]},
      { name: "桥面系", weight: 0.20, components: [
        { name: "桥面铺装", weight: 0.40, major: false, defects: ["破损", "裂缝", "坑槽", "车辙拥包"] },
        { name: "伸缩缝装置", weight: 0.25, major: false, defects: ["堵塞", "渗漏", "钢构件锈蚀", "锚固区开裂", "伸缩失效"] },
        { name: "人行道", weight: 0.10, major: false, defects: ["破损", "缺损", "松动"] },
        { name: "栏杆、护栏", weight: 0.10, major: false, defects: ["缺损", "锈蚀", "松动", "变形"] },
        { name: "排水系统", weight: 0.10, major: false, defects: ["堵塞", "破损", "缺失"] },
        { name: "照明、标志", weight: 0.05, major: false, defects: ["失效", "缺失", "锈蚀"] },
      ]},
    ]
  },
};

// 将规范中合并展示的拱桥类型拆分为独立可选结构形式，共享对应评定构件与权重。
const archCombined = BRIDGE_TYPES["板拱桥/肋拱桥/箱形拱桥/双曲拱桥"];
["板拱桥", "肋拱桥", "箱形拱桥", "双曲拱桥"].forEach((name) => {
  BRIDGE_TYPES[name] = JSON.parse(JSON.stringify(archCombined));
});
const frameCombined = BRIDGE_TYPES["刚架拱桥/桁架拱桥"];
["刚架拱桥", "桁架拱桥"].forEach((name) => {
  BRIDGE_TYPES[name] = JSON.parse(JSON.stringify(frameCombined));
});
delete BRIDGE_TYPES["板拱桥/肋拱桥/箱形拱桥/双曲拱桥"];
delete BRIDGE_TYPES["刚架拱桥/桁架拱桥"];

// 钢梁桥采用标准第5.2.1表钢结构病害，其他部位沿用梁式桥相应构件。
BRIDGE_TYPES["钢梁桥"] = JSON.parse(JSON.stringify(BRIDGE_TYPES["梁式桥"]));
const steelMain = BRIDGE_TYPES["钢梁桥"].parts[0].components[0];
steelMain.name = "上部承重构件（钢主梁、纵横梁）";
steelMain.defects = ["涂层劣化", "锈蚀", "焊缝开裂", "铆钉（螺栓）损失", "构件裂缝", "跨中挠度", "构件变形", "结构变位"];
BRIDGE_TYPES["钢梁桥"].parts[0].components[1].defects = ["涂层劣化", "锈蚀", "焊缝开裂", "铆钉（螺栓）损失", "构件裂缝", "构件变形", "结构变位"];

// 14 条 5 类桥梁单项控制指标（第 4.3 节）
const FIVE_CLASS_INDICATORS = [
  "上部结构有落梁；或有梁、板断裂现象。",
  "梁式桥上部承重构件控制截面出现全截面开裂；或组合结构结合面开裂贯通，造成截面组合作用严重降低。",
  "梁式桥上部承重构件有严重的异常位移，存在失稳现象。",
  "结构出现明显的永久变形，变形大于规范值。",
  "关键部位混凝土出现压碎或杆件失稳倾向；或桥面板出现严重塌陷。",
  "拱式桥拱脚严重错台、位移，造成拱顶挠度大于限值；或拱圈严重变形。",
  "圬工拱桥拱圈大范围砌体断裂，脱落现象严重。",
  "腹拱、侧墙、立墙或立柱产生破坏造成桥面板严重塌落。",
  "系杆或吊杆出现严重锈蚀或断裂现象。",
  "悬索桥主缆或多根吊索出现严重锈蚀、断丝。",
  "斜拉桥拉索钢丝出现严重锈蚀、断丝，主梁出现严重变形。",
  "扩大基础冲刷深度大于设计值，冲空面积达 20% 以上。",
  "桥墩（桥台或基础）不稳定，出现严重滑动、下沉、位移、倾斜等现象。",
  "悬索桥、斜拉桥索塔基础出现严重沉降或位移；或悬索桥锚碇有水平位移或沉降。",
];

// DP 扣分值查表（表 4.1.1），根据 最高标度类别 与 缺陷标度
function dpValue(maxClass, scale) {
  const table = {
    3: [0, 20, 35, null, null],
    4: [0, 25, 40, 50, null],
    5: [0, 35, 45, 60, 100],
  };
  if (!table[maxClass] || scale == null || scale === "") return null;
  const row = table[maxClass];
  const idx = scale - 1;
  if (idx < 0 || idx >= row.length) return null;
  return row[idx];
}

module.exports = { BRIDGE_TYPES, DEFECT_META, FIVE_CLASS_INDICATORS, dpValue };
