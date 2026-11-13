// 从人工核验过的 UTF-8 标准转录表同步缺陷标度。仅处理 VERIFIED_TABLES 白名单。
const fs = require("fs");
const path = require("path");
const { db } = require("./db");

const TRANSCRIPT = path.join(__dirname, "..", "_ocr", "transcript");
const VERIFIED_TABLES = [
  ["5.1.1-1", "蜂窝、麻面", ""], ["5.1.1-2", "剥落、掉角", ""],
  ["5.1.1-3", "空洞、孔洞", ""], ["5.1.1-4", "混凝土保护层厚度", ""],
  ["5.1.1-5", "钢筋锈蚀", ""], ["5.1.1-6", "混凝土碳化", ""],
  ["5.1.1-7", "混凝土强度", ""], ["5.1.1-8", "跨中挠度", ""],
  ["5.1.1-9", "结构变位", ""], ["5.1.1-10", "预应力构件损伤", "锚头、钢绞线、齿板等"],
  ["5.1.1-11", "裂缝（简支梁、板及刚架桥）", "简支梁（板）桥、刚架桥"],
  ["5.1.1-12", "裂缝（连续梁及刚构体系）", "连续梁桥、连续刚构桥、悬臂梁桥、T形刚构桥"],
];
const text = [20, 21, 22, 23].map((n) => fs.readFileSync(path.join(TRANSCRIPT, `p${String(n).padStart(3, "0")}.txt`), "utf8")).join("\n");

function parseTable(ref) {
  const m = text.match(new RegExp(`表${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*\\n@T\\n([\\s\\S]*?)\\n@/T`));
  if (!m) throw new Error(`未找到标准表 ${ref}`);
  const rows = [];
  for (const line of m[1].split(/\r?\n/)) {
    const cells = line.replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
    if (!/^[1-5]$/.test(cells[0] || "")) continue;
    rows.push({ scale: Number(cells[0]), qual: cells[1] || "", quan: cells[2] || "" });
  }
  if (!rows.length) throw new Error(`标准表 ${ref} 未解析到标度行`);
  return rows;
}

const components = db.prepare(`SELECT c.id FROM bt_component c JOIN bt_part p ON p.id=c.part_id
  JOIN bt_struct_form sf ON sf.id=p.struct_form_id JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id
  WHERE bt.name='梁式桥' AND p.name='上部结构' AND c.name IN ('上部承重构件（主梁、挂梁）','上部一般构件（湿接缝、横隔板等）')`).all();
if (!components.length) throw new Error("标准库中未找到梁式桥混凝土上部构件");

const find = db.prepare("SELECT id FROM bt_defect_type WHERE component_id=? AND name=?");
const insert = db.prepare(`INSERT INTO bt_defect_type
  (component_id,name,max_class,note,sort_order,standard_ref,applicable_to,verified) VALUES (?,?,?,?,?,?,?,1)`);
const update = db.prepare("UPDATE bt_defect_type SET max_class=?,standard_ref=?,applicable_to=?,verified=1 WHERE id=?");
const clearScales = db.prepare("DELETE FROM bt_defect_scale WHERE defect_type_id=?");
const addScale = db.prepare("INSERT INTO bt_defect_scale (defect_type_id,scale,qual,quan) VALUES (?,?,?,?)");

db.exec("BEGIN");
try {
  let count = 0;
  for (const [ref, name, applicable] of VERIFIED_TABLES) {
    const rows = parseTable(ref), maxClass = Math.max(...rows.map((r) => r.scale));
    for (const c of components) {
      let d = find.get(c.id, name);
      const id = d ? d.id : insert.run(c.id, name, maxClass, null, 0, ref, applicable || null).lastInsertRowid;
      update.run(maxClass, ref, applicable || null, id);
      clearScales.run(id);
      for (const r of rows) addScale.run(id, r.scale, r.qual, r.quan);
      count++;
    }
  }
  db.exec("COMMIT");
  console.log(`已同步核验表 ${VERIFIED_TABLES.length} 张，构件缺陷记录 ${count} 条。`);
} catch (e) { db.exec("ROLLBACK"); throw e; }
