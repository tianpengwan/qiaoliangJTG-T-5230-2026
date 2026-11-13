// 缺陷库管理页：桥梁类型→结构形式→部位→部件→缺陷类型（含标度定性/定量描述）+ 五类指标
const $ = (s) => document.querySelector(s);
const esc = (s) => (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let TREE = [];
let sel = null;   // { kind, data, parents }
let defectClipboard = null; // 标准库页：右键复制的部件缺陷定义
let defectContextTargetId = null;
let defectContextBound = false;
const TREE_STATE_KEY = "bridge-standard-tree-expanded-v1";
function readTreeState() { try { return JSON.parse(localStorage.getItem(TREE_STATE_KEY) || "{}"); } catch (_) { return {}; } }
function writeTreeState(state) { try { localStorage.setItem(TREE_STATE_KEY, JSON.stringify(state)); } catch (_) {} }

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); }
async function api(path, opt) {
  const r = await fetch(path, opt);
  if (!r.ok) { let m; try { m = (await r.json()).error; } catch (e) { m = await r.text(); } throw new Error(m || r.status); }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : r;
}
const POST = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const PUT = (path, body) => api(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const DEL = (path) => api(path, { method: "DELETE" });

async function loadTree() {
  TREE = await api("/api/std/tree");
  $("#treeStat").textContent = `${TREE.length} 个桥梁类型`;
  renderTree();
}

// ---------- 树渲染 ----------
function renderTree() {
  const el = $("#tree");
  el.innerHTML = TREE.map((bt) => renderBT(bt)).join("");
  // 绑定折叠
  el.querySelectorAll(".twist").forEach((t) => {
    const row = t.parentElement;
    const key = row.dataset.sel && row.dataset.id ? `${row.dataset.sel}:${row.dataset.id}` : null;
    const ch = row.nextElementSibling;
    if (key && ch) {
      const state = readTreeState();
      const expanded = state[key] !== false;
      ch.classList.toggle("hidden", !expanded);
      t.textContent = expanded ? "▾" : "▸";
    }
    t.onclick = (e) => {
      e.stopPropagation();
      if (!ch) return;
      const hidden = ch.classList.toggle("hidden");
      t.textContent = hidden ? "▸" : "▾";
      if (key) { const state = readTreeState(); state[key] = !hidden; writeTreeState(state); }
    };
  });
  // 绑定选择
  el.querySelectorAll("[data-sel]").forEach((r) => {
    r.onclick = () => onSelect(r.dataset.sel, r.dataset.id);
  });
  el.querySelectorAll("[data-act]").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); handleAct(b.dataset.act, b.dataset.id); };
  });
  bindDefectContextMenu();
}
function renderBT(bt) {
  const sfs = (bt.struct_forms || []).map(renderSF).join("");
  return `<div class="node lv1">
    <div class="row" data-sel="bridge_type" data-id="${bt.id}">
      <span class="twist">▾</span><span class="name">${esc(bt.name)}</span>
      <button class="mini-btn" data-act="add_sf" data-id="${bt.id}">＋结构形式</button>
      <button class="mini-btn" data-act="edit_bt" data-id="${bt.id}">编辑</button>
      <button class="mini-btn danger" data-act="del_bt" data-id="${bt.id}">删除</button>
    </div><div>${sfs}</div></div>`;
}
function renderSF(sf) {
  const parts = (sf.parts || []).map(renderPart).join("");
  return `<div class="node lv2" style="margin-left:18px">
    <div class="row" data-sel="struct_form" data-id="${sf.id}">
      <span class="twist">▾</span><span class="name">${esc(sf.name)}</span>
      <button class="mini-btn" data-act="add_part" data-id="${sf.id}">＋部位</button>
      <button class="mini-btn" data-act="edit_sf" data-id="${sf.id}">编辑</button>
      <button class="mini-btn danger" data-act="del_sf" data-id="${sf.id}">删除</button>
    </div><div>${parts}</div></div>`;
}
function renderPart(p) {
  const comps = (p.components || []).map(renderComp).join("");
  return `<div class="node lv3" style="margin-left:18px">
    <div class="row" data-sel="part" data-id="${p.id}">
      <span class="twist">▾</span><span class="name">${esc(p.name)}</span><span class="w">权 ${p.weight ?? ""}</span>
      <button class="mini-btn" data-act="add_comp" data-id="${p.id}">＋部件</button>
      <button class="mini-btn" data-act="edit_part" data-id="${p.id}">编辑</button>
      <button class="mini-btn danger" data-act="del_part" data-id="${p.id}">删除</button>
    </div><div>${comps}</div></div>`;
}
function renderComp(c) {
  const defs = (c.defects || []).map(renderDef).join("");
  return `<div class="node lv4" style="margin-left:18px">
    <div class="row" data-sel="component" data-id="${c.id}">
      <span class="twist">▾</span><span class="name">${esc(c.name)}</span>
      <span class="w">权 ${c.weight ?? ""}</span>
      ${c.is_major ? '<span class="badge major">主要</span>' : '<span class="badge">次要</span>'}
      <button class="mini-btn" data-act="add_def" data-id="${c.id}">＋缺陷</button>
      <button class="mini-btn" data-act="edit_comp" data-id="${c.id}">编辑</button>
      <button class="mini-btn danger" data-act="del_comp" data-id="${c.id}">删除</button>
    </div><div>${defs}</div></div>`;
}
function renderDef(d) {
  const cnt = (d.scales || []).length;
  return `<div class="node lv5" style="margin-left:18px">
    <div class="row" data-sel="defect_type" data-id="${d.id}">
      <span class="twist" style="visibility:hidden">·</span>
      <span class="name">${esc(d.name)}</span>
      <span class="badge mc">最高类别 ${d.max_class}</span>
      <span class="w">${cnt} 标度</span>
      <button class="mini-btn primary" data-act="edit_def" data-id="${d.id}">编辑</button>
      <button class="mini-btn danger" data-act="del_def" data-id="${d.id}">删除</button>
    </div></div>`;
}

function ensureDefectContextMenu() {
  let menu = $("#defectContextMenu");
  if (menu) return menu;
  menu = document.createElement("div");
  menu.id = "defectContextMenu";
  menu.className = "standard-context-menu";
  menu.hidden = true;
  menu.innerHTML = `<button type="button" data-context-action="copy">复制该部件的缺陷</button>
    <button type="button" data-context-action="paste">粘贴缺陷到此部件</button>`;
  document.body.appendChild(menu);
  menu.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-context-action]")?.dataset.contextAction;
    const targetId = defectContextTargetId;
    hideDefectContextMenu();
    if (!action || !targetId) return;
    try {
      if (action === "copy") copyComponentDefects(targetId);
      if (action === "paste") await pasteComponentDefects(targetId);
    } catch (e) { toast("操作失败：" + e.message); }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#defectContextMenu")) hideDefectContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideDefectContextMenu();
  });
  return menu;
}
function hideDefectContextMenu() {
  const menu = $("#defectContextMenu");
  if (menu) menu.hidden = true;
}
function showDefectContextMenu(componentId, event, button) {
  event.preventDefault();
  event.stopPropagation();
  const result = findComp(componentId);
  if (!result) return;
  const menu = ensureDefectContextMenu();
  defectContextTargetId = Number(componentId);
  document.querySelectorAll("#tree .row.context-target").forEach((row) => row.classList.remove("context-target"));
  button?.classList.add("context-target");
  const count = (result.comp.defects || []).length;
  const copyButton = menu.querySelector('[data-context-action="copy"]');
  const pasteButton = menu.querySelector('[data-context-action="paste"]');
  copyButton.disabled = count === 0;
  copyButton.textContent = count ? `复制该部件的缺陷（${count}个）` : "复制该部件的缺陷（无记录）";
  pasteButton.disabled = !defectClipboard || defectClipboard.componentId === Number(componentId);
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;
}
function bindDefectContextMenu() {
  ensureDefectContextMenu();
  if (defectContextBound) return;
  document.addEventListener("contextmenu", (event) => {
    const row = event.target.closest?.('#tree .row[data-sel="component"]');
    if (row) showDefectContextMenu(row.dataset.id, event, row);
  }, true);
  defectContextBound = true;
}
function copyComponentDefects(componentId) {
  const result = findComp(componentId);
  const defects = (result?.comp?.defects || []).map((d) => ({
    code: d.code, name: d.name, max_class: d.max_class, note: d.note, sort_order: d.sort_order,
    standard_ref: d.standard_ref, applicable_to: d.applicable_to, verified: d.verified,
    scales: (d.scales || []).map((s) => ({ scale: s.scale, qual: s.qual, quan: s.quan })),
  }));
  if (!defects.length) { toast("该部件暂无可复制的缺陷"); return; }
  defectClipboard = { componentId: Number(componentId), componentName: result.comp.name, defects };
  toast(`已复制 ${defects.length} 个缺陷，可右键选择目标部件粘贴`);
}
async function pasteComponentDefects(componentId) {
  if (!defectClipboard?.defects?.length) { toast("请先复制一个部件的缺陷"); return; }
  if (defectClipboard.componentId === Number(componentId)) { toast("不能粘贴到复制来源部件"); return; }
  const result = await POST(`/api/std/components/${componentId}/defect-types/bulk-copy`, { defects: defectClipboard.defects });
  await loadTree();
  toast(result.message || "缺陷定义已保存");
}

// ---------- 查找节点 ----------
function findBT(id) { return TREE.find((x) => x.id == id); }
function findSF(id) { for (const bt of TREE) { const s = (bt.struct_forms || []).find((x) => x.id == id); if (s) return { bt, sf: s }; } return null; }
function findPart(id) { for (const bt of TREE) for (const sf of (bt.struct_forms || [])) { const p = (sf.parts || []).find((x) => x.id == id); if (p) return { bt, sf, part: p }; } return null; }
function findComp(id) { for (const bt of TREE) for (const sf of (bt.struct_forms || [])) for (const p of (sf.parts || [])) { const c = (p.components || []).find((x) => x.id == id); if (c) return { bt, sf, part: p, comp: c }; } return null; }
function findDef(id) { for (const bt of TREE) for (const sf of (bt.struct_forms || [])) for (const p of (sf.parts || [])) for (const c of (p.components || [])) { const d = (c.defects || []).find((x) => x.id == id); if (d) return { bt, sf, part: p, comp: c, def: d }; } return null; }

// ---------- 选中 → 编辑区 ----------
function onSelect(kind, id) {
  if (kind === "bridge_type") { const bt = findBT(id); sel = { kind, data: bt, parents: {} }; renderEditor(); }
  if (kind === "struct_form") { const r = findSF(id); sel = { kind, data: r.sf, parents: { bt: r.bt } }; renderEditor(); }
  if (kind === "part") { const r = findPart(id); sel = { kind, data: r.part, parents: { bt: r.bt, sf: r.sf } }; renderEditor(); }
  if (kind === "component") { const r = findComp(id); sel = { kind, data: r.comp, parents: { bt: r.bt, sf: r.sf, part: r.part } }; renderEditor(); }
  if (kind === "defect_type") { const r = findDef(id); sel = { kind, data: r.def, parents: { bt: r.bt, sf: r.sf, part: r.part, comp: r.comp } }; renderEditor(); }
}

function renderEditor() {
  const e = $("#editor");
  if (!sel) { e.innerHTML = '<h3>编辑区</h3><p class="muted">请选择左侧节点。</p>'; return; }
  const d = sel.data;
  if (sel.kind === "bridge_type") {
    e.innerHTML = `<h3>编辑桥梁类型</h3>
      <div class="field"><label>编码</label><input id="e_code" value="${esc(d.code)}"></div>
      <div class="field"><label>名称 *</label><input id="e_name" value="${esc(d.name)}"></div>
      <div class="field"><label>备注</label><input id="e_note" value="${esc(d.note)}"></div>
      <div class="field"><label>排序</label><input id="e_sort" type="number" value="${d.sort_order ?? 0}"></div>
      <button class="mini-btn primary" onclick="saveNode('bridge-types')">保存</button>`;
  } else if (sel.kind === "struct_form") {
    e.innerHTML = `<h3>编辑结构形式 <span class="muted" style="font-weight:400">（属 ${esc(sel.parents.bt.name)}）</span></h3>
      <div class="field"><label>名称 *</label><input id="e_name" value="${esc(d.name)}"></div>
      <div class="field"><label>备注</label><input id="e_note" value="${esc(d.note)}"></div>
      <div class="field"><label>排序</label><input id="e_sort" type="number" value="${d.sort_order ?? 0}"></div>
      <button class="mini-btn primary" onclick="saveNode('struct-forms')">保存</button>`;
  } else if (sel.kind === "part") {
    e.innerHTML = `<h3>编辑部位 <span class="muted" style="font-weight:400">（属 ${esc(sel.parents.sf.name)}）</span></h3>
      <div class="field"><label>名称 *</label><input id="e_name" value="${esc(d.name)}"></div>
      <div class="field"><label>部位权重</label><input id="e_weight" type="number" step="0.01" value="${d.weight ?? ""}"></div>
      <div class="field"><label>排序</label><input id="e_sort" type="number" value="${d.sort_order ?? 0}"></div>
      <button class="mini-btn primary" onclick="saveNode('parts')">保存</button>`;
  } else if (sel.kind === "component") {
    e.innerHTML = `<h3>编辑部件/构件 <span class="muted" style="font-weight:400">（属 ${esc(sel.parents.part.name)}）</span></h3>
      <div class="field"><label>名称 *</label><input id="e_name" value="${esc(d.name)}"></div>
      <div class="field"><label>部件权重</label><input id="e_weight" type="number" step="0.01" value="${d.weight ?? ""}"></div>
      <div class="field"><label>是否主要</label><select id="e_major"><option value="0" ${d.is_major ? "" : "selected"}>次要</option><option value="1" ${d.is_major ? "selected" : ""}>主要</option></select></div>
      <div class="field"><label>排序</label><input id="e_sort" type="number" value="${d.sort_order ?? 0}"></div>
      <button class="mini-btn primary" onclick="saveNode('components')">保存</button>`;
  } else if (sel.kind === "defect_type") {
    renderDefectEditor();
  }
}

function renderDefectEditor() {
  const d = sel.data;
  const mc = Number(d.max_class) || 5;
  const existing = {};
  (d.scales || []).forEach((s) => (existing[s.scale] = s));
  let rows = "";
  for (let i = 1; i <= mc; i++) {
    const s = existing[i] || {};
    rows += `<tr><th>标度 ${i}</th>
      <td class="q" data-grid-row="${i}" data-grid-col="1"><textarea data-scale="${i}" data-field="qual">${esc(s.qual || "")}</textarea></td>
      <td class="q" data-grid-row="${i}" data-grid-col="2"><textarea data-scale="${i}" data-field="quan">${esc(s.quan || "")}</textarea></td></tr>`;
  }
  $("#editor").innerHTML = `<h3>编辑缺陷类型 <span class="muted" style="font-weight:400">（构件：${esc(sel.parents.comp.name)}）</span></h3>
    <div class="field"><label>缺陷类型名 *</label><input id="e_name" value="${esc(d.name)}"></div>
    <div class="field"><label>最高标度类别</label>
      <select id="e_max" onchange="changeMaxClass()">${[3, 4, 5].map((x) => `<option value="${x}" ${x === mc ? "selected" : ""}>${x}（标度1~${x}）</option>`).join("")}</select>
      <span class="hint">决定 DP 查表行（表4.1.1）与可选标度范围</span></div>
    <div class="field"><label>备注</label><input id="e_note" value="${esc(d.note)}"></div>
    <h4 style="margin:14px 0 4px">各标度定性 / 定量描述</h4>
    <table class="scales-tbl"><thead><tr><th>标度</th><th>定性描述</th><th>定量描述</th></tr></thead><tbody id="scalesBody">${rows}</tbody></table>
    <div class="paste-hint">支持从 Excel 整体复制后粘贴：可粘贴“标度 + 定性描述 + 定量描述”三列，或“定性描述 + 定量描述”两列。</div>
    <div style="margin-top:12px"><button class="mini-btn primary" onclick="saveDefect()">保存缺陷类型与标度</button></div>`;
  bindScalePaste();
}

// Excel 式选择和 TSV 粘贴：鼠标拖选红框内单元格后 Ctrl+V，按行列写入。
function bindScalePaste() {
  const body = $("#scalesBody");
  if (!body) return;
  body.tabIndex = 0;
  const resize = (ta) => { ta.style.height = "auto"; ta.style.height = `${Math.max(34, ta.scrollHeight)}px`; };
  body.querySelectorAll("textarea").forEach((ta) => { resize(ta); ta.addEventListener("input", () => resize(ta)); });
  let anchor = null, selecting = false, moved = false;
  const paint = () => {
    body.querySelectorAll("td[data-grid-row]").forEach((td) => {
      const r = Number(td.dataset.gridRow), c = Number(td.dataset.gridCol);
      const hit = anchor && r >= Math.min(anchor.r, anchor.endR) && r <= Math.max(anchor.r, anchor.endR) && c >= Math.min(anchor.c, anchor.endC) && c <= Math.max(anchor.c, anchor.endC);
      td.classList.toggle("grid-selected", !!hit);
    });
  };
  body.querySelectorAll("td[data-grid-row]").forEach((td) => {
    td.addEventListener("mousedown", (e) => { if (e.button !== 0) return; e.preventDefault(); const r=Number(td.dataset.gridRow), c=Number(td.dataset.gridCol); anchor={r,c,endR:r,endC:c}; selecting=true; moved=false; paint(); });
    td.addEventListener("mouseenter", () => { if (!selecting) return; const r=Number(td.dataset.gridRow), c=Number(td.dataset.gridCol); if (r!==anchor.endR||c!==anchor.endC) moved=true; anchor.endR=r; anchor.endC=c; paint(); });
    td.addEventListener("mouseup", () => { if (!selecting) return; selecting=false; if (!moved) { const ta=td.querySelector("textarea"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); } } else body.focus(); });
  });
  document.addEventListener("mouseup", () => { selecting=false; });
  const handlePaste = (event) => {
    if (!anchor) return;
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!text.includes("\t") && !text.includes("\n")) return;
    const rawRows = text.replace(/\r/g, "").split("\n").map((line) => line.split("\t").map((v) => v.trim()));
    const rows = rawRows.filter((r) => r.some(Boolean)).filter((r) => !/^(标度|级别|定性描述|定量描述)$/i.test((r[0] || "").trim()));
    if (!rows.length) return;
    event.preventDefault();
    let data = rows;
    if (data[0].length >= 3 && (/^\d+$/.test(data[0][0]) || /^标度\s*\d+$/.test(data[0][0]))) data = data.map(r => r.slice(1));
    const r0=Math.min(anchor.r,anchor.endR), c0=Math.min(anchor.c,anchor.endC), r1=Math.max(anchor.r,anchor.endR), c1=Math.max(anchor.c,anchor.endC);
    data.forEach((row,ri)=>row.forEach((val,ci)=>{ const r=r0+ri,c=c0+ci; if(r>r1||c>c1)return; const td=body.querySelector(`td[data-grid-row="${r}"][data-grid-col="${c}"]`); const ta=td?.querySelector("textarea"); if(ta) { ta.value=val; resize(ta); } }));
    toast(`已按选中区域粘贴 ${data.length} 行 × ${Math.max(...data.map(r=>r.length))} 列`);
  };
  body.addEventListener("paste", handlePaste);
  body.querySelectorAll("textarea").forEach((ta) => {
    ta.addEventListener("focus", () => {
      const td = ta.closest("td[data-grid-row]");
      if (!td) return;
      const r = Number(td.dataset.gridRow), c = Number(td.dataset.gridCol);
      if (!anchor || !selecting) { anchor = { r, c, endR: r, endC: c }; paint(); }
    });
    ta.addEventListener("paste", (event) => { event.stopPropagation(); handlePaste(event); });
  });
}
function changeMaxClass() {
  const mc = Number($("#e_max").value);
  const name = $("#e_name").value, note = $("#e_note").value;
  sel.data.max_class = mc;
  // 保留已填内容
  const kept = {};
  $("#scalesBody").querySelectorAll("textarea").forEach((t) => {
    const sc = t.dataset.scale, f = t.dataset.field;
    (kept[sc] = kept[sc] || {})[f] = t.value;
  });
  sel.data.scales = Object.keys(kept).map((k) => ({ scale: Number(k), qual: kept[k].qual, quan: kept[k].quan }));
  renderDefectEditor();
}

async function saveNode(kind) {
  const d = sel.data;
  const body = { name: $("#e_name").value, note: $("#e_note")?.value, sort_order: Number($("#e_sort")?.value || 0) };
  if (kind === "bridge-types") { body.code = $("#e_code").value; await PUT(`/api/std/${kind}/${d.id}`, body); }
  if (kind === "struct-forms") { body.bridge_type_id = sel.parents.bt.id; body.code = null; await PUT(`/api/std/${kind}/${d.id}`, body); }
  if (kind === "parts") { body.struct_form_id = sel.parents.sf.id; body.weight = $("#e_weight").value; body.code = null; await PUT(`/api/std/${kind}/${d.id}`, body); }
  if (kind === "components") { body.part_id = sel.parents.part.id; body.weight = $("#e_weight").value; body.is_major = $("#e_major").value === "1"; body.code = null; await PUT(`/api/std/${kind}/${d.id}`, body); }
  toast("已保存"); await loadTree();
}
async function saveDefect() {
  const d = sel.data;
  const body = { component_id: sel.parents.comp.id, name: $("#e_name").value, max_class: Number($("#e_max").value), note: $("#e_note").value, code: null, sort_order: d.sort_order ?? 0 };
  await PUT(`/api/std/defect-types/${d.id}`, body);
  const scales = [];
  $("#scalesBody").querySelectorAll("textarea").forEach((t) => {
    const sc = Number(t.dataset.scale), f = t.dataset.field;
    let row = scales.find((x) => x.scale === sc); if (!row) { row = { scale: sc }; scales.push(row); }
    row[f] = t.value;
  });
  await PUT(`/api/std/defect-types/${d.id}/scales`, scales);
  toast("缺陷类型与标度已保存"); await loadTree();
}

// ---------- 新增 / 删除 ----------
async function handleAct(act, id) {
  try {
    if (act === "add_sf") { const n = prompt("结构形式名称（如：预应力混凝土简支梁桥）"); if (n) { await POST("/api/std/struct-forms", { bridge_type_id: Number(id), name: n }); await loadTree(); } }
    else if (act === "add_part") { const n = prompt("部位名称（如：上部结构）"); if (n) { await POST("/api/std/parts", { struct_form_id: Number(id), name: n, weight: 0 }); await loadTree(); } }
    else if (act === "add_comp") { const n = prompt("部件/构件名称"); if (n) { await POST("/api/std/components", { part_id: Number(id), name: n, weight: 0, is_major: 0 }); await loadTree(); } }
    else if (act === "add_def") { const n = prompt("缺陷类型名称"); if (n) { await POST("/api/std/defect-types", { component_id: Number(id), name: n, max_class: 5 }); await loadTree(); } }
    else if (act === "edit_bt") { onSelect("bridge_type", id); }
    else if (act === "edit_sf") { onSelect("struct_form", id); }
    else if (act === "edit_part") { onSelect("part", id); }
    else if (act === "edit_comp") { onSelect("component", id); }
    else if (act === "edit_def") { onSelect("defect_type", id); }
    else if (act === "del_bt") { if (confirm("删除该桥梁类型及其下所有结构形式/部位/部件/缺陷？")) { await DEL("/api/std/bridge-types/" + id); sel = null; renderEditor(); await loadTree(); } }
    else if (act === "del_sf") { if (confirm("删除该结构形式及其下全部内容？")) { await DEL("/api/std/struct-forms/" + id); await loadTree(); } }
    else if (act === "del_part") { if (confirm("删除该部位及其下全部内容？")) { await DEL("/api/std/parts/" + id); await loadTree(); } }
    else if (act === "del_comp") { if (confirm("删除该部件及其缺陷类型？")) { await DEL("/api/std/components/" + id); await loadTree(); } }
    else if (act === "del_def") { if (confirm("删除该缺陷类型？")) { await DEL("/api/std/defect-types/" + id); sel = null; renderEditor(); await loadTree(); } }
  } catch (e) { toast("操作失败：" + e.message); }
}
function addRoot() {
  const n = prompt("桥梁类型名称（如：梁式桥）"); if (!n) return;
  POST("/api/std/bridge-types", { name: n }).then(() => loadTree()).catch((e) => toast("失败：" + e.message));
}

// ---------- 五类指标 ----------
async function loadFive() {
  const list = await api("/api/std/five-class");
  $("#fiveList").innerHTML = list.map((f, i) => `
    <div class="fc-item">
      <div class="num">${i + 1}</div>
      <textarea rows="2">${esc(f.content)}</textarea>
      <button class="mini-btn primary" onclick="saveFive(${f.id}, this)">保存</button>
      <button class="mini-btn danger" onclick="delFive(${f.id})">删除</button>
    </div>`).join("");
}
async function saveFive(id, btn) { const ta = btn.previousElementSibling; await PUT("/api/std/five-class/" + id, { content: ta.value }); toast("已保存"); await loadFive(); }
async function delFive(id) { if (!confirm("删除该指标？")) return; await DEL("/api/std/five-class/" + id); await loadFive(); }
function addFive() { const n = prompt("输入五类控制指标内容"); if (!n) return; POST("/api/std/five-class", { content: n }).then(loadFive).catch((e) => toast("失败：" + e.message)); }

// ---------- tab 切换 ----------
$("#tabTree").onclick = () => { $("#tabTree").classList.add("active"); $("#tabFive").classList.remove("active"); $("#treePanel").classList.remove("hidden"); $("#fivePanel").classList.add("hidden"); };
$("#tabFive").onclick = () => { $("#tabFive").classList.add("active"); $("#tabTree").classList.remove("active"); $("#fivePanel").classList.remove("hidden"); $("#treePanel").classList.add("hidden"); loadFive(); };

// 启动
loadTree().catch((e) => toast("加载失败：" + e.message));
