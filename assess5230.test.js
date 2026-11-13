// JTG/T 5230—2026 评定引擎测试
const assert = require("node:assert");
const { assess, assessMember } = require("./assess5230");

function bridge(spanCount = 1) {
  const spans = Array.from({ length: spanCount }, (_, i) => ({ id: i + 1, span_no: i + 1 }));
  const components = [];
  let id = 1;
  const base = () => [{ category: "structural", indicator: "无明显缺损", scale: 0, member_label: "1#" }];
  for (const span of spans) {
    components.push(
      { id: id++, span_id: span.id, part: "桥面系", name: "桥面铺装", comp_key: "deck_pavement", weight: 40, gamma: 0.15, is_major: false, member_count: 1, findings: base() },
      { id: id++, span_id: span.id, part: "桥面系", name: "伸缩装置", comp_key: "expansion", weight: 25, gamma: 0.15, is_major: false, member_count: 1, findings: base() },
      { id: id++, span_id: span.id, part: "桥面系", name: "护栏及人行道", comp_key: "railing", weight: 20, gamma: 0.15, is_major: false, member_count: 1, findings: base() },
      { id: id++, span_id: span.id, part: "桥面系", name: "排水系统", comp_key: "drainage", weight: 15, gamma: 0.15, is_major: false, member_count: 1, findings: base() },
      { id: id++, span_id: span.id, part: "上部结构", name: "主梁", comp_key: "girder", weight: 55, gamma: 0.42, is_major: true, member_count: 5, findings: base() },
      { id: id++, span_id: span.id, part: "上部结构", name: "横隔板", comp_key: "diaphragm", weight: 20, gamma: 0.42, is_major: false, member_count: 3, findings: base() },
      { id: id++, span_id: span.id, part: "上部结构", name: "支座", comp_key: "bearing", weight: 25, gamma: 0.42, is_major: true, member_count: 10, findings: base() },
      { id: id++, span_id: span.id, part: "下部结构", name: "桥墩或桥台", comp_key: "pier_abutment", weight: 60, gamma: 0.38, is_major: true, member_count: 2, findings: base() },
      { id: id++, span_id: span.id, part: "下部结构", name: "墩台基础", comp_key: "foundation", weight: 40, gamma: 0.38, is_major: true, member_count: 2, findings: base() },
      { id: id++, span_id: span.id, part: "附属构造", name: "河床及调治构造物", comp_key: "river", weight: 35, gamma: 0.05, is_major: false, member_count: 1, findings: base() },
      { id: id++, span_id: span.id, part: "附属构造", name: "翼墙、锥坡、护坡", comp_key: "wing", weight: 35, gamma: 0.05, is_major: false, member_count: 1, findings: base() },
      { id: id++, span_id: span.id, part: "附属构造", name: "其他附属设施", comp_key: "other", weight: 30, gamma: 0.05, is_major: false, member_count: 1, findings: base() },
    );
  }
  return { spans, components, five_class: [] };
}

function f(category, indicator, scale, member = "1#") {
  return { category, indicator, scale, member_label: member };
}

// 1) 完好构件
let m = assessMember([]);
assert.equal(m.eci, 0);
assert.equal(m.ecl, 1);

// 2) ECI = EDI + EFI + EAI，且封顶 5
m = assessMember([f("durability", "蜂窝、麻面", 2), f("structural", "梁底纵向裂缝", 1), f("function", "承载能力", 1), f("impact", "缺损发展影响", -1)]);
assert.equal(m.edi, 2);
assert.equal(m.efi, 1);
assert.equal(m.eai, -1);
assert.equal(m.eci, 2); // 2+1-1
assert.equal(m.ecl, 2);
m = assessMember([f("structural", "梁端剪切裂缝", 3), f("function", "工作性能（外观检查）", 2), f("impact", "缺损发展影响", 1)]);
assert.equal(m.eci, 5);

// 3) 全完好 → BSCI 100、1 类
const b1 = bridge(1);
let r = assess(b1);
assert.equal(r.spans[0].BSCI, 100);
assert.equal(r.grade, 1);
assert.equal(r.BCI, 100);

// 4) 单跨：主梁 EDI=3 → CI=3，上部贡献 = 3*55*0.42/5 = 13.86 → BSCI 86.1（2 类）
const b2 = bridge(1);
b2.components.find((c) => c.comp_key === "girder").findings = [f("structural", "梁端剪切裂缝", 3)];
r = assess(b2);
assert.equal(r.spans[0].components.find((c) => c.comp_key === "girder").CI, 3);
assert.equal(r.BCI, 86.1);
assert.equal(r.grade, 2);

// 5) 主梁 ECI=5 → 贡献 5*55*0.42/5 = 23.1 → BSCI 76.9（2 类）
const b3 = bridge(1);
b3.components.find((c) => c.comp_key === "girder").findings = [f("structural", "梁端剪切裂缝", 3), f("function", "工作性能（外观检查）", 2)];
r = assess(b3);
assert.equal(r.spans[0].components.find((c) => c.comp_key === "girder").CI, 5);
assert.equal(r.BCI, 76.9);

// 6) 全桥 5 类单项控制指标
const b4 = bridge(1);
b4.five_class = [{ index: 1, hit: true }];
r = assess(b4);
assert.equal(r.grade, 5);
assert.equal(r.fiveClassHit, true);
assert.equal(r.BCI, 100);

// 7) 多跨：一跨 2 类、一跨 1 类 → 最差 2 类 + 式(3.4.3)
const b5 = bridge(2);
b5.components.filter((c) => c.comp_key === "girder" && c.span_id === 1).forEach((c) => { c.findings = [f("structural", "梁端剪切裂缝", 3), f("function", "工作性能（外观检查）", 2)]; });
r = assess(b5);
assert.equal(r.spans.length, 2);
assert.equal(r.spans[0].BSCI, 76.9);
assert.equal(r.spans[1].BSCI, 100);
assert.equal(r.BCI, 83.5);
assert.equal(r.grade, 2);

// 8) 多跨不一致等级：最差等级 + 式(3.4.3)
function heavyBridge() {
  const b = bridge(2);
  // 第一跨所有构件均为 5 类
  for (const c of b.components.filter((x) => x.span_id === 1)) {
    c.findings = [f("structural", "严重缺损", 3), f("function", "严重功能异常", 2)];
  }
  return b;
}
r = assess(heavyBridge());
assert.equal(r.spans[0].BSCI, 0);
assert.equal(r.spans[0].grade, 5);
assert.equal(r.spans[1].BSCI, 100);
assert.equal(r.spans[1].grade, 1);
assert.equal(r.grade, 5);
assert.equal(r.BCI, 20); // 0 + (40-0)*(50-0)/(100-0)

// 9) 主要构件 4/5 类且影响安全 → 桥跨按构件等级，BSCI 取上限
const b6 = bridge(1);
b6.components.find((c) => c.comp_key === "girder").findings = [f("structural", "梁底纵向裂缝", 3), f("function", "承载能力", 1)];
b6.spans[0].major_override = { hit: true, note: "经复核影响安全" };
r = assess(b6);
assert.equal(r.spans[0].components.find((c) => c.comp_key === "girder").ECL, 4);
assert.equal(r.spans[0].grade, 4);
assert.equal(r.spans[0].BSCI, 60);

// 10) 未设置部件：权重在部位内重分配（桥面系去掉伸缩装置）
const b7 = bridge(1);
b7.components.find((c) => c.comp_key === "expansion").absent = true;
r = assess(b7);
assert.equal(r.spans[0].parts["桥面系"].present, 3);
const d = r.spans[0].components.find((c) => c.comp_key === "deck_pavement");
assert.equal(d.omega, 53.33);

// 11) 构件数内未记录缺损的构件按完好计，且 CI 取最差构件
const b8 = bridge(1);
b8.components.find((c) => c.comp_key === "girder").findings = [
  f("structural", "梁底纵向裂缝", 1, "1#"),
  f("structural", "梁端剪切裂缝", 3, "2#"),
];
r = assess(b8);
const g = r.spans[0].components.find((c) => c.comp_key === "girder");
assert.equal(g.evaluated_members, 2);
assert.equal(g.CI, 3);
assert.equal(g.worst.label, "2#");

// 12) 校验：标度越界
const b9 = bridge(1);
b9.components[0].findings = [{ category: "durability", indicator: "蜂窝、麻面", scale: 5, member_label: "1#" }];
r = assess(b9);
assert.equal(r.validation.valid, false);
assert.ok(r.validation.errors.length > 0);

console.log("assess5230 tests passed");
