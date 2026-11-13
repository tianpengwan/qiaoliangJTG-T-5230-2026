/* 公路桥梁技术状况评定系统 · JTG/T 5230—2026 前端 */
"use strict";

const state = {
  templates: null,
  vision: null,
  bridges: [],
  dashboard: null,
  bridge: null,
  assessment: null,
  tab: "overview",
  spanId: null,
  openParts: new Set(["桥面系", "上部结构", "下部结构", "附属构造"]),
  openComps: new Set(),
  showFindings: new Set(),
  serverUrl: localStorage.getItem("bridgeServerUrl") || "",
  token: localStorage.getItem("bridgeToken") || "",
  user: localStorage.getItem("bridgeUser") || "",
  native: !!(window.Capacitor || (location.hostname === "localhost" && !location.port)),
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (v, d = 1) => (v == null || v === "" || isNaN(v) ? "—" : Number(v).toFixed(d).replace(/\.0+$/, ""));
const today = () => new Date().toISOString().slice(0, 10);

function apiBase() {
  return state.serverUrl ? state.serverUrl.replace(/\/+$/, "") : "";
}

function tokenQuery() {
  return state.token ? "?token=" + encodeURIComponent(state.token) : "";
}

function photoUrl(filename) {
  return `${apiBase()}/api/photos/${encodeURIComponent(filename)}${tokenQuery()}`;
}

function clearAuth() {
  state.token = "";
  state.user = "";
  localStorage.removeItem("bridgeToken");
  localStorage.removeItem("bridgeUser");
}

async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(apiBase() + path, { ...opts, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (res.status === 401) {
    clearAuth();
    const e = new Error((data && data.error) || "请先登录");
    e.needLogin = true;
    renderLogin();
    throw e;
  }
  if (!res.ok) {
    const msg = data && data.error ? data.error : `请求失败（${res.status}）`;
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
  return data;
}

function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + type;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function busy(on, text = "") {
  let mask = $("#loadingMask");
  if (on) {
    if (!mask) {
      mask = document.createElement("div");
      mask.id = "loadingMask";
      mask.className = "loading-mask";
      mask.innerHTML = `<div style="text-align:center"><div class="spinner"></div><div class="small muted">${esc(text || "处理中…")}</div></div>`;
      document.body.appendChild(mask);
    }
  } else if (mask) mask.remove();
}

async function run(fn, text) {
  busy(true, text);
  try { return await fn(); }
  catch (e) { toast(e.message || "操作失败", "error"); throw e; }
  finally { busy(false); }
}

// ------------------------------ 路由 ------------------------------
window.addEventListener("hashchange", route);
document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindGlobal();
  if (!state.token) {
    renderLogin();
    return;
  }
  try {
    state.templates = await api("/api/templates");
  } catch (e) {
    if (e.needLogin) return;
    $("#app").innerHTML = `<div class="empty-state"><p>无法连接评定服务</p><p class="small">${esc(e.message)}</p><button class="btn" onclick="location.reload()">重试</button><button class="btn ghost" onclick="renderLogin()">重新登录</button></div>`;
    return;
  }
  if (state.native && !state.serverUrl) {
    renderLogin("请先填写飞牛 NAS 的服务地址并登录");
    return;
  }
  route();
  registerSW();
}

// ------------------------------ 登录 ------------------------------
function renderLogin(msg) {
  $("#tabbar").hidden = true;
  $("#app").innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="login-head">
          <div class="login-title">桥梁技术状况评定</div>
          <div class="login-sub">JTG/T 5230—2026</div>
        </div>
        <div class="form-row">
          <label>服务地址</label>
          <input class="input" id="lgUrl" value="${esc(state.serverUrl)}" placeholder="http://192.168.1.100:5230" autocapitalize="off" spellcheck="false">
          <div class="form-hint">手机 APP 请填写飞牛 NAS 的地址和端口；用浏览器直接打开本系统时留空即可。</div>
        </div>
        <div class="form-row">
          <label>账号</label>
          <input class="input" id="lgUser" value="${esc(state.user)}" autocomplete="username" autocapitalize="off">
        </div>
        <div class="form-row">
          <label>密码</label>
          <input class="input" id="lgPass" type="password" autocomplete="current-password">
        </div>
        <div class="alert error" id="lgErr" style="margin-top:10px" hidden></div>
        <button class="btn block" id="lgBtn" style="margin-top:12px">登 录</button>
        <div class="form-hint" style="margin-top:10px">账号密码由部署者在飞牛 NAS 的 .env 中通过 AUTH_USER / AUTH_PASS 设置。</div>
      </div>
    </div>`;
  const err = $("#lgErr");
  if (msg) { err.hidden = false; err.textContent = msg; }
  const submit = async () => {
    const url = $("#lgUrl").value.trim().replace(/\/+$/, "");
    const user = $("#lgUser").value.trim();
    const pass = $("#lgPass").value;
    if (!user || !pass) { err.hidden = false; err.textContent = "请输入账号和密码"; return; }
    const btn = $("#lgBtn");
    btn.disabled = true;
    btn.textContent = "登录中…";
    try {
      const res = await fetch(url + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || `登录失败（${res.status}）`);
      state.serverUrl = url;
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("bridgeServerUrl", url);
      localStorage.setItem("bridgeToken", data.token);
      localStorage.setItem("bridgeUser", data.user);
      location.hash = "#/";
      location.reload();
    } catch (e) {
      err.hidden = false;
      err.textContent = e.message === "Failed to fetch" ? "无法连接服务器，请检查地址与网络" : e.message;
      btn.disabled = false;
      btn.textContent = "登 录";
    }
  };
  $("#lgBtn").addEventListener("click", submit);
  $("#lgPass").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  $("#lgUser").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#lgPass").focus(); });
}

function logout() {
  clearAuth();
  closeModal();
  toast("已退出登录");
  renderLogin();
}

function bindGlobal() {
  $("#btnHome").addEventListener("click", () => { location.hash = "#/"; });
  $("#btnNew").addEventListener("click", () => { if (state.templates) newBridgeModal(); });
  $("#btnServer").addEventListener("click", () => renderServerSetup(false));
  $("#tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b || !state.bridge) return;
    location.hash = `#/bridge/${state.bridge.id}/${b.dataset.tab}`;
  });
  document.addEventListener("click", onGlobalClick);
  document.addEventListener("change", onGlobalChange);
}

async function route() {
  if (!state.token) { renderLogin(); return; }
  const hash = location.hash.replace(/^#/, "") || "/";
  const m = hash.match(/^\/bridge\/(\d+)(?:\/([a-z]+))?/);
  if (!m) { await renderHome(); return; }
  await renderBridge(Number(m[1]), m[2] || "overview");
}

// ------------------------------ 首页 ------------------------------
async function renderHome() {
  state.bridge = null;
  state.tab = "overview";
  $("#tabbar").hidden = true;
  $("#app").innerHTML = `<div class="empty-state"><div class="spinner"></div><p>加载中…</p></div>`;
  try {
    const [dash, list] = await Promise.all([api("/api/dashboard"), api("/api/bridges")]);
    state.dashboard = dash;
    state.bridges = list;
  } catch (e) {
    $("#app").innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`;
    return;
  }
  const d = state.dashboard;
  const items = state.bridges.map((b) => `
    <div class="bridge-item" data-act="open-bridge" data-id="${b.id}">
      <div class="grow">
        <div class="name">${esc(b.name)}</div>
        <div class="meta"><span>${esc(b.bridge_type || "")} · ${esc(b.structure_form || "")}</span><span>${b.span_count} 跨</span><span>${b.finding_count} 条记录</span></div>
      </div>
      <div class="right">${gradeBadge(b.grade, b.BCI, b.valid)}</div>
    </div>`).join("");
  $("#app").innerHTML = `
    <section class="hero">
      <h1>桥梁技术状况评定</h1>
      <p>依据 JTG/T 5230—2026 · 构件缺损→功能→影响→桥跨→全桥</p>
      <div class="stats">
        <div class="stat"><b>${d.total}</b><span>桥梁总数</span></div>
        <div class="stat"><b>${d.assessed}</b><span>已完成</span></div>
        <div class="stat"><b>${d.pending}</b><span>待完善</span></div>
        <div class="stat"><b>${d.completionRate}%</b><span>完成率</span></div>
      </div>
    </section>
    <div class="home-actions">
      <button class="btn" data-act="new-bridge">＋ 新建桥梁评定</button>
      <button class="btn secondary" data-act="help">评定方法说明</button>
    </div>
    <div class="section-title">等级分布</div>
    <div class="card">
      <div class="table-wrap">
        <table class="data" style="min-width:420px">
          <thead><tr><th>1 类</th><th>2 类</th><th>3 类</th><th>4 类</th><th>5 类</th><th>未完成</th></tr></thead>
          <tbody><tr>
            <td>${d.grades["1"] || 0}</td><td>${d.grades["2"] || 0}</td><td>${d.grades["3"] || 0}</td>
            <td>${d.grades["4"] || 0}</td><td>${d.grades["5"] || 0}</td><td>${d.pending}</td>
          </tr></tbody>
        </table>
      </div>
    </div>
    <div class="section-title">桥梁台账</div>
    <div class="card flush">${items || `<div class="empty-state" style="padding:36px 16px"><p>暂无桥梁，点击“新建桥梁评定”开始</p></div>`}</div>
  `;
}

function gradeBadge(grade, score, valid) {
  if (!grade) return `<span class="grade-badge grade-na"><b>—</b><small>未完成</small></span>`;
  return `<span class="grade-badge grade-${grade}"><b>${grade} 类</b><small>${score == null ? "" : "BCI " + fmt(score)}</small></span>`;
}

// ------------------------------ 新建 ------------------------------
function newBridgeModal() {
  const structures = state.templates.structures;
  const groups = {};
  for (const [name, sf] of Object.entries(structures)) {
    (groups[sf.bridgeType] = groups[sf.bridgeType] || []).push(name);
  }
  const options = Object.entries(groups).map(([type, list]) =>
    `<optgroup label="${esc(type)}">${list.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</optgroup>`).join("");
  openModal({
    title: "新建桥梁评定",
    body: `
      <div class="form-grid two">
        <div class="form-row" style="grid-column:1/-1"><label>桥梁名称 *</label><input class="input" id="nbName" placeholder="如：XX 大桥" maxlength="80"></div>
        <div class="form-row" style="grid-column:1/-1"><label>结构形式 *</label><select class="input" id="nbForm">${options}</select><div class="form-hint" id="nbFormNote"></div></div>
        <div class="form-row"><label>评定跨数</label><input class="input" id="nbSpans" type="number" min="1" max="50" value="1"></div>
        <div class="form-row"><label>跨径组合</label><input class="input" id="nbCombo" placeholder="如：3×30m"></div>
        <div class="form-row"><label>桥梁全长（m）</label><input class="input" id="nbLength" type="number" step="0.1"></div>
        <div class="form-row"><label>单孔最大跨径（m）</label><input class="input" id="nbMaxSpan" type="number" step="0.1"></div>
        <div class="form-row"><label>建成年份</label><input class="input" id="nbYear" type="number" min="1800" max="2100"></div>
        <div class="form-row"><label>评定日期</label><input class="input" id="nbDate" type="date" value="${today()}"></div>
        <div class="form-row"><label>评定单位</label><input class="input" id="nbOrg" placeholder="检测/评定单位"></div>
        <div class="form-row"><label>评定负责人</label><input class="input" id="nbOwner"></div>
      </div>`,
    foot: `<button class="btn ghost" data-act="close-modal">取消</button><button class="btn" id="nbCreate">创建并开始评定</button>`,
    onMount(root) {
      const form = $("#nbForm", root);
      const note = $("#nbFormNote", root);
      const sync = () => { note.textContent = structures[form.value].note || ""; };
      form.addEventListener("change", sync); sync();
      $("#nbCreate", root).addEventListener("click", async () => {
        const name = $("#nbName", root).value.trim();
        if (!name) return toast("请填写桥梁名称", "error");
        const body = {
          name, structure_form: form.value,
          span_count: Number($("#nbSpans", root).value || 1),
          span_combination: $("#nbCombo", root).value.trim(),
          total_length: $("#nbLength", root).value || null,
          max_span: $("#nbMaxSpan", root).value || null,
          build_year: $("#nbYear", root).value || null,
          assess_date: $("#nbDate", root).value || today(),
          org: $("#nbOrg", root).value.trim(), owner: $("#nbOwner", root).value.trim(),
        };
        try {
          const r = await run(() => api("/api/bridges", { method: "POST", body: JSON.stringify(body) }), "正在创建…");
          closeModal();
          location.hash = `#/bridge/${r.id}/components`;
        } catch (e) {}
      });
    },
  });
}

// ------------------------------ 桥梁页 ------------------------------
async function renderBridge(id, tab) {
  $("#tabbar").hidden = false;
  state.tab = tab;
  const same = state.bridge && state.bridge.id === id;
  if (!same) {
    $("#app").innerHTML = `<div class="empty-state"><div class="spinner"></div><p>加载桥梁数据…</p></div>`;
  }
  try {
    const [bridge, assessment] = await Promise.all([
      api(`/api/bridges/${id}`), api(`/api/bridges/${id}/assessment`),
    ]);
    state.bridge = bridge;
    state.assessment = assessment;
    if (!state.spanId || !bridge.spans.some((s) => s.id === state.spanId)) {
      state.spanId = bridge.spans[0] ? bridge.spans[0].id : null;
    }
  } catch (e) {
    $("#app").innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p><button class="btn" data-act="home">返回首页</button></div>`;
    return;
  }
  state.openParts = new Set(["桥面系", "上部结构", "下部结构", "附属构造"]);
  updateTabbar();
  if (tab === "components") renderComponents();
  else if (tab === "result") renderResult();
  else if (tab === "five") renderFive();
  else renderOverview();
}

function updateTabbar() {
  $$("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
}

function bridgeHeader(sub) {
  const b = state.bridge;
  const asm = state.assessment;
  return `
    <div class="page-head">
      <button class="icon-btn" style="background:#e6eef7;color:#0f3b66" data-act="home" aria-label="返回">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
      <div class="grow">
        <h1>${esc(b.name)}</h1>
        <div class="sub">${esc(b.structure_form)} · ${b.spans.length} 跨${sub ? " · " + esc(sub) : ""}</div>
      </div>
      <div>${gradeBadge(asm.grade, asm.BCI)}</div>
    </div>`;
}

function renderOverview() {
  const b = state.bridge;
  const asm = state.assessment;
  const photo = (type, label) => {
    const p = (b.bridge_photos || []).find((x) => x.type === type);
    return `<div class="photo-box" data-photo-type="${type}">
      ${p ? `<img src="${photoUrl(p.filename)}" alt="${esc(label)}"><button class="del" data-act="del-bridge-photo" data-type="${type}">×</button>` : `<span>＋</span>`}
      <span class="tag">${esc(label)}</span>
    </div>`;
  };
  $("#app").innerHTML = `
    ${bridgeHeader()}
    <div class="card">
      <div class="card-title"><h2>评定结论</h2><span class="right">${esc(asm.standard || "")}</span></div>
      <div class="result-hero" style="margin:0">
        <div class="grade"><b>${asm.grade || "—"}</b><small>${asm.grade ? "技术状况" : "未完成"}</small></div>
        <div class="grow">
          <div class="bci">${asm.BCI == null ? "—" : fmt(asm.BCI)}</div>
          <div class="note">全桥技术状况指数 BCI</div>
          <div class="note">${esc(asm.grade_note || "完成各构件评定后自动生成")}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title"><h2>桥梁概况</h2></div>
      <div class="form-grid two">
        <div class="form-row" style="grid-column:1/-1"><label>桥梁名称</label><input class="input" id="ovName" value="${esc(b.name)}"></div>
        <div class="form-row"><label>桥型</label><input class="input" value="${esc(b.bridge_type)}" disabled></div>
        <div class="form-row"><label>结构形式</label><input class="input" value="${esc(b.structure_form)}" disabled></div>
        <div class="form-row"><label>评定跨数</label><input class="input" id="ovSpans" type="number" min="1" max="50" value="${b.spans.length}"></div>
        <div class="form-row"><label>跨径组合</label><input class="input" id="ovCombo" value="${esc(b.span_combination)}" placeholder="如 3×30m"></div>
        <div class="form-row"><label>桥梁全长（m）</label><input class="input" id="ovLength" type="number" step="0.1" value="${b.total_length == null ? "" : b.total_length}"></div>
        <div class="form-row"><label>单孔最大跨径（m）</label><input class="input" id="ovMaxSpan" type="number" step="0.1" value="${b.max_span == null ? "" : b.max_span}"></div>
        <div class="form-row"><label>建成年份</label><input class="input" id="ovYear" type="number" value="${b.build_year == null ? "" : b.build_year}"></div>
        <div class="form-row"><label>评定日期</label><input class="input" id="ovDate" type="date" value="${esc((b.assess_date || "").slice(0, 10))}"></div>
        <div class="form-row"><label>评定单位</label><input class="input" id="ovOrg" value="${esc(b.org)}"></div>
        <div class="form-row"><label>评定负责人</label><input class="input" id="ovOwner" value="${esc(b.owner)}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>备注</label><textarea class="input" id="ovRemark">${esc(b.remark)}</textarea></div>
      </div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" id="ovSave">保存概况</button><span class="form-hint" style="align-self:center">修改评定跨数将自动增删桥跨构件</span></div>
    </div>
    <div class="card">
      <div class="card-title"><h2>桥梁照片</h2><span class="right">点击方框上传</span></div>
      <div class="photo-strip">
        ${photo("front", "正面照")}${photo("side", "侧面照")}${photo("location", "定位照")}
      </div>
      <input type="file" id="bridgePhotoInput" accept="image/*" hidden>
    </div>
    <div class="card">
      <div class="card-title"><h2>评定流程</h2></div>
      <p class="small muted" style="margin:0">耐久性缺损/结构性缺损 → 缺损状况 EDI；功能状况 EFI；影响状况 EAI；ECI = EDI + EFI + EAI（≥5 取 5）。桥跨 BSCI = 100 − Σ CI(j)·ω·γ/5；全桥按第 3.4 节汇总。</p>
    </div>
    <div class="fab-note">标准：${esc(asm.standard)} · 数据保存在服务端</div>
  `;
  $("#ovSave").addEventListener("click", saveOverview);
  $$("[data-photo-type]").forEach((box) => box.addEventListener("click", (e) => {
    if (e.target.closest("[data-act=del-bridge-photo]")) return;
    const input = $("#bridgePhotoInput");
    input.dataset.type = box.dataset.photoType;
    input.click();
  }));
  $("#bridgePhotoInput").addEventListener("change", uploadBridgePhoto);
}

async function saveOverview() {
  const b = state.bridge;
  const spanCount = Number($("#ovSpans").value || 1);
  if (spanCount !== b.spans.length) {
    if (!confirm(`评定跨数将由 ${b.spans.length} 改为 ${spanCount}。减少跨数会删除末尾桥跨及其全部记录，是否继续？`)) return;
  }
  const body = {
    name: $("#ovName").value.trim(), span_count: spanCount,
    span_combination: $("#ovCombo").value.trim(),
    total_length: $("#ovLength").value || null, max_span: $("#ovMaxSpan").value || null,
    build_year: $("#ovYear").value || null, assess_date: $("#ovDate").value || null,
    org: $("#ovOrg").value.trim(), owner: $("#ovOwner").value.trim(), remark: $("#ovRemark").value.trim(),
  };
  try {
    await run(() => api(`/api/bridges/${b.id}`, { method: "PUT", body: JSON.stringify(body) }), "保存中…");
    toast("已保存");
    await reloadBridge();
    renderOverview();
  } catch (e) {}
}

async function uploadBridgePhoto(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  const type = input.dataset.type;
  input.value = "";
  if (!file || !type) return;
  const fd = new FormData(); fd.append("file", file);
  try {
    await run(() => api(`/api/bridges/${state.bridge.id}/photos/${type}`, { method: "POST", body: fd }), "上传中…");
    toast("照片已上传");
    await reloadBridge();
    renderOverview();
  } catch (err) {}
}

// ------------------------------ 构件评定 ------------------------------
function renderComponents() {
  const b = state.bridge;
  const asm = state.assessment;
  const span = asm.spans.find((s) => s.id === state.spanId) || asm.spans[0];
  if (!span) { $("#app").innerHTML = bridgeHeader() + `<div class="empty-state">尚未设置桥跨</div>`; return; }
  state.spanId = span.id;
  const structure = state.templates.structures[b.structure_form];
  const spanComponents = (b.spans.find((s) => s.id === span.id) || {}).components || [];
  const totalMembers = spanComponents.reduce((a, c) => a + Number(c.member_count || 0), 0);
  const evaluated = span.components.reduce((a, c) => a + c.evaluated_members, 0);
  const records = spanComponents.reduce((a, c) => a + c.findings.length, 0);
  const pct = totalMembers ? Math.min(100, Math.round((evaluated * 100) / totalMembers)) : 0;

  const chips = asm.spans.map((s) => `
    <button class="chip ${s.id === span.id ? "active" : ""}" data-act="switch-span" data-id="${s.id}">
      ${esc(s.name)} · ${fmt(s.BSCI)}<span class="dot"></span>
    </button>`).join("");

  const partsHtml = state.templates.parts.map((part) => {
    const defs = structure.parts[part] || [];
    const comps = spanComponents.filter((c) => c.part === part);
    if (!comps.length) return "";
    const open = state.openParts.has(part);
    return `
      <div class="accordion" data-open="${open}">
        <button class="accordion-head" data-act="toggle-part" data-part="${esc(part)}">
          <span class="t">${esc(part)}</span>
          <span class="count">${comps.filter((c) => !c.absent).length}/${comps.length} 个构件</span>
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        </button>
        <div class="accordion-body">${comps.map((c) => componentCard(c, defs.find((d) => d.key === c.comp_key), span)).join("")}</div>
      </div>`;
  }).join("");

  $("#app").innerHTML = `
    ${bridgeHeader(`${span.name} · BSCI ${fmt(span.BSCI)}`)}
    <div class="span-chips">${chips}</div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div class="grow small muted">已评构件 ${evaluated} / ${totalMembers || "—"} · 记录 ${records} 条</div>
        <div class="small" style="font-weight:700;color:var(--brand-2)">${pct}%</div>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn small secondary" data-act="expand-all">展开全部</button>
        <button class="btn small secondary" data-act="collapse-all">收起全部</button>
        <button class="btn small ghost" data-act="help">评定说明</button>
      </div>
    </div>
    ${partsHtml}
    <div class="fab-note">构件技术状况等级：ECI≤1 为 1 类，≤2 为 2 类，≤3 为 3 类，≤4 为 4 类，>4 为 5 类（表 3.2.6）。</div>
  `;
}

function componentCard(c, def, span) {
  const asmComp = span.components.find((x) => x.id === c.id) || { members: [], CI: 0, ECL: 1, evaluated_members: 0 };
  const meta = def || { structural: [], materials: ["concrete"] };
  const gradeClass = c.absent ? "grade-na" : `grade-${asmComp.ECL}`;
  const show = state.showFindings.has(c.id);
  const typeOptions = (meta.structural || []).map((o) => `<option value="${o.id}" ${o.id === c.structural_table ? "selected" : ""}>${esc(o.label)}</option>`).join("");
  const materialOptions = (meta.materials || ["concrete"]).map((m) => `<option value="${m}" ${m === c.material ? "selected" : ""}>${esc((state.templates.materials[m] || {}).name || m)}</option>`).join("");
  const memberRows = asmComp.members.map((m) => `
    <div class="member-row">
      <span class="lab">${esc(m.label)}</span>
      <span class="nums">EDI ${m.edi} · EFI ${m.efi} · EAI ${m.eai >= 0 ? "+" : ""}${m.eai} → ECI ${m.eci}</span>
      <button class="mini-btn" data-act="add-finding" data-comp="${c.id}" data-member="${esc(m.label)}">＋记录</button>
    </div>`).join("");
  const findings = c.findings || [];
  const findingRows = findings.map((f) => {
    const cat = state.templates.categories[f.category] || f.category;
    return `<div class="finding-row">
      <div class="grow">
        <div class="ind">${esc(f.member_label || "未定位")} · ${esc(f.indicator)} <span class="badge">${esc(cat)}</span> <span class="badge blue">标度 ${f.scale}</span></div>
        ${f.description ? `<div class="desc">${esc(f.description)}</div>` : ""}
        ${(f.photos || []).length ? `<div class="thumbs">${f.photos.map((p) => `<img src="${photoUrl(p.filename)}" alt="">`).join("")}</div>` : ""}
      </div>
      <div class="ops">
        <button class="mini-btn" data-act="edit-finding" data-id="${f.id}" data-comp="${c.id}">编辑</button>
        <button class="mini-btn danger" data-act="del-finding" data-id="${f.id}">删</button>
      </div>
    </div>`;
  }).join("");

  return `
    <div class="comp-card" data-comp="${c.id}">
      <div class="comp-top">
        <div class="grow">
          <div class="comp-name">${esc(c.name)}
            ${c.is_major ? `<span class="badge red">主要构件</span>` : ""}
            ${c.absent ? `<span class="badge">未设置</span>` : ""}
          </div>
          <div class="comp-meta">
            <span>权重 ω ${fmt(c.weight, 0)}%</span><span>γ ${fmt(c.gamma, 2)}</span>
            <span>构件数 ${c.member_count || 0}</span><span>已评 ${asmComp.evaluated_members}</span>
            <span>${esc(c.structural_table || "")}</span>
          </div>
        </div>
        <div class="comp-score"><div class="v" style="color:${ecColor(asmComp.CI)}">${asmComp.CI}</div><div class="l">${asmComp.ECL} 类</div></div>
      </div>
      <div class="comp-controls">
        <input class="input num" type="number" min="0" max="100000" value="${c.member_count || 0}" data-act="set-member-count" data-comp="${c.id}" title="构件总数">
        <select class="input type" data-act="set-structural" data-comp="${c.id}">${typeOptions}</select>
        ${materialOptions ? `<select class="input" data-act="set-material" data-comp="${c.id}">${materialOptions}</select>` : ""}
        <label class="checkline" style="padding:0;font-size:12px"><input type="checkbox" ${c.absent ? "checked" : ""} data-act="set-absent" data-comp="${c.id}"> 未设置</label>
      </div>
      <div class="comp-actions">
        <button class="btn small" data-act="add-finding" data-comp="${c.id}">＋ 录入缺损/功能/影响</button>
        ${findings.length === 0 ? `<button class="btn small secondary" data-act="mark-sound" data-comp="${c.id}">未发现缺损</button>` : ""}
        <button class="btn small ghost" data-act="toggle-findings" data-comp="${c.id}">${show ? "收起" : "记录"} ${findings.length} 条</button>
      </div>
      ${asmComp.members.length ? `<div class="member-list">${memberRows}</div>` : ""}
      ${show && findingRows ? `<div class="member-list">${findingRows}</div>` : ""}
    </div>`;
}

function ecColor(ci) {
  if (ci <= 1) return "#16835f";
  if (ci <= 2) return "#2b7fb8";
  if (ci <= 3) return "#b7791f";
  if (ci <= 4) return "#c2571a";
  return "#b42318";
}

// ------------------------------ 录入弹层 ------------------------------
async function openFindingModal(compId, findingId, memberLabel) {
  const comp = state.bridge.components.find((c) => c.id === Number(compId));
  if (!comp) return;
  const def = state.templates.structures[state.bridge.structure_form].parts[comp.part].find((d) => d.key === comp.comp_key) || {};
  const existing = findingId ? (comp.findings || []).find((f) => f.id === Number(findingId)) : null;
  const allMembers = Array.from(new Set((comp.findings || []).map((f) => f.member_label).filter(Boolean)));
  const category = existing ? existing.category : "structural";
  const photoList = existing ? (existing.photos || []) : [];
  let pendingFiles = [];

  const body = `
    <div class="form-grid">
      <div class="form-row">
        <label>构件编号 / 位置 *</label>
        <input class="input" id="fdMember" value="${esc(existing ? existing.member_label || "" : memberLabel || "")}" placeholder="如 1#、3#墩、左幅第2跨">
        <div class="btn-row" style="margin-top:4px">${allMembers.slice(0, 8).map((m) => `<button type="button" class="mini-btn" data-member-pick="${esc(m)}">${esc(m)}</button>`).join("")}</div>
      </div>
      <div class="form-row">
        <label>评定类别</label>
        <div class="seg" id="fdCats">
          ${Object.entries(state.templates.categories).map(([k, v]) => `<button type="button" data-cat="${k}" class="${k === category ? "active" : ""}">${esc(v)}</button>`).join("")}
        </div>
      </div>
      <div class="form-row" id="fdTableRow"></div>
      <div class="form-row">
        <label>评定指标 *</label>
        <select class="input" id="fdIndicator"></select>
      </div>
      <div class="form-row">
        <label>评定标度 *</label>
        <div id="fdScales" class="scale-list"></div>
      </div>
      <div class="form-row">
        <label>缺损描述 / 定量记录</label>
        <textarea class="input" id="fdDesc" placeholder="如：裂缝宽 0.3mm，长 1.5m；或功能异常表现">${esc(existing ? existing.description || "" : "")}</textarea>
      </div>
      <div class="form-row">
        <label>现场照片 ${existing ? "" : "（保存后自动上传）"}</label>
        <div class="photo-strip" id="fdPhotos">
          ${photoList.map((p) => photoThumb(p)).join("")}
          <label class="photo-box" id="fdAddPhoto"><span>＋</span><span class="tag">添加照片</span><input type="file" accept="image/*" multiple hidden></label>
        </div>
        <div class="form-hint">AI 识别需在服务端配置视觉模型；识别结果仅供参考，须人工复核。</div>
      </div>
    </div>`;

  openModal({
    title: existing ? "编辑评定记录" : "录入评定记录",
    subtitle: `${comp.part} · ${comp.name}`,
    body,
    foot: `<button class="btn ghost" data-act="close-modal">取消</button><button class="btn" id="fdSave">${existing ? "保存修改" : "保存记录"}</button>`,
    onMount(root) {
      const catBox = $("#fdCats", root);
      const tableRow = $("#fdTableRow", root);
      const indSel = $("#fdIndicator", root);
      const scaleBox = $("#fdScales", root);
      let currentCat = category;
      let currentTables = [];
      let currentTableId = existing ? existing.table_id : null;
      let selectedScale = existing ? existing.scale : null;

      const tableIdsFor = (cat) => {
        if (cat === "durability") {
          const mat = state.templates.materials[comp.material] || state.templates.materials.concrete;
          return mat.tables;
        }
        if (cat === "structural") return comp.structural_table ? [comp.structural_table] : [];
        if (cat === "function") return [comp.efi_table || "14.5.4"];
        return ["15.1.2"];
      };
      const optionsFor = (cat) => {
        currentTables = tableIdsFor(cat);
        if (!currentTableId || !currentTables.includes(currentTableId)) currentTableId = currentTables[0] || null;
      };
      const renderTableRow = () => {
        if (currentTables.length > 1) {
          tableRow.innerHTML = `<label>评定表</label><select class="input" id="fdTable">${currentTables.map((id) => `<option value="${id}" ${id === currentTableId ? "selected" : ""}>表 ${id} ${esc((state.templates.tables[id] || {}).title || "")}</option>`).join("")}</select>`;
          $("#fdTable", root).addEventListener("change", (e) => { currentTableId = e.target.value; renderIndicators(); });
        } else if (currentTables.length === 1) {
          tableRow.innerHTML = `<div class="table-ref">依据：表 ${currentTableId} ${esc((state.templates.tables[currentTableId] || {}).title || "")}</div>`;
        } else {
          tableRow.innerHTML = `<div class="table-ref">该构件尚未选择结构性缺损评定表，请先在构件卡片中选择。</div>`;
        }
      };
      const renderIndicators = () => {
        const t = state.templates.tables[currentTableId];
        let list = t ? t.indicators.map((x) => ({ name: x.name, scales: x.scales })) : [];
        if (currentCat === "structural") list = list.concat([{ name: "未按标准或设计文件要求设置", scales: ["", "", "", "应设未设，标度取 3"] }]);
        list = list.concat([{ name: "其他缺损", scales: (t ? t.scales : [0, 1, 2, 3]).map((s) => "其他缺损（需在描述中说明）") }]);
        const cur = existing && existing.category === currentCat ? existing.indicator : (list[0] ? list[0].name : "");
        indSel.innerHTML = list.map((x) => `<option value="${esc(x.name)}" ${x.name === cur ? "selected" : ""}>${esc(x.name)}</option>`).join("");
        renderScales();
      };
      const renderScales = () => {
        const t = state.templates.tables[currentTableId];
        const indName = indSel.value;
        const ind = t && t.indicators.find((x) => x.name === indName);
        let scales = ind ? ind.scales : (t ? t.scales.map((s) => "") : []);
        if (indName === "未按标准或设计文件要求设置") scales = ["", "", "", "应设未设，标度取 3"];
        if (indName === "其他缺损") scales = (t ? t.scales : [0, 1, 2, 3]).map(() => "其他缺损（需在描述中说明）");
        const nums = t ? t.scales : (currentCat === "impact" ? [-1, 0, 1] : [0, 1, 2, 3]);
        if (!nums.includes(selectedScale)) selectedScale = null;
        if (selectedScale == null && indName === "未按标准或设计文件要求设置") selectedScale = 3;
        scaleBox.innerHTML = nums.map((n, i) => `
          <label class="scale-opt ${selectedScale === n ? "active" : ""}" data-scale="${n}">
            <input type="radio" name="fdScale" value="${n}" ${selectedScale === n ? "checked" : ""}>
            <span class="grow"><span class="s">标度 ${n}</span><div class="d">${esc(scales[i] || "")}</div></span>
          </label>`).join("");
        $$(".scale-opt", scaleBox).forEach((el) => el.addEventListener("click", () => {
          selectedScale = Number(el.dataset.scale);
          $$(".scale-opt", scaleBox).forEach((x) => x.classList.toggle("active", x === el));
        }));
      };
      const setupCat = (cat, reset = true) => {
        currentCat = cat;
        if (reset) { currentTableId = null; selectedScale = null; }
        optionsFor(cat);
        renderTableRow();
        renderIndicators();
      };
      setupCat(category, false);
      if (existing) indSel.value = existing.indicator;
      renderScales();

      catBox.addEventListener("click", (e) => {
        const b = e.target.closest("[data-cat]");
        if (!b) return;
        $$("[data-cat]", catBox).forEach((x) => x.classList.toggle("active", x === b));
        setupCat(b.dataset.cat, true);
      });
      indSel.addEventListener("change", () => { selectedScale = null; renderScales(); });
      $$("[data-member-pick]", root).forEach((b) => b.addEventListener("click", () => { $("#fdMember", root).value = b.dataset.memberPick; }));

      const addPhoto = $("#fdAddPhoto", root);
      addPhoto.querySelector("input").addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;
        if (!existing) {
          pendingFiles = pendingFiles.concat(files);
          pendingFiles.forEach((f) => {
            const box = document.createElement("div");
            box.className = "photo-box";
            box.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`;
            addPhoto.parentNode.insertBefore(box, addPhoto);
          });
          toast("照片将在保存记录后上传");
          return;
        }
        for (const file of files) {
          const fd = new FormData(); fd.append("file", file);
          try {
            const up = await run(() => api(`/api/findings/${existing.id}/photos`, { method: "POST", body: fd }), "上传照片…");
            const box = document.createElement("div");
            box.className = "photo-box";
            box.innerHTML = `<img src="${apiBase()}${up.url}" alt=""><button class="del" data-del-photo="${up.id}">×</button>`;
            addPhoto.parentNode.insertBefore(box, addPhoto);
          } catch (err) { break; }
        }
      });

      // 已有照片：AI / 删除
      $$("[data-ai]", root).forEach((b) => b.addEventListener("click", async () => {
        const pid = b.dataset.ai;
        const wrap = b.closest(".photo-box");
        try {
          const r = await run(() => api(`/api/photos/${pid}/assess`, { method: "POST" }), "AI 识别中…");
          const s = r.suggestion;
          wrap.querySelector(".ai-note").innerHTML = `建议：${esc(s.indicator)}（标度 ${s.scale}）`;
          const applyBtn = document.createElement("button");
          applyBtn.type = "button"; applyBtn.className = "mini-btn"; applyBtn.textContent = "采用";
          applyBtn.addEventListener("click", async () => {
            try {
              await run(() => api(`/api/photos/${pid}/apply`, { method: "POST" }), "应用中…");
              toast("已采用 AI 建议");
              closeModal();
              await reloadBridge();
              location.hash = `#/bridge/${state.bridge.id}/components`;
            } catch (err) {}
          });
          wrap.querySelector(".ai-note").appendChild(applyBtn);
        } catch (err) { toast(err.message || "AI 识别失败", "error"); }
      }));
      $$("[data-del-photo]", root).forEach((b) => b.addEventListener("click", async () => {
        try {
          await run(() => api(`/api/photos/${b.dataset.delPhoto}`, { method: "DELETE" }), "删除中…");
          b.closest(".photo-box").remove();
        } catch (err) {}
      }));

      $("#fdSave", root).addEventListener("click", async () => {
        const member = $("#fdMember", root).value.trim();
        if (!member) return toast("请填写构件编号/位置", "error");
        if (selectedScale == null) return toast("请选择评定标度", "error");
        const t = state.templates.tables[currentTableId];
        let indicator = indSel.value;
        const payload = {
          member_label: member, category: currentCat, indicator,
          table_id: indicator === "未按标准或设计文件要求设置" ? null : currentTableId,
          scale: selectedScale, description: $("#fdDesc", root).value.trim(),
        };
        try {
          let saved;
          if (existing) saved = await run(() => api(`/api/findings/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) }), "保存中…");
          else saved = await run(() => api(`/api/components/${comp.id}/findings`, { method: "POST", body: JSON.stringify(payload) }), "保存中…");
          if (!existing && pendingFiles.length) {
            for (const file of pendingFiles) {
              const fd = new FormData(); fd.append("file", file);
              await api(`/api/findings/${saved.id}/photos`, { method: "POST", body: fd });
            }
          }
          closeModal();
          toast("已保存");
          await reloadBridge();
          location.hash = `#/bridge/${state.bridge.id}/components`;
        } catch (e) {}
      });
    },
  });
}

function photoThumb(p) {
  const status = p.ai_status === "applied" ? "已采用" : p.ai_status === "suggested" ? "AI建议" : "";
  return `<div class="photo-box">
    <img src="${photoUrl(p.filename)}" alt="">
    <button class="del" type="button" data-del-photo="${p.id}">×</button>
    <div class="ai-note tiny" style="position:absolute;left:0;right:0;top:0;background:rgba(255,255,255,.9);padding:1px 2px;font-size:8.5px;line-height:1.3">${esc(status)} <button type="button" class="mini-btn" style="padding:0 3px;font-size:9px" data-ai="${p.id}">AI</button></div>
  </div>`;
}

// ------------------------------ 评定结果 ------------------------------
function renderResult() {
  const b = state.bridge;
  const asm = state.assessment;
  const v = asm.validation || { errors: [], warnings: [] };
  const span = asm.spans.find((s) => s.id === state.spanId) || asm.spans[0];
  const chips = asm.spans.map((s) => `<button class="chip ${s.id === state.spanId ? "active" : ""}" data-act="switch-span" data-id="${s.id}">${esc(s.name)} · ${s.grade ? s.grade + " 类" : "未评定"}</button>`).join("");

  const spanCards = asm.spans.map((s) => {
    const ov = s.major_override || { hit: false, note: "" };
    return `
      <div class="card">
        <div class="card-title"><h2>${esc(s.name)}</h2><span class="right">BSCI ${fmt(s.BSCI)} · ${s.grade ? s.grade + " 类" : "未评定"}</span></div>
        ${s.grade_note ? `<div class="alert info">${esc(s.grade_note)}</div>` : ""}
        <div class="form-row inline"><label>主要构件 4/5 类</label><input type="checkbox" ${ov.hit ? "checked" : ""} data-act="override" data-span="${s.id}" data-field="hit"><span class="form-hint">且影响桥梁安全时，按第 3.3.3 条处理</span></div>
        <div class="form-row" style="margin-top:6px"><input class="input" data-act="override" data-span="${s.id}" data-field="note" value="${esc(ov.note || "")}" placeholder="复核说明（可选）"></div>
      </div>`;
  }).join("");

  const tableRows = span ? span.components.filter((c) => !c.absent).map((c) => `
    <tr>
      <td class="left">${esc(c.part)}</td><td class="left">${esc(c.name)}</td>
      <td>${fmt(c.weight, 0)}</td><td>${fmt(c.omega || c.weight, 1)}</td><td>${fmt(c.gamma, 2)}</td>
      <td>${c.member_count || 0}</td><td>${c.evaluated_members}</td>
      <td>${c.worst ? c.worst.edi : "—"}</td><td>${c.worst ? c.worst.efi : "—"}</td><td>${c.worst ? (c.worst.eai >= 0 ? "+" : "") + c.worst.eai : "—"}</td>
      <td><b>${c.CI}</b></td><td>${c.ECL} 类</td><td>${fmt(c.contribution || 0, 2)}</td>
    </tr>`).join("") : "";

  const partRows = span ? state.templates.parts.map((p) => {
    const ps = span.parts[p];
    return `<tr><td class="left">${esc(p)}</td><td>${ps ? ps.present : 0}</td><td>${ps ? fmt(ps.contribution, 2) : "—"}</td><td>${fmt((state.templates.structures[b.structure_form].gamma || {})[p], 2)}</td></tr>`;
  }).join("") : "";

  const errHtml = v.errors.length ? `<div class="alert error"><b>数据不完整，无法导出正式报告：</b><ul>${v.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  const warnHtml = v.warnings.length ? `<div class="alert warn"><b>提示（不影响计算）：</b><ul>${v.warnings.slice(0, 12).map((x) => `<li>${esc(x)}</li>`).join("")}${v.warnings.length > 12 ? `<li>…共 ${v.warnings.length} 条</li>` : ""}</ul></div>` : "";
  const fiveHtml = asm.fiveClassHit ? `<div class="alert error"><b>命中 5 类单项控制指标：</b><ul>${asm.fiveClass.map((x) => `<li>${esc(state.templates.fiveClassIndicators[x.index - 1])}</li>`).join("")}</ul></div>` : "";

  $("#app").innerHTML = `
    ${bridgeHeader()}
    <div class="result-hero">
      <div class="grade"><b>${asm.grade || "—"}</b><small>${asm.grade ? "全桥等级" : "未完成"}</small></div>
      <div class="grow">
        <div class="bci">${asm.BCI == null ? "—" : fmt(asm.BCI)}</div>
        <div class="note">全桥技术状况指数 BCI · ${esc(asm.grade_text || "")}</div>
        <div class="note">${esc(asm.grade_note || "完善构件评定后自动计算")}</div>
      </div>
    </div>
    ${fiveHtml}${errHtml}${warnHtml}
    <div class="section-title">桥跨评定</div>
    <div class="span-chips">${chips}</div>
    ${spanCards}
    <div class="card">
      <div class="card-title"><h2>${esc(span ? span.name : "")} 构件评定明细</h2></div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th class="left">部位</th><th class="left">构件</th><th>ω</th><th>归一ω</th><th>γ</th><th>构件数</th><th>已评</th><th>EDI</th><th>EFI</th><th>EAI</th><th>ECI</th><th>等级</th><th>扣分</th></tr></thead>
          <tbody>${tableRows || `<tr><td colspan="13">暂无构件</td></tr>`}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table class="data" style="min-width:420px">
          <thead><tr><th class="left">部位</th><th>启用部件</th><th>扣分合计</th><th>γ</th></tr></thead>
          <tbody>${partRows}</tbody>
        </table>
      </div>
      <div class="alert info" style="margin-top:8px">BSCI = 100 − Σ(CI(j)×ω×γ/5) = <b>${span ? fmt(span.BSCI) : "—"}</b>。未设置的构件不参与计算，权重在部位内按比例归一。</div>
    </div>
    <div class="card">
      <div class="card-title"><h2>导出报告</h2></div>
      <div class="btn-row">
        <button class="btn" data-act="export" data-type="xlsx">导出 Excel 报告</button>
        <button class="btn secondary" data-act="export" data-type="docx">导出 Word 报告</button>
      </div>
      <div class="form-hint" style="margin-top:8px">报告包含桥梁概况、构件评定汇总、缺损记录、桥跨/全桥结果及 5 类指标检查。数据不完整时不允许导出。</div>
    </div>
    <div class="fab-note">依据 ${esc(asm.standard)}；结果为系统自动计算，正式报告须经检测人员复核签认。</div>
  `;
}

// ------------------------------ 5类指标 ------------------------------
function renderFive() {
  const b = state.bridge;
  const list = state.templates.fiveClassIndicators;
  const selected = new Map((b.five_class || []).map((x) => [x.index, !!x.hit]));
  $("#app").innerHTML = `
    ${bridgeHeader()}
    <div class="card">
      <div class="card-title"><h2>5 类桥梁单项控制指标</h2><span class="right">第 3.4.5 条</span></div>
      <div class="alert info">全桥技术状况评定中，出现下列任一情况，全桥技术状况等级直接评定为 5 类。</div>
      ${list.map((t, i) => {
        const hit = selected.get(i + 1);
        return `<div class="five-item ${hit ? "hit" : ""}">
          <div class="no">${i + 1}</div>
          <div class="txt">${esc(t)}</div>
          <input type="checkbox" data-five="${i + 1}" ${hit ? "checked" : ""}>
        </div>`;
      }).join("")}
      <div class="btn-row" style="margin-top:14px"><button class="btn" id="fiveSave">保存检查结果</button></div>
    </div>
    <div class="fab-note">未命中时，按构件、桥跨、全桥逐级计算结果评定。</div>
  `;
  $("#fiveSave").addEventListener("click", async () => {
    const arr = list.map((_, i) => ({ index: i + 1, hit: !!$(`[data-five="${i + 1}"]`).checked }));
    try {
      await run(() => api(`/api/bridges/${b.id}`, { method: "PUT", body: JSON.stringify({ five_class: arr }) }), "保存中…");
      toast("已保存");
      await reloadBridge();
      renderFive();
      updateTabbar();
    } catch (e) {}
  });
}

// ------------------------------ 全局交互 ------------------------------
async function onGlobalClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (act === "home") { location.hash = "#/"; return; }
  if (act === "open-bridge") { location.hash = `#/bridge/${el.dataset.id}/overview`; return; }
  if (act === "new-bridge") { newBridgeModal(); return; }
  if (act === "help") { helpModal(); return; }
  if (act === "close-modal") { closeModal(); return; }
  if (act === "switch-span") {
    state.spanId = Number(el.dataset.id);
    if (state.tab === "result") renderResult(); else renderComponents();
    return;
  }
  if (act === "toggle-part") {
    const p = el.dataset.part;
    const box = el.closest(".accordion");
    const open = box.dataset.open !== "true";
    box.dataset.open = open;
    if (open) state.openParts.add(p); else state.openParts.delete(p);
    return;
  }
  if (act === "expand-all") { state.openParts = new Set(state.templates.parts); renderComponents(); return; }
  if (act === "collapse-all") { state.openParts = new Set(); renderComponents(); return; }
  if (act === "toggle-findings") {
    const id = Number(el.dataset.comp);
    if (state.showFindings.has(id)) state.showFindings.delete(id); else state.showFindings.add(id);
    renderComponents();
    return;
  }
  if (act === "mark-sound") {
    const comp = state.bridge.components.find((c) => c.id === Number(el.dataset.comp));
    if (!comp) return;
    try {
      await run(() => api(`/api/components/${comp.id}/findings`, {
        method: "POST",
        body: JSON.stringify({
          member_label: "全构件",
          category: "structural",
          indicator: "无明显缺损",
          table_id: comp.structural_table,
          scale: 0,
          description: "经检查，本构件未发现标准表列结构性缺损。",
        }),
      }), "保存中…");
      toast("已标记为未发现缺损");
      await reloadBridge();
      renderComponents();
    } catch (err) {}
    return;
  }
  if (act === "add-finding") {
    openFindingModal(el.dataset.comp, null, el.dataset.member || "");
    return;
  }
  if (act === "edit-finding") { openFindingModal(el.dataset.comp, el.dataset.id); return; }
  if (act === "del-finding") {
    if (!confirm("确认删除该条评定记录？")) return;
    try {
      await run(() => api(`/api/findings/${el.dataset.id}`, { method: "DELETE" }), "删除中…");
      toast("已删除");
      await reloadBridge();
      renderComponents();
    } catch (err) {}
    return;
  }
  if (act === "del-bridge-photo") {
    if (!confirm("确认删除该照片？")) return;
    try {
      await run(() => api(`/api/bridges/${state.bridge.id}/photos/${el.dataset.type}`, { method: "DELETE" }), "删除中…");
      toast("已删除");
      await reloadBridge();
      renderOverview();
    } catch (err) {}
    return;
  }
  if (act === "export") {
    const url = `${apiBase()}/api/bridges/${state.bridge.id}/export${el.dataset.type === "docx" ? "-docx" : ""}${tokenQuery()}`;
    const a = document.createElement("a");
    a.href = url; a.download = ""; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    toast("正在生成报告，请稍候…");
    return;
  }
}

async function onGlobalChange(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (act === "set-member-count" || act === "set-structural" || act === "set-material" || act === "set-absent") {
    const body = {};
    if (act === "set-member-count") body.member_count = Number(el.value || 0);
    if (act === "set-structural") body.structural_table = el.value;
    if (act === "set-material") body.material = el.value;
    if (act === "set-absent") body.absent = el.checked;
    try {
      await api(`/api/components/${el.dataset.comp}`, { method: "PUT", body: JSON.stringify(body) });
      await reloadBridge();
      if (state.tab === "components") renderComponents(); else renderResult();
      toast("已保存");
    } catch (err) { toast(err.message || "保存失败", "error"); }
    return;
  }
  if (act === "override") {
    const spanId = Number(el.dataset.span);
    const span = state.bridge.spans.find((s) => s.id === spanId);
    const ov = Object.assign({ hit: false, note: "" }, span.major_override || {});
    if (el.dataset.field === "hit") ov.hit = el.checked;
    else ov.note = el.value;
    try {
      await api(`/api/spans/${spanId}`, { method: "PUT", body: JSON.stringify({ major_override: ov }) });
      await reloadBridge();
      renderResult();
      toast("已更新评定");
    } catch (err) { toast(err.message || "保存失败", "error"); }
  }
}

async function reloadBridge() {
  const id = state.bridge.id;
  const [bridge, assessment] = await Promise.all([api(`/api/bridges/${id}`), api(`/api/bridges/${id}/assessment`)]);
  state.bridge = bridge;
  state.assessment = assessment;
  if (!bridge.spans.some((s) => s.id === state.spanId)) state.spanId = bridge.spans[0] ? bridge.spans[0].id : null;
}

// ------------------------------ 弹层 ------------------------------
function openModal({ title, subtitle, body, foot, onMount, locked }) {
  closeModal(true);
  const overlay = $("#overlay");
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("show"));
  const root = $("#modalRoot");
  root.innerHTML = `
    <div class="modal" id="modal" data-locked="${locked ? "1" : "0"}">
      <div class="modal-head">
        <div style="flex:1;min-width:0"><h2>${esc(title)}</h2>${subtitle ? `<div class="small muted">${esc(subtitle)}</div>` : ""}</div>
        ${locked ? "" : `<button class="mini-btn" data-act="close-modal" aria-label="关闭">关闭</button>`}
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
    </div>`;
  requestAnimationFrame(() => $("#modal").classList.add("show"));
  overlay.onclick = () => { if (!locked) closeModal(); };
  if (onMount) onMount(root);
}
function closeModal(immediate) {
  const overlay = $("#overlay");
  const modal = $("#modal");
  if (modal && modal.dataset.locked === "1" && !immediate) return;
  if (closeModal._t) { clearTimeout(closeModal._t); closeModal._t = null; }
  if (!modal) { $("#modalRoot").innerHTML = ""; overlay.hidden = true; overlay.classList.remove("show"); return; }
  overlay.classList.remove("show");
  modal.classList.remove("show");
  const done = () => { $("#modalRoot").innerHTML = ""; overlay.hidden = true; overlay.onclick = null; closeModal._t = null; };
  if (immediate) done(); else closeModal._t = setTimeout(done, 200);
}

function helpModal() {
  openModal({
    title: "评定方法说明",
    body: `
      <div class="card" style="box-shadow:none;padding:0;border:0">
        <h3>1. 评定流程</h3>
        <p class="small muted">构件耐久性缺损、结构性缺损 → 缺损状况 EDI；构件功能状况 EFI；构件影响状况 EAI；构件技术状况 ECI = EDI + EFI + EAI（≥5 取 5）。</p>
        <h3>2. 桥跨评定</h3>
        <p class="small muted">BSCI = 100 − Σ CI(j)×ω×γ/5。CI(j) 为第 j 类部件中最差构件的 ECI；ω 为部件权重，γ 为部位影响系数，按附录 B 取值。</p>
        <h3>3. 全桥评定</h3>
        <p class="small muted">单跨直接采用桥跨结果；多跨等级一致时取算术平均；等级不一致时按式(3.4.3)计算，并以最差桥跨等级作为全桥等级。</p>
        <h3>4. 5 类单项控制指标</h3>
        <p class="small muted">命中任一单项控制指标，全桥直接评定为 5 类。</p>
        <h3>5. 等级区间</h3>
        <p class="small muted">桥跨：BSCI＞90 为 1 类，＞75 为 2 类，＞60 为 3 类，＞40 为 4 类，≤40 为 5 类。</p>
        <h3>6. 数据处理</h3>
        <p class="small muted">每个构件可录入多条耐久性、结构性、功能和影响记录，系统取同类最大标度。未录入缺损的构件按完好（ECI=0）参与计算；未设置的构件不计入并在部位内重新归一权重。</p>
      </div>`,
    foot: `<button class="btn" data-act="close-modal">知道了</button>`,
  });
}

function renderServerSetup(required) {
  openModal({
    title: required ? "连接评定服务器" : "服务器设置",
    subtitle: required ? "首次使用请填写飞牛 NAS 的访问地址" : "手机 APP / 异地访问时使用",
    locked: !!required,
    body: `
      <div class="form-row">
        <label>服务地址</label>
        <input class="input" id="srvUrl" value="${esc(state.serverUrl)}" placeholder="http://192.168.1.100:5230">
        <div class="form-hint">局域网填飞牛 NAS 的 IP 和端口；不要以 / 结尾。浏览器直接访问时可留空。</div>
      </div>
      <div class="form-row" style="margin-top:10px">
        <label>当前账号</label>
        <input class="input" value="${esc(state.user || "未登录")}" disabled>
        <div class="form-hint">账号密码在飞牛 NAS 的 .env 中配置，修改后需重启容器。</div>
      </div>
      <div class="alert info" id="srvTest" style="margin-top:10px">填写后可点击“测试连接”。</div>`,
    foot: required
      ? `<button class="btn" id="srvSave">保存并连接</button>`
      : `<button class="btn danger" id="srvLogout">退出登录</button><button class="btn ghost" data-act="close-modal">取消</button><button class="btn secondary" id="srvTestBtn">测试连接</button><button class="btn" id="srvSave">保存</button>`,
    onMount(root) {
      const input = $("#srvUrl", root);
      const save = () => {
        const v = input.value.trim().replace(/\/+$/, "");
        state.serverUrl = v;
        localStorage.setItem("bridgeServerUrl", v);
        closeModal();
        toast("已保存服务地址");
        if (required) location.reload();
      };
      $("#srvSave", root).addEventListener("click", save);
      const out = $("#srvLogout", root);
      if (out) out.addEventListener("click", () => {
        if (confirm("确定退出登录？退出后需要重新输入账号密码。")) logout();
      });
      const test = $("#srvTestBtn", root);
      if (test) test.addEventListener("click", async () => {
        const v = input.value.trim().replace(/\/+$/, "");
        const box = $("#srvTest", root);
        box.className = "alert info"; box.textContent = "正在测试…";
        try {
          const r = await fetch(v + "/api/health");
          const j = await r.json();
          box.className = "alert info"; box.innerHTML = `连接成功：${esc(j.standard || "OK")}`;
        } catch (e) { box.className = "alert error"; box.textContent = "连接失败：" + e.message; }
      });
    },
  });
}

// ------------------------------ PWA ------------------------------
function registerSW() {
  if (state.native || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
