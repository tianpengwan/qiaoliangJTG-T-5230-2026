// 公路桥梁技术状况评定系统 —— 服务端（JTG/T 5230—2026）
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { db, UPLOAD_DIR, EXPORT_DIR } = require("./db");
const TPL = require("./templates5230");
const { assess, CATEGORY } = require("./assess5230");
const { assessPhoto, providerInfo } = require("./vision");
const { exportExcel, exportDocx } = require("./export5230");

// 轻量 .env 加载
(function loadEnv() {
  const fp = path.join(__dirname, ".env");
  if (!fs.existsSync(fp)) return;
  for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// ---------- 登录鉴权 ----------
// 账号密码通过环境变量配置：AUTH_USER / AUTH_PASS（飞牛上写在 .env）
const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASS = process.env.AUTH_PASS || "qiaoliang@2026";
const AUTH_TTL_MS = Math.max(1, Number(process.env.AUTH_TTL_HOURS || 720)) * 3600 * 1000;
const AUTH_SECRET = process.env.AUTH_SECRET
  || crypto.createHash("sha256").update(`jtg5230|${AUTH_USER}|${AUTH_PASS}`).digest("hex");
const USING_DEFAULT_PASS = !process.env.AUTH_PASS;

function b64u(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(str) {
  return Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function signToken(user) {
  const body = b64u(JSON.stringify({ u: user, exp: Date.now() + AUTH_TTL_MS }));
  return `${body}.${b64u(crypto.createHmac("sha256", AUTH_SECRET).update(body).digest())}`;
}
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const idx = token.indexOf(".");
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  let expect;
  try {
    expect = b64u(crypto.createHmac("sha256", AUTH_SECRET).update(body).digest());
  } catch (e) { return null; }
  const a = Buffer.from(mac);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(unb64u(body).toString("utf8"));
    if (!p || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch (e) { return null; }
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) {
    crypto.timingSafeEqual(x, x);
    return false;
  }
  return crypto.timingSafeEqual(x, y);
}
// 同一 IP 连续失败 8 次锁定 5 分钟
const loginFails = new Map();
function clientIp(req) {
  return String((req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "");
}

function decodeUploadName(name) {
  if (!name || !/[\u0080-\u00ff]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return /[\u3400-\u9fff]/.test(decoded) && !decoded.includes("�") ? decoded : name;
  } catch (e) { return name; }
}

app.use(express.json({ limit: "4mb" }));
// 允许手机 APP（Capacitor WebView）跨域访问 API
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 登录接口（唯一无需鉴权的写接口）
app.post("/api/login", (req, res) => {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (rec && rec.until > now) {
    return res.status(429).json({ error: `尝试次数过多，请 ${Math.ceil((rec.until - now) / 60000)} 分钟后再试` });
  }
  const username = String((req.body && req.body.username) || "");
  const password = String((req.body && req.body.password) || "");
  if (!safeEqual(username, AUTH_USER) || !safeEqual(password, AUTH_PASS)) {
    const n = (rec && rec.exp > now ? rec.n : 0) + 1;
    loginFails.set(ip, { n, exp: now + 10 * 60000, until: n >= 8 ? now + 5 * 60000 : 0 });
    return res.status(401).json({ error: "账号或密码错误" });
  }
  loginFails.delete(ip);
  res.json({ token: signToken(AUTH_USER), user: AUTH_USER, expires: now + AUTH_TTL_MS, ttl_hours: AUTH_TTL_MS / 3600000 });
});

// 除健康检查与登录外，所有 /api 接口都需要登录
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/login") return next();
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : String(req.query.token || "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "登录已失效，请重新登录", needLogin: true });
  req.user = payload.u;
  next();
});

app.use(express.static(path.join(__dirname, "public")));

process.on("uncaughtException", (err) => console.error("未捕获异常（服务继续运行）:", err));
process.on("unhandledRejection", (reason) => console.error("未处理的 Promise 拒绝（服务继续运行）:", reason));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    file.originalname = decodeUploadName(file.originalname);
    cb(null, Date.now() + "_" + file.originalname.replace(/[^\w.\-一-龥]/g, "_"));
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ---------- 模板 ----------
app.get("/api/templates", (req, res) => {
  const structures = {};
  for (const [name, sf] of Object.entries(TPL.STRUCTURE_FORMS)) {
    const parts = {};
    for (const part of TPL.PARTS) {
      parts[part] = sf.parts[part].map((c) => ({
        key: c.key, name: c.name, weight: c.weight, material: c.material, materials: c.materials,
        structural: c.structural.map((id) => ({ id, label: TPL.tableLabel(id) })),
        defaultStructural: c.defaultStructural, efi: c.efi, is_major: c.is_major, unit: c.unit,
      }));
    }
    structures[name] = { bridgeType: sf.bridgeType, gamma: sf.gamma, parts, note: sf.note };
  }
  res.json({
    standard: TPL.STANDARD,
    bridgeTypes: TPL.BRIDGE_TYPES,
    parts: TPL.PARTS,
    materials: TPL.MATERIALS,
    categories: CATEGORY,
    fiveClassIndicators: TPL.FIVE_CLASS_INDICATORS,
    structures,
    tables: TPL.DATA,
    gradeText: TPL.GRADE_TEXT,
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true, standard: TPL.STANDARD.code }));

app.get("/api/dashboard", (req, res) => {
  const bridges = db.prepare("SELECT id, bridge_type FROM bridges ORDER BY id DESC").all();
  const grades = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const types = {};
  let assessed = 0, pending = 0;
  for (const row of bridges) {
    types[row.bridge_type || "未分类"] = (types[row.bridge_type || "未分类"] || 0) + 1;
    const detail = getBridgeDetail(row.id);
    const result = assess(detail);
    if (result.validation.valid && result.grade >= 1 && result.grade <= 5) {
      grades[result.grade]++;
      assessed++;
    } else pending++;
  }
  res.json({
    total: bridges.length, assessed, pending,
    completionRate: bridges.length ? Math.round((assessed * 1000) / bridges.length) / 10 : 0,
    grades,
    bridgeTypes: Object.entries(types).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN")),
  });
});

// ---------- 桥梁 ----------
app.get("/api/bridges", (req, res) => {
  const rows = db.prepare("SELECT * FROM bridges ORDER BY id DESC").all();
  const out = rows.map((b) => {
    const detail = getBridgeDetail(b.id);
    const result = assess(detail);
    return {
      ...b,
      span_count: detail.spans.length,
      grade: result.grade,
      BCI: result.BCI,
      valid: result.validation.valid,
      component_count: detail.components.length,
      finding_count: detail.components.reduce((a, c) => a + c.findings.length, 0),
    };
  });
  res.json(out);
});

app.post("/api/bridges", (req, res) => {
  const b = req.body || {};
  const form = TPL.STRUCTURE_FORMS[b.structure_form];
  if (!form) return res.status(400).json({ error: "请选择有效的结构形式" });
  const spanCount = clampInt(b.span_count, 1, 50, 1);
  const info = db.prepare(`INSERT INTO bridges
    (name, bridge_type, structure_form, span_count, span_combination, total_length, max_span,
     build_year, last_grade, last_year, assess_date, org, owner, remark, five_class)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    s(b.name) || "未命名桥梁", form.bridgeType, b.structure_form, spanCount,
    s(b.span_combination), num(b.total_length), num(b.max_span), num(b.build_year),
    s(b.last_grade), num(b.last_year), s(b.assess_date), s(b.org), s(b.owner), s(b.remark),
    JSON.stringify(TPL.FIVE_CLASS_INDICATORS.map((_, i) => ({ index: i + 1, hit: false })))
  );
  const bridgeId = Number(info.lastInsertRowid);
  createSpans(bridgeId, b.structure_form, spanCount);
  res.json({ id: bridgeId, message: "创建成功" });
});

app.get("/api/bridges/:id", (req, res) => {
  const detail = getBridgeDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "未找到桥梁" });
  res.json(detail);
});

app.put("/api/bridges/:id", (req, res) => {
  const id = req.params.id;
  const ex = db.prepare("SELECT * FROM bridges WHERE id=?").get(id);
  if (!ex) return res.status(404).json({ error: "未找到桥梁" });
  const b = req.body || {};
  if (b.structure_form && b.structure_form !== ex.structure_form) {
    return res.status(400).json({ error: "结构形式不可修改；如需更换桥型请新建桥梁" });
  }
  const form = TPL.STRUCTURE_FORMS[ex.structure_form];
  const spanCount = b.span_count != null ? clampInt(b.span_count, 1, 50, ex.span_count) : ex.span_count;
  const fiveVal = b.five_class != null ? JSON.stringify(b.five_class) : ex.five_class;
  db.prepare(`UPDATE bridges SET
    name=?, bridge_type=?, span_combination=?, span_count=?, total_length=?, max_span=?, build_year=?,
    last_grade=?, last_year=?, assess_date=?, org=?, owner=?, remark=?, five_class=? WHERE id=?`).run(
    s(b.name) ?? ex.name, form ? form.bridgeType : ex.bridge_type,
    b.span_combination !== undefined ? s(b.span_combination) : ex.span_combination,
    spanCount,
    b.total_length !== undefined ? num(b.total_length) : ex.total_length,
    b.max_span !== undefined ? num(b.max_span) : ex.max_span,
    b.build_year !== undefined ? num(b.build_year) : ex.build_year,
    b.last_grade !== undefined ? s(b.last_grade) : ex.last_grade,
    b.last_year !== undefined ? num(b.last_year) : ex.last_year,
    b.assess_date !== undefined ? s(b.assess_date) : ex.assess_date,
    b.org !== undefined ? s(b.org) : ex.org,
    b.owner !== undefined ? s(b.owner) : ex.owner,
    b.remark !== undefined ? s(b.remark) : ex.remark,
    fiveVal, id
  );
  if (spanCount !== ex.span_count) syncSpanCount(id, ex.structure_form, spanCount);
  res.json({ message: "已保存" });
});

app.delete("/api/bridges/:id", (req, res) => {
  const bridge = db.prepare("SELECT id FROM bridges WHERE id=?").get(req.params.id);
  if (!bridge) return res.status(404).json({ error: "未找到桥梁" });
  const photos = db.prepare("SELECT filename FROM photos WHERE bridge_id=? OR component_id IN (SELECT id FROM components WHERE bridge_id=?)").all(req.params.id, req.params.id);
  db.prepare("DELETE FROM bridges WHERE id=?").run(req.params.id);
  for (const p of photos) removeFile(p.filename);
  res.json({ message: "已删除" });
});

// ---------- 桥跨 ----------
app.put("/api/spans/:id", (req, res) => {
  const span = db.prepare("SELECT * FROM spans WHERE id=?").get(req.params.id);
  if (!span) return res.status(404).json({ error: "未找到桥跨" });
  const b = req.body || {};
  const override = b.major_override !== undefined ? b.major_override : (span.major_override ? JSON.parse(span.major_override) : null);
  db.prepare("UPDATE spans SET name=?, major_override=? WHERE id=?").run(
    b.name !== undefined ? s(b.name) : span.name,
    override == null ? null : JSON.stringify(override),
    req.params.id
  );
  res.json({ message: "已保存" });
});

// ---------- 构件 ----------
app.put("/api/components/:id", (req, res) => {
  const comp = db.prepare("SELECT * FROM components WHERE id=?").get(req.params.id);
  if (!comp) return res.status(404).json({ error: "未找到构件" });
  const b = req.body || {};
  const catalog = TPL.COMPONENT_CATALOG[comp.comp_key];
  const memberCount = b.member_count !== undefined ? clampInt(b.member_count, 0, 100000, comp.member_count) : comp.member_count;
  const material = b.material && catalog && catalog.materials.includes(b.material) ? b.material : comp.material;
  let structural = b.structural_table !== undefined ? b.structural_table : comp.structural_table;
  if (structural && catalog && !catalog.structural.includes(structural)) {
    return res.status(400).json({ error: "所选结构性缺损评定表不适用于该构件" });
  }
  const absent = b.absent !== undefined ? (b.absent ? 1 : 0) : comp.absent;
  db.prepare("UPDATE components SET member_count=?, material=?, structural_table=?, absent=? WHERE id=?").run(
    memberCount, material, structural || null, absent, req.params.id
  );
  res.json({ message: "已保存" });
});

// ---------- 缺损 / 功能 / 影响记录 ----------
app.post("/api/components/:id/findings", (req, res) => {
  const comp = db.prepare("SELECT * FROM components WHERE id=?").get(req.params.id);
  if (!comp) return res.status(404).json({ error: "未找到构件" });
  const r = resolveFinding(comp, req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  const f = r.value;
  const info = db.prepare(`INSERT INTO findings (component_id, member_label, category, indicator, table_id, scale, description)
    VALUES (?,?,?,?,?,?,?)`).run(comp.id, f.member_label, f.category, f.indicator, f.table_id, f.scale, f.description);
  res.json({ id: Number(info.lastInsertRowid), ...f });
});

app.put("/api/findings/:id", (req, res) => {
  const old = db.prepare("SELECT * FROM findings WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({ error: "未找到记录" });
  const comp = db.prepare("SELECT * FROM components WHERE id=?").get(old.component_id);
  const merged = {
    member_label: req.body.member_label !== undefined ? req.body.member_label : old.member_label,
    category: req.body.category !== undefined ? req.body.category : old.category,
    indicator: req.body.indicator !== undefined ? req.body.indicator : old.indicator,
    table_id: req.body.table_id !== undefined ? req.body.table_id : old.table_id,
    scale: req.body.scale !== undefined ? req.body.scale : old.scale,
    description: req.body.description !== undefined ? req.body.description : old.description,
  };
  const r = resolveFinding(comp, merged);
  if (r.error) return res.status(400).json({ error: r.error });
  const f = r.value;
  db.prepare("UPDATE findings SET member_label=?, category=?, indicator=?, table_id=?, scale=?, description=? WHERE id=?")
    .run(f.member_label, f.category, f.indicator, f.table_id, f.scale, f.description, req.params.id);
  res.json({ message: "已保存", ...f });
});

app.delete("/api/findings/:id", (req, res) => {
  const photos = db.prepare("SELECT filename FROM photos WHERE finding_id=?").all(req.params.id);
  db.prepare("DELETE FROM findings WHERE id=?").run(req.params.id);
  for (const p of photos) removeFile(p.filename);
  res.json({ message: "已删除" });
});

// ---------- 图片 ----------
app.post("/api/findings/:id/photos", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "未收到文件" });
  const f = db.prepare("SELECT f.id, c.bridge_id FROM findings f JOIN components c ON c.id=f.component_id WHERE f.id=?").get(req.params.id);
  if (!f) return res.status(404).json({ error: "未找到缺损记录" });
  const info = db.prepare("INSERT INTO photos (bridge_id, component_id, finding_id, filename, original_name) VALUES (?,?,?,?,?)")
    .run(f.bridge_id, null, f.id, req.file.filename, req.file.originalname);
  res.json({ id: Number(info.lastInsertRowid), filename: req.file.filename, url: "/api/photos/" + req.file.filename });
});

const BRIDGE_PHOTO_TYPES = Object.freeze({ front: "桥梁正面照", side: "桥梁侧面照", location: "桥梁定位照" });
app.post("/api/bridges/:id/photos/:type", upload.single("file"), (req, res) => {
  const type = BRIDGE_PHOTO_TYPES[req.params.type] ? req.params.type : null;
  if (!type) return res.status(400).json({ error: "不支持的桥梁照片类型" });
  if (!req.file) return res.status(400).json({ error: "未收到文件" });
  const bridge = db.prepare("SELECT id FROM bridges WHERE id=?").get(req.params.id);
  if (!bridge) return res.status(404).json({ error: "未找到桥梁" });
  const old = db.prepare("SELECT id, filename FROM photos WHERE bridge_id=? AND bridge_photo_type=?").get(req.params.id, type);
  const info = db.prepare("INSERT INTO photos (bridge_id, filename, original_name, bridge_photo_type) VALUES (?,?,?,?)")
    .run(req.params.id, req.file.filename, req.file.originalname, type);
  if (old) {
    db.prepare("DELETE FROM photos WHERE id=?").run(old.id);
    removeFile(old.filename);
  }
  res.json({ id: Number(info.lastInsertRowid), type, label: BRIDGE_PHOTO_TYPES[type], filename: req.file.filename, url: "/api/photos/" + req.file.filename });
});

app.delete("/api/bridges/:id/photos/:type", (req, res) => {
  const type = BRIDGE_PHOTO_TYPES[req.params.type] ? req.params.type : null;
  if (!type) return res.status(400).json({ error: "不支持的桥梁照片类型" });
  const photo = db.prepare("SELECT id, filename FROM photos WHERE bridge_id=? AND bridge_photo_type=?").get(req.params.id, type);
  if (!photo) return res.status(404).json({ error: "未找到照片" });
  db.prepare("DELETE FROM photos WHERE id=?").run(photo.id);
  removeFile(photo.filename);
  res.json({ message: "已删除" });
});

app.get("/api/photos/:filename", (req, res) => {
  const fp = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(fp)) return res.status(404).end();
  res.sendFile(fp);
});

app.delete("/api/photos/:id", (req, res) => {
  const photo = db.prepare("SELECT id, filename FROM photos WHERE id=?").get(req.params.id);
  if (!photo) return res.status(404).json({ error: "未找到图片" });
  db.prepare("DELETE FROM photos WHERE id=?").run(photo.id);
  removeFile(photo.filename);
  res.json({ message: "已删除" });
});

// ---------- AI 图片甄别 ----------
app.get("/api/vision/info", (req, res) => res.json(providerInfo()));

app.post("/api/photos/:id/assess", async (req, res) => {
  if (!providerInfo().enabled) {
    return res.status(503).json({ error: "AI 图片识别未配置", detail: "请配置 VISION_PROVIDER=openai 和 VISION_API_KEY 后重启服务" });
  }
  const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(req.params.id);
  if (!photo) return res.status(404).json({ error: "未找到图片" });
  if (!photo.finding_id) return res.status(400).json({ error: "该图片未关联缺损记录" });
  const finding = db.prepare("SELECT * FROM findings WHERE id=?").get(photo.finding_id);
  const comp = finding ? db.prepare("SELECT * FROM components WHERE id=?").get(finding.component_id) : null;
  if (!finding || !comp) return res.status(400).json({ error: "关联记录不存在" });
  const imgPath = path.join(UPLOAD_DIR, photo.filename);
  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: "图片文件缺失" });
  const indicators = indicatorsFor(comp, finding.category);
  try {
    const r = await assessPhoto({
      imagePath: imgPath, partName: comp.part, componentName: comp.name,
      category: CATEGORY[finding.category] || finding.category, indicators,
    });
    db.prepare(`UPDATE photos SET ai_result=?, ai_category=?, ai_indicator=?, ai_scale=?, ai_description=?, ai_confidence=?, ai_status='suggested' WHERE id=?`)
      .run(JSON.stringify(r), finding.category, r.indicator, r.scale, r.description, r.confidence, photo.id);
    res.json({ status: "done", suggestion: r, photoId: photo.id });
  } catch (e) {
    res.status(500).json({ error: "AI 识别失败", detail: e.message });
  }
});

app.post("/api/photos/:id/apply", (req, res) => {
  const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(req.params.id);
  if (!photo) return res.status(404).json({ error: "未找到图片" });
  if (!photo.ai_indicator) return res.status(400).json({ error: "尚无 AI 建议" });
  const finding = db.prepare("SELECT * FROM findings WHERE id=?").get(photo.finding_id);
  if (!finding) return res.status(404).json({ error: "关联记录不存在" });
  const indicator = photo.ai_indicator === "无明显缺损" ? "无明显缺损" : photo.ai_indicator;
  db.prepare("UPDATE findings SET indicator=?, scale=?, description=? WHERE id=?")
    .run(indicator, photo.ai_scale, photo.ai_description, finding.id);
  db.prepare("UPDATE photos SET ai_status='applied' WHERE id=?").run(photo.id);
  res.json({ message: "已采用 AI 建议" });
});

app.post("/api/photos/:id/status", (req, res) => {
  const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(req.params.id);
  if (!photo) return res.status(404).json({ error: "未找到图片" });
  const st = (req.body && req.body.status) || "ignored";
  db.prepare("UPDATE photos SET ai_status=? WHERE id=?").run(st, photo.id);
  res.json({ message: "已更新", status: st });
});

// ---------- 评定 ----------
app.get("/api/bridges/:id/assessment", (req, res) => {
  const detail = getBridgeDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "未找到桥梁" });
  res.json(assess(detail));
});

app.get("/api/bridges/:id/export", async (req, res) => {
  const detail = getBridgeDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "未找到桥梁" });
  const result = assess(detail);
  if (!result.validation.valid) return res.status(422).json({ error: "评定数据不完整，不能导出正式报告", validation: result.validation });
  const name = `桥梁评定_${detail.name || detail.id}_${detail.id}.xlsx`;
  const out = path.join(EXPORT_DIR, name);
  try {
    await exportExcel({ bridge: detail, assessment: result }, out);
    res.download(out, name);
  } catch (e) {
    console.error("Excel 导出失败:", e);
    res.status(500).json({ error: "导出失败", detail: e.message });
  }
});

app.get("/api/bridges/:id/export-docx", async (req, res) => {
  const detail = getBridgeDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "未找到桥梁" });
  const result = assess(detail);
  if (!result.validation.valid) return res.status(422).json({ error: "评定数据不完整，不能导出正式报告", validation: result.validation });
  const name = `桥梁评定_${detail.name || detail.id}_${detail.id}.docx`;
  const out = path.join(EXPORT_DIR, name);
  try {
    await exportDocx({ bridge: detail, assessment: result }, out, UPLOAD_DIR);
    res.download(out, name);
  } catch (e) {
    console.error("Word 导出失败:", e);
    res.status(500).json({ error: "导出失败", detail: e.message });
  }
});

// ---------- 辅助 ----------
function createSpans(bridgeId, structureForm, count, startNo = 1) {
  const form = TPL.STRUCTURE_FORMS[structureForm];
  const insSpan = db.prepare("INSERT INTO spans (bridge_id, span_no, name) VALUES (?,?,?)");
  const insComp = db.prepare(`INSERT INTO components
    (bridge_id, span_id, part, comp_key, name, weight, gamma, is_major, material, structural_table, efi_table, member_count, absent, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?)`);
  for (let i = startNo; i < startNo + count; i++) {
    const span = insSpan.run(bridgeId, i, `第${i}跨`);
    let order = 0;
    for (const part of TPL.PARTS) {
      for (const c of form.parts[part]) {
        insComp.run(bridgeId, Number(span.lastInsertRowid), part, c.key, c.name, c.weight, form.gamma[part],
          c.is_major ? 1 : 0, c.material, c.defaultStructural, c.efi, order++);
      }
    }
  }
}

function syncSpanCount(bridgeId, structureForm, count) {
  const spans = db.prepare("SELECT id, span_no FROM spans WHERE bridge_id=? ORDER BY span_no").all(bridgeId);
  const max = spans.length ? Math.max(...spans.map((s) => s.span_no)) : 0;
  if (count > max) {
    // 按末尾连续补齐，避免与已有跨号冲突
    const existing = new Set(spans.map((x) => x.span_no));
    for (let no = 1; no <= count; no++) {
      if (!existing.has(no)) createSpans(bridgeId, structureForm, 1, no);
    }
  }
  if (count < max) {
    db.prepare("DELETE FROM spans WHERE bridge_id=? AND span_no>?").run(bridgeId, count);
  }
  db.prepare("UPDATE bridges SET span_count=? WHERE id=?").run(count, bridgeId);
}

function getBridgeDetail(id) {
  const bridge = db.prepare("SELECT * FROM bridges WHERE id=?").get(id);
  if (!bridge) return null;
  const spans = db.prepare("SELECT * FROM spans WHERE bridge_id=? ORDER BY span_no").all(id).map((s) => ({
    ...s,
    major_override: s.major_override ? safeJSON(s.major_override, null) : null,
  }));
  const comps = db.prepare("SELECT * FROM components WHERE bridge_id=? ORDER BY sort_order, id").all(id);
  const findings = db.prepare(`SELECT f.* FROM findings f JOIN components c ON c.id=f.component_id WHERE c.bridge_id=? ORDER BY f.id`).all(id);
  const photos = db.prepare("SELECT * FROM photos WHERE finding_id IS NOT NULL AND bridge_id=?").all(id);
  const photoByFinding = new Map();
  for (const p of photos) {
    if (!photoByFinding.has(p.finding_id)) photoByFinding.set(p.finding_id, []);
    photoByFinding.get(p.finding_id).push({
      id: p.id, filename: p.filename, original_name: p.original_name,
      ai_indicator: p.ai_indicator, ai_scale: p.ai_scale, ai_description: p.ai_description,
      ai_confidence: p.ai_confidence, ai_status: p.ai_status,
    });
  }
  const findingsByComp = new Map();
  for (const f of findings) {
    f.photos = photoByFinding.get(f.id) || [];
    if (!findingsByComp.has(f.component_id)) findingsByComp.set(f.component_id, []);
    findingsByComp.get(f.component_id).push(f);
  }
  const components = comps.map((c) => ({
    ...c,
    is_major: !!c.is_major,
    absent: !!c.absent,
    findings: findingsByComp.get(c.id) || [],
  }));
  for (const s of spans) s.components = components.filter((c) => c.span_id === s.id);
  bridge.five_class = bridge.five_class ? safeJSON(bridge.five_class, []) : [];
  bridge.spans = spans;
  bridge.components = components;
  bridge.bridge_photos = db.prepare(
    "SELECT id, bridge_photo_type AS type, filename, original_name FROM photos WHERE bridge_id=? AND bridge_photo_type IS NOT NULL ORDER BY id"
  ).all(id);
  return bridge;
}

function indicatorsFor(comp, category) {
  const out = [];
  const add = (id) => {
    const t = TPL.table(id);
    if (!t) return;
    for (const it of t.indicators) out.push({ name: it.name, scales: it.scales });
  };
  if (category === "durability") {
    const mat = TPL.MATERIALS[comp.material] || TPL.MATERIALS.concrete;
    mat.tables.forEach(add);
  } else if (category === "structural") {
    add(comp.structural_table || TPL.COMPONENT_CATALOG[comp.comp_key]?.defaultStructural);
  } else if (category === "function") {
    add(comp.efi_table || "14.5.4");
  } else {
    add("15.1.2");
  }
  return dedupeIndicators(out);
}
function dedupeIndicators(list) {
  const seen = new Set();
  return list.filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)));
}

function resolveFinding(comp, body) {
  const category = String(body.category || "");
  if (!CATEGORY[category]) return { error: "评定类别无效" };
  const catalog = TPL.COMPONENT_CATALOG[comp.comp_key];
  let tableId = body.table_id ? String(body.table_id) : null;
  if (category === "durability") {
    const mat = TPL.MATERIALS[comp.material] || TPL.MATERIALS.concrete;
    if (!tableId || !mat.tables.includes(tableId)) tableId = mat.tables[0];
  } else if (category === "structural") {
    if (tableId && catalog && !catalog.structural.includes(tableId)) {
      return { error: "该结构性缺损评定表不适用于当前构件" };
    }
    if (!tableId && !catalog) tableId = null;
  } else if (category === "function") {
    tableId = comp.efi_table || "14.5.4";
  } else if (category === "impact") {
    tableId = "15.1.2";
  }
  const t = tableId ? TPL.table(tableId) : null;
  let indicator = String(body.indicator || "").trim();
  const PSEUDO = ["未按标准或设计文件要求设置", "其他缺损", "无明显缺损"];
  if (!indicator) return { error: "请选择评定指标" };
  if (t && !t.indicators.some((x) => x.name === indicator) && !PSEUDO.includes(indicator)) {
    return { error: "评定指标不属于所选标准表" };
  }
  let scale = body.scale === "" || body.scale == null ? null : Number(body.scale);
  if (scale == null || !Number.isInteger(scale)) return { error: "请选择评定标度" };
  if (indicator === "未按标准或设计文件要求设置") scale = 3;
  const allowed = category === "impact" ? [-1, 0, 1] : t ? t.scales : [0, 1, 2, 3];
  if (!allowed.includes(scale)) return { error: `评定标度必须为 ${allowed.join("/")} ` };
  if (indicator === "无明显缺损") scale = 0;
  return {
    value: {
      member_label: String(body.member_label || "").trim() || null,
      category, indicator, table_id: tableId, scale,
      description: String(body.description || "").trim() || null,
    },
  };
}

function removeFile(filename) {
  const name = path.basename(filename || "");
  if (!name) return;
  try {
    const fp = path.join(UPLOAD_DIR, name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) { console.error("删除文件失败:", e.message); }
}
function safeJSON(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}
function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function s(v) { return v === undefined ? null : v; }
function clampInt(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

app.use((err, req, res, next) => {
  console.error("请求处理出错:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "服务器内部错误", detail: err.message });
});

app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  console.log(`桥梁技术状况评定系统（JTG/T 5230—2026）已启动： http://localhost:${PORT}`);
  console.log(`登录账号：${AUTH_USER}（有效期 ${AUTH_TTL_MS / 3600000} 小时）`);
  if (USING_DEFAULT_PASS) {
    console.warn("警告：正在使用默认密码 qiaoliang@2026，请在 .env 中设置 AUTH_PASS 后重启。");
  }
});
