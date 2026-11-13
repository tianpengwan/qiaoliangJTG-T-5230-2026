// 标准库元数据播种脚本
// 把 templates.js 的 BRIDGE_TYPES / DEFECT_META / FIVE_CLASS_INDICATORS
// 转换为 bt_* 元数据表；仅在表为空时执行（幂等）。
// 用法：node seed_std.js            （仅播种结构）
//       node seed_std.js --enrich <defect_lib.json>  （追加缺失缺陷类型 + 标度描述）
const path = require("path");
const { db } = require("./db");
const { BRIDGE_TYPES, DEFECT_META, FIVE_CLASS_INDICATORS } = require("./templates");

// templates.js 的桥型键 → 大类(桥梁类型) + 结构形式名
const TYPE_MAP = {
  "梁式桥": { bt: "梁式桥", sf: "梁式桥" },
  "板拱桥/肋拱桥/箱形拱桥/双曲拱桥": { bt: "拱桥", sf: "板拱桥/肋拱桥/箱形拱桥/双曲拱桥" },
  "刚架拱桥/桁架拱桥": { bt: "刚架拱桥", sf: "刚架拱桥/桁架拱桥" },
  "钢-混凝土组合拱桥": { bt: "组合体系桥", sf: "钢-混凝土组合拱桥" },
  "悬索桥": { bt: "悬索桥", sf: "悬索桥" },
  "斜拉桥": { bt: "斜拉桥", sf: "斜拉桥" },
};

function seed() {
  const cnt = db.prepare("SELECT COUNT(*) c FROM bt_bridge_type").get().c;
  if (cnt > 0) {
    console.log("bt_bridge_type 已存在数据，跳过结构播种。");
    return;
  }
  const insBT = db.prepare("INSERT INTO bt_bridge_type (code,name,note,sort_order) VALUES (?,?,?,?)");
  const insSF = db.prepare("INSERT INTO bt_struct_form (bridge_type_id,code,name,note,sort_order) VALUES (?,?,?,?,?)");
  const insPart = db.prepare("INSERT INTO bt_part (struct_form_id,code,name,weight,sort_order) VALUES (?,?,?,?,?)");
  const insComp = db.prepare("INSERT INTO bt_component (part_id,code,name,weight,is_major,sort_order) VALUES (?,?,?,?,?,?)");
  const insDef = db.prepare("INSERT OR IGNORE INTO bt_defect_type (component_id,code,name,max_class,note,sort_order) VALUES (?,?,?,?,?,?)");

  let sfOrder = 0, partOrder = 0, compOrder = 0, defOrder = 0;
  for (const [key, tpl] of Object.entries(BRIDGE_TYPES)) {
    const m = TYPE_MAP[key] || { bt: key, sf: key };
    const bt = insBT.run(m.bt, m.bt, "桥梁大类", sfOrder++);
    const btId = bt.lastInsertRowid;
    const sf = insSF.run(btId, null, m.sf, "结构形式", 0);
    const sfId = sf.lastInsertRowid;

    for (const part of tpl.parts) {
      const p = insPart.run(sfId, null, part.name, part.weight, partOrder++);
      const partId = p.lastInsertRowid;
      for (const comp of part.components) {
        const c = insComp.run(partId, null, comp.name, comp.weight, comp.major ? 1 : 0, compOrder++);
        const compId = c.lastInsertRowid;
        for (const dn of comp.defects) {
          const maxc = DEFECT_META[dn] || 5;
          insDef.run(compId, null, dn, maxc, null, defOrder++);
        }
      }
    }
  }

  // 五类指标
  const ins5 = db.prepare("INSERT INTO bt_five_class (code,content,category,sort_order) VALUES (?,?,?,?)");
  FIVE_CLASS_INDICATORS.forEach((t, i) => ins5.run(null, t, null, i));

  console.log("结构播种完成。");
}

// 用缺陷库 JSON 富化：补齐缺失缺陷类型、写入各标度定性/定量描述
function enrich(jsonPath) {
  const lib = require(path.resolve(jsonPath));
  let addedDef = 0, addedScale = 0;
  const insDef = db.prepare("INSERT OR IGNORE INTO bt_defect_type (component_id,code,name,max_class,note,sort_order) VALUES (?,?,?,?,?,?)");
  const getDef = db.prepare("SELECT id FROM bt_defect_type WHERE component_id=? AND name=?");
  const insScale = db.prepare("INSERT OR REPLACE INTO bt_defect_scale (defect_type_id,scale,qual,quan) VALUES (?,?,?,?)");

  for (const [btName, parts] of Object.entries(lib)) {
    for (const [partName, comps] of Object.entries(parts)) {
      for (const [compName, defs] of Object.entries(comps)) {
        // 定位 component_id
        const row = db.prepare(`
          SELECT c.id FROM bt_component c
          JOIN bt_part p ON p.id=c.part_id
          JOIN bt_struct_form sf ON sf.id=p.struct_form_id
          JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id
          WHERE bt.name=? AND p.name=? AND c.name=?
        `).get(btName, partName, compName);
        if (!row) { console.warn("未匹配构件:", btName, partName, compName); continue; }
        const compId = row.id;
        defOrder = 0;
        for (const d of defs) {
          const maxc = d.max_class || 5;
          const r = insDef.run(compId, null, d.name, maxc, d.note || null, defOrder++);
          let defId = r.lastInsertRowid;
          if (!defId) { const ex = getDef.get(compId, d.name); defId = ex.id; }
          else addedDef++;
          if (d.scales) {
            for (const [sc, desc] of Object.entries(d.scales)) {
              insScale.run(defId, Number(sc), (desc && desc.qual) || null, (desc && desc.quan) || null);
              addedScale++;
            }
          }
        }
      }
    }
  }
  console.log(`富化完成：新增缺陷类型 ${addedDef} 条，写入标度描述 ${addedScale} 条。`);
}

const mode = process.argv[2];
if (mode === "--enrich") {
  if (!process.argv[3]) { console.error("请提供 defect_lib.json 路径"); process.exit(1); }
  enrich(process.argv[3]);
} else {
  seed();
}
