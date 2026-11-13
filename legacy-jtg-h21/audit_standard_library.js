// 输出标准库覆盖与质量审计，便于按章节逐表核验。
const fs = require("fs");
const path = require("path");
const { db } = require("./db");

const rows = db.prepare(`SELECT bt.name bridge_type,sf.name structure_form,p.name part,c.name component,
  d.name defect,d.max_class,d.standard_ref,d.applicable_to,d.verified,
  (SELECT COUNT(1) FROM bt_defect_scale s WHERE s.defect_type_id=d.id) scale_count
  FROM bt_defect_type d JOIN bt_component c ON c.id=d.component_id JOIN bt_part p ON p.id=c.part_id
  JOIN bt_struct_form sf ON sf.id=p.struct_form_id JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id
  ORDER BY bt.sort_order,sf.sort_order,p.sort_order,c.sort_order,d.sort_order,d.id`).all();
const suspicious = /坛工|号工|破拉|断面削羽|蜂离|锈独|变彤|裂续|损环|位移量大干|大子|小干/;
const stats = {
  total: rows.length,
  verified: rows.filter((r) => r.verified).length,
  withScales: rows.filter((r) => r.scale_count > 0).length,
  missingScales: rows.filter((r) => !r.scale_count).length,
  suspiciousNames: rows.filter((r) => suspicious.test(r.defect)).length,
};
const lines = [
  "# JTG/T H21-2011 标准库逐表核验审计",
  "",
  `- 缺陷记录总数：${stats.total}`,
  `- 已逐表核验：${stats.verified}`,
  `- 已有标度描述：${stats.withScales}`,
  `- 缺少标度描述：${stats.missingScales}`,
  `- 疑似 OCR 错字名称：${stats.suspiciousNames}`,
  "",
  "## 已核验表",
  "",
  ...[...new Set(rows.filter((r) => r.verified).map((r) => r.standard_ref))].sort().map((x) => `- 表 ${x}`),
  "",
  "## 待核验或缺少标度描述",
  "",
  "| 桥型 | 部位 | 构件 | 缺陷 | 最高标度 | 来源 | 问题 |",
  "|---|---|---|---|---:|---|---|",
  ...rows.filter((r) => !r.verified || !r.scale_count || suspicious.test(r.defect)).map((r) =>
    `| ${r.structure_form} | ${r.part} | ${r.component} | ${r.defect} | ${r.max_class || ""} | ${r.standard_ref || ""} | ${suspicious.test(r.defect) ? "疑似OCR错字" : (!r.scale_count ? "缺标度描述" : "未逐表核验")} |`),
  ""
];
const out = path.join(__dirname, "STANDARD_LIBRARY_AUDIT.md");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(stats, out);
