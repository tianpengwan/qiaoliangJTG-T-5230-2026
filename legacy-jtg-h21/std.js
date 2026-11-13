// 标准库（桥梁类型/结构形式/部位/部件/缺陷类型/缺陷标度/五类指标）CRUD 路由
// 挂载到 /api/std/*，供前端“标准库管理”页面与建桥下拉联动使用。
const express = require("express");
const { db } = require("./db");

const router = express.Router();

const num = (v) => (v === "" || v === null || v === undefined ? null : (isNaN(Number(v)) ? null : Number(v)));
const str = (v) => (v === undefined ? null : v);
const bool01 = (v) => (v ? 1 : 0);

// ---------- 全量树（供管理页一次性渲染） ----------
router.get("/tree", (req, res) => {
  const bts = db.prepare("SELECT * FROM bt_bridge_type ORDER BY sort_order,id").all();
  const sfs = db.prepare("SELECT * FROM bt_struct_form ORDER BY sort_order,id").all();
  const parts = db.prepare("SELECT * FROM bt_part ORDER BY sort_order,id").all();
  const comps = db.prepare("SELECT * FROM bt_component ORDER BY sort_order,id").all();
  const defs = db.prepare("SELECT * FROM bt_defect_type ORDER BY sort_order,id").all();
  const scales = db.prepare("SELECT * FROM bt_defect_scale ORDER BY defect_type_id,scale").all();

  const scaleMap = new Map();
  for (const s of scales) {
    if (!scaleMap.has(s.defect_type_id)) scaleMap.set(s.defect_type_id, []);
    scaleMap.get(s.defect_type_id).push({ scale: s.scale, qual: s.qual, quan: s.quan });
  }
  const defMap = new Map();
  for (const d of defs) {
    const o = { id: d.id, code: d.code, name: d.name, max_class: d.max_class, note: d.note, standard_ref: d.standard_ref, applicable_to: d.applicable_to, verified: !!d.verified, sort_order: d.sort_order, scales: scaleMap.get(d.id) || [] };
    if (!defMap.has(d.component_id)) defMap.set(d.component_id, []);
    defMap.get(d.component_id).push(o);
  }
  const compMap = new Map();
  for (const c of comps) {
    const o = { id: c.id, code: c.code, name: c.name, weight: c.weight, is_major: !!c.is_major, sort_order: c.sort_order, defects: defMap.get(c.id) || [] };
    if (!compMap.has(c.part_id)) compMap.set(c.part_id, []);
    compMap.get(c.part_id).push(o);
  }
  const partMap = new Map();
  for (const p of parts) {
    const o = { id: p.id, code: p.code, name: p.name, weight: p.weight, sort_order: p.sort_order, components: compMap.get(p.id) || [] };
    if (!partMap.has(p.struct_form_id)) partMap.set(p.struct_form_id, []);
    partMap.get(p.struct_form_id).push(o);
  }
  const sfMap = new Map();
  for (const sf of sfs) {
    const o = { id: sf.id, code: sf.code, name: sf.name, note: sf.note, sort_order: sf.sort_order, parts: partMap.get(sf.id) || [] };
    if (!sfMap.has(sf.bridge_type_id)) sfMap.set(sf.bridge_type_id, []);
    sfMap.get(sf.bridge_type_id).push(o);
  }
  const tree = bts.map((b) => ({ id: b.id, code: b.code, name: b.name, note: b.note, sort_order: b.sort_order, struct_forms: sfMap.get(b.id) || [] }));
  res.json(tree);
});

// ---------- 桥梁类型 ----------
router.get("/bridge-types", (req, res) => {
  res.json(db.prepare("SELECT * FROM bt_bridge_type ORDER BY sort_order,id").all());
});
router.post("/bridge-types", (req, res) => {
  const b = req.body || {};
  try {
    const info = db.prepare("INSERT INTO bt_bridge_type (code,name,note,sort_order) VALUES (?,?,?,?)")
      .run(str(b.code), str(b.name), str(b.note), num(b.sort_order) || 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put("/bridge-types/:id", (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE bt_bridge_type SET code=?,name=?,note=?,sort_order=? WHERE id=?")
    .run(str(b.code), str(b.name), str(b.note), num(b.sort_order) || 0, req.params.id);
  res.json({ message: "ok" });
});
router.delete("/bridge-types/:id", (req, res) => {
  db.prepare("DELETE FROM bt_bridge_type WHERE id=?").run(req.params.id);
  res.json({ message: "ok" });
});

// ---------- 结构形式 ----------
router.get("/struct-forms", (req, res) => {
  const rows = req.query.bridge_type_id
    ? db.prepare("SELECT * FROM bt_struct_form WHERE bridge_type_id=? ORDER BY sort_order,id").all(req.query.bridge_type_id)
    : db.prepare("SELECT * FROM bt_struct_form ORDER BY sort_order,id").all();
  res.json(rows);
});
router.post("/struct-forms", (req, res) => {
  const b = req.body || {};
  try {
    const info = db.prepare("INSERT INTO bt_struct_form (bridge_type_id,code,name,note,sort_order) VALUES (?,?,?,?,?)")
      .run(num(b.bridge_type_id), str(b.code), str(b.name), str(b.note), num(b.sort_order) || 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put("/struct-forms/:id", (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE bt_struct_form SET bridge_type_id=?,code=?,name=?,note=?,sort_order=? WHERE id=?")
    .run(num(b.bridge_type_id), str(b.code), str(b.name), str(b.note), num(b.sort_order) || 0, req.params.id);
  res.json({ message: "ok" });
});
router.delete("/struct-forms/:id", (req, res) => {
  db.prepare("DELETE FROM bt_struct_form WHERE id=?").run(req.params.id);
  res.json({ message: "ok" });
});

// ---------- 部位 ----------
router.post("/parts", (req, res) => {
  const b = req.body || {};
  try {
    const info = db.prepare("INSERT INTO bt_part (struct_form_id,code,name,weight,sort_order) VALUES (?,?,?,?,?)")
      .run(num(b.struct_form_id), str(b.code), str(b.name), num(b.weight), num(b.sort_order) || 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put("/parts/:id", (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE bt_part SET struct_form_id=?,code=?,name=?,weight=?,sort_order=? WHERE id=?")
    .run(num(b.struct_form_id), str(b.code), str(b.name), num(b.weight), num(b.sort_order) || 0, req.params.id);
  res.json({ message: "ok" });
});
router.delete("/parts/:id", (req, res) => {
  db.prepare("DELETE FROM bt_part WHERE id=?").run(req.params.id);
  res.json({ message: "ok" });
});

// ---------- 部件/构件 ----------
router.post("/components", (req, res) => {
  const b = req.body || {};
  try {
    const info = db.prepare("INSERT INTO bt_component (part_id,code,name,weight,is_major,sort_order) VALUES (?,?,?,?,?,?)")
      .run(num(b.part_id), str(b.code), str(b.name), num(b.weight), bool01(b.is_major), num(b.sort_order) || 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put("/components/:id", (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE bt_component SET part_id=?,code=?,name=?,weight=?,is_major=?,sort_order=? WHERE id=?")
    .run(num(b.part_id), str(b.code), str(b.name), num(b.weight), bool01(b.is_major), num(b.sort_order) || 0, req.params.id);
  res.json({ message: "ok" });
});
router.delete("/components/:id", (req, res) => {
  db.prepare("DELETE FROM bt_component WHERE id=?").run(req.params.id);
  res.json({ message: "ok" });
});

// ---------- 缺陷类型 ----------
router.post("/defect-types", (req, res) => {
  const b = req.body || {};
  try {
    const info = db.prepare("INSERT OR IGNORE INTO bt_defect_type (component_id,code,name,max_class,note,sort_order) VALUES (?,?,?,?,?,?)")
      .run(num(b.component_id), str(b.code), str(b.name), num(b.max_class) || 5, str(b.note), num(b.sort_order) || 0);
    res.json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put("/defect-types/:id", (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE bt_defect_type SET component_id=?,code=?,name=?,max_class=?,note=?,sort_order=? WHERE id=?")
    .run(num(b.component_id), str(b.code), str(b.name), num(b.max_class) || 5, str(b.note), num(b.sort_order) || 0, req.params.id);
  res.json({ message: "ok" });
});
router.delete("/defect-types/:id", (req, res) => {
  db.prepare("DELETE FROM bt_defect_type WHERE id=?").run(req.params.id);
  res.json({ message: "ok" });
});

// 缺陷标度描述：整体替换某缺陷类型的所有标度行
router.put("/defect-types/:id/scales", (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : (req.body.scales || []);
  db.prepare("DELETE FROM bt_defect_scale WHERE defect_type_id=?").run(req.params.id);
  const ins = db.prepare("INSERT INTO bt_defect_scale (defect_type_id,scale,qual,quan) VALUES (?,?,?,?)");
  for (const r of rows) {
    if (r.scale == null) continue;
    ins.run(req.params.id, num(r.scale), str(r.qual), str(r.quan));
  }
  res.json({ message: "ok", count: rows.length });
});

// 取某构件（元数据）的缺陷类型清单，供病害录入下拉与 AI 候选用
router.get("/components/:id/defect-types", (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, (SELECT json_group_array(json_object('scale',s.scale,'qual',s.qual,'quan',s.quan))
                 FROM bt_defect_scale s WHERE s.defect_type_id=d.id) AS scales_json
    FROM bt_defect_type d WHERE d.component_id=? ORDER BY d.sort_order,d.id`).all(req.params.id);
  for (const r of rows) { r.scales = r.scales_json ? JSON.parse(r.scales_json) : []; delete r.scales_json; }
  res.json(rows);
});

// 将一个部件下的缺陷类型及标度描述整体复制到另一个部件。
// 同名缺陷按源节点内容更新，避免目标部件出现重复定义。
router.post("/components/:id/defect-types/bulk-copy", (req, res) => {
  const target = db.prepare("SELECT id FROM bt_component WHERE id=?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "目标部件不存在" });
  const defects = Array.isArray(req.body?.defects) ? req.body.defects : [];
  if (!defects.length) return res.status(400).json({ error: "没有可粘贴的缺陷定义" });
  if (defects.length > 500) return res.status(400).json({ error: "单次最多粘贴 500 个缺陷定义" });

  const findExisting = db.prepare("SELECT id FROM bt_defect_type WHERE component_id=? AND name=?");
  const insertDefect = db.prepare(`INSERT INTO bt_defect_type
    (component_id,code,name,max_class,note,sort_order,standard_ref,applicable_to,verified)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const updateDefect = db.prepare(`UPDATE bt_defect_type SET code=?,name=?,max_class=?,note=?,sort_order=?,
    standard_ref=?,applicable_to=?,verified=? WHERE id=?`);
  const deleteScales = db.prepare("DELETE FROM bt_defect_scale WHERE defect_type_id=?");
  const insertScale = db.prepare("INSERT INTO bt_defect_scale (defect_type_id,scale,qual,quan) VALUES (?,?,?,?)");
  let created = 0, updated = 0, scaleCount = 0;
  try {
    db.exec("BEGIN");
    for (const item of defects) {
      const name = String(item?.name || "").trim();
      if (!name) throw new Error("复制的缺陷定义缺少名称");
      const maxClass = num(item?.max_class) || 5;
      if (!Number.isInteger(maxClass) || maxClass < 1) throw new Error(`缺陷“${name}”的最高类别无效`);
      const values = [
        str(item?.code), name, maxClass, str(item?.note), num(item?.sort_order) || 0,
        str(item?.standard_ref), str(item?.applicable_to), item?.verified ? 1 : 0,
      ];
      const existing = findExisting.get(target.id, name);
      let defectId;
      if (existing) {
        defectId = existing.id;
        updateDefect.run(...values, defectId);
        updated++;
      } else {
        defectId = Number(insertDefect.run(target.id, ...values).lastInsertRowid);
        created++;
      }
      deleteScales.run(defectId);
      for (const scale of (Array.isArray(item?.scales) ? item.scales : [])) {
        const value = num(scale?.scale);
        if (!Number.isInteger(value) || value < 1 || value > maxClass) {
          throw new Error(`缺陷“${name}”包含无效标度 ${scale?.scale}`);
        }
        insertScale.run(defectId, value, str(scale?.qual), str(scale?.quan));
        scaleCount++;
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch (_) { /* 保留原始错误 */ }
    return res.status(422).json({ error: e.message || "粘贴缺陷定义失败" });
  }
  res.json({ message: `已粘贴 ${created + updated} 个缺陷定义（新增 ${created}，更新 ${updated}）`, created, updated, scaleCount });
});

// ---------- 五类指标 ----------
router.get("/five-class", (req, res) => {
  res.json(db.prepare("SELECT * FROM bt_five_class ORDER BY sort_order,id").all());
});
router.post("/five-class", (req, res) => {
  const b = req.body || {};
  const info = db.prepare("INSERT INTO bt_five_class (code,content,category,sort_order) VALUES (?,?,?,?)")
    .run(str(b.code), str(b.content), str(b.category), num(b.sort_order) || 0);
  res.json({ id: info.lastInsertRowid });
});
router.put("/five-class/:id", (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE bt_five_class SET code=?,content=?,category=?,sort_order=? WHERE id=?")
    .run(str(b.code), str(b.content), str(b.category), num(b.sort_order) || 0, req.params.id);
  res.json({ message: "ok" });
});
router.delete("/five-class/:id", (req, res) => {
  db.prepare("DELETE FROM bt_five_class WHERE id=?").run(req.params.id);
  res.json({ message: "ok" });
});

module.exports = router;

// ===================== 供 server.js 复用的查询/解析辅助 =====================
// 构建 /api/templates 兼容载荷（前端 app.js 仍按旧结构消费）：
//  bridgeTypes: { [结构形式名]: { parts:[{name,weight,components:[{name,weight,major,defects:[名]}]}] } }
//  bridgeTypeList / structForms: 供“桥梁类型→结构形式”二级下拉
//  fiveClass: 字符串数组；defectMeta: { 缺陷名: 最高标度类别 }（取该名跨构件最大值）
function buildTemplatesPayload() {
  const bts = db.prepare("SELECT * FROM bt_bridge_type ORDER BY sort_order,id").all();
  const sfs = db.prepare("SELECT * FROM bt_struct_form ORDER BY sort_order,id").all();
  const parts = db.prepare("SELECT * FROM bt_part ORDER BY sort_order,id").all();
  const comps = db.prepare("SELECT * FROM bt_component ORDER BY sort_order,id").all();
  const defs = db.prepare("SELECT * FROM bt_defect_type ORDER BY sort_order,id").all();
  const fc = db.prepare("SELECT content FROM bt_five_class ORDER BY sort_order,id").all().map((r) => r.content);

  const partBySF = {}, compByPart = {}, defByComp = {}, defectMeta = {};
  for (const p of parts) (partBySF[p.struct_form_id] = partBySF[p.struct_form_id] || []).push(p);
  for (const c of comps) (compByPart[c.part_id] = compByPart[c.part_id] || []).push(c);
  for (const d of defs) {
    (defByComp[d.component_id] = defByComp[d.component_id] || []).push(d);
    defectMeta[d.name] = Math.max(defectMeta[d.name] || 0, d.max_class || 5);
  }

  const bridgeTypes = {};
  for (const sf of sfs) {
    bridgeTypes[sf.name] = {
      parts: (partBySF[sf.id] || []).map((p) => ({
        name: p.name, weight: p.weight,
        components: (compByPart[p.id] || []).map((c) => ({
          name: c.name, weight: c.weight, major: !!c.is_major,
          defects: (defByComp[c.id] || []).map((d) => d.name),
        })),
      })),
    };
  }
  const structForms = {};
  for (const b of bts) structForms[b.name] = sfs.filter((sf) => sf.bridge_type_id === b.id).map((sf) => ({ id: sf.id, name: sf.name }));
  const bridgeTypeList = bts.map((b) => ({ id: b.id, name: b.name }));
  return { bridgeTypes, bridgeTypeList, structForms, fiveClass: fc, defectMeta };
}

// 名称 → 结构形式行（兼容传入“结构形式名”或“桥梁类型大类名”）
function resolveStructForm(name) {
  if (!name) return null;
  let sf = db.prepare("SELECT * FROM bt_struct_form WHERE name=?").get(name);
  if (sf) return sf;
  const bt = db.prepare("SELECT * FROM bt_bridge_type WHERE name=?").get(name);
  if (bt) return db.prepare("SELECT * FROM bt_struct_form WHERE bridge_type_id=? ORDER BY sort_order,id LIMIT 1").get(bt.id);
  return null;
}

// 某结构形式下的全部构件（含 bt_component_id、部位、权值、是否主要）
function componentsOfStructForm(sfId) {
  return db.prepare(`
    SELECT c.id AS bt_component_id, p.name AS part, c.name, c.weight, c.is_major, c.sort_order
    FROM bt_component c JOIN bt_part p ON p.id=c.part_id
    WHERE p.struct_form_id=? ORDER BY p.sort_order, c.sort_order`).all(sfId);
}

// 某标准构件下某缺陷名的最高标度类别（无则全局同名最大值，再无则 null）
function maxClassForBtComponent(btComponentId, defectName) {
  const r = db.prepare("SELECT max_class FROM bt_defect_type WHERE component_id=? AND name=?").get(btComponentId, defectName);
  if (r) return r.max_class;
  const g = db.prepare("SELECT MAX(max_class) m FROM bt_defect_type WHERE name=?").get(defectName);
  return g ? g.m : null;
}
function defectTypesForBtComponent(btComponentId) {
  return db.prepare("SELECT id, name, max_class, standard_ref, applicable_to, verified FROM bt_defect_type WHERE component_id=? ORDER BY sort_order,id").all(btComponentId);
}

module.exports.helpers = { buildTemplatesPayload, resolveStructForm, componentsOfStructForm, maxClassForBtComponent, defectTypesForBtComponent };
