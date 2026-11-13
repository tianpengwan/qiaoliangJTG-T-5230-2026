// 评定报告导出（Excel / Word），依据 JTG/T 5230—2026
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, ImageRun, BorderStyle,
} = require("docx");
const { FIVE_CLASS_INDICATORS, GRADE_TEXT, GRADE_ACTION } = require("./templates5230");
const { CATEGORY } = require("./assess5230");

const FONT = "微软雅黑";
const THIN = { style: "thin", color: { argb: "FFBFBFBF" } };
const BORDER = { left: THIN, right: THIN, top: THIN, bottom: THIN };
const CEN = { horizontal: "center", vertical: "center", wrapText: true };
const LEFT = { horizontal: "left", vertical: "center", wrapText: true };
const FILL_T = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
const FILL_H = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };

function cell(ws, r, c, value, opt = {}) {
  const cl = ws.getCell(r, c);
  cl.value = value;
  cl.border = BORDER;
  cl.alignment = opt.align || LEFT;
  cl.font = opt.font || { name: FONT, size: 10, bold: !!opt.bold };
  if (opt.fill) cl.fill = opt.fill;
  return cl;
}

function dateText(v) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

async function exportExcel(payload, outPath) {
  const bridge = payload.bridge;
  const asm = payload.assessment;
  const wb = new ExcelJS.Workbook();
  wb.creator = "桥梁技术状况评定系统 JTG/T 5230—2026";
  wb.views = [{ showGridLines: false }];

  // ---------- 概况 ----------
  let ws = wb.addWorksheet("桥梁概况");
  ws.views = [{ showGridLines: false }];
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 48;
  ws.mergeCells("B2:C2");
  cell(ws, 2, 2, "公路桥梁技术状况评定报告", { font: { name: FONT, size: 16, bold: true, color: { argb: "FFFFFFFF" } }, fill: FILL_T, align: CEN });
  const info = [
    ["桥梁名称", bridge.name],
    ["桥型", bridge.bridge_type],
    ["结构形式", bridge.structure_form],
    ["跨径组合", bridge.span_combination],
    ["桥梁全长(m)", bridge.total_length],
    ["单孔最大跨径(m)", bridge.max_span],
    ["建成年份", bridge.build_year],
    ["评定日期", dateText(bridge.assess_date)],
    ["检测/评定单位", bridge.org],
    ["评定负责人", bridge.owner],
    ["评定标准", "JTG/T 5230—2026《公路桥梁技术状况评定标准》"],
    ["全桥技术状况指数 BCI", asm.BCI],
    ["全桥技术状况等级", asm.grade != null ? `${asm.grade} 类（${GRADE_TEXT[asm.grade]}）` : ""],
    ["备注", bridge.remark],
  ];
  let r = 4;
  for (const [k, v] of info) {
    cell(ws, r, 2, k, { bold: true, align: CEN, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } } });
    cell(ws, r, 3, v == null ? "" : v);
    r++;
  }

  // ---------- 构件评定 ----------
  ws = wb.addWorksheet("构件评定");
  ws.getColumn(1).width = 8; ws.getColumn(2).width = 12; ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 22; ws.getColumn(5).width = 8; ws.getColumn(6).width = 8;
  ws.getColumn(7).width = 8; ws.getColumn(8).width = 8; ws.getColumn(9).width = 8;
  ws.getColumn(10).width = 8; ws.getColumn(11).width = 8; ws.getColumn(12).width = 8;
  ws.getColumn(13).width = 10;
  const hdr = ["桥跨", "部位", "构件", "构件类型/材料", "权重ω", "γ", "构件数", "已评数", "EDI", "EFI", "EAI", "ECI", "等级"];
  hdr.forEach((h, i) => cell(ws, 1, i + 1, h, { bold: true, align: CEN, fill: FILL_H, font: { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } } }));
  let row = 2;
  for (const span of asm.spans || []) {
    for (const c of span.components || []) {
      const w = c.worst || {};
      const vals = [
        span.name, c.part, c.name, c.structural_table || c.comp_key,
        c.omega != null ? c.omega : c.weight, c.gamma, c.member_count, c.evaluated_members,
        w.edi != null ? w.edi : "", w.efi != null ? w.efi : "", w.eai != null ? w.eai : "",
        c.CI, `${c.ECL} 类`,
      ];
      vals.forEach((v, i) => cell(ws, row, i + 1, v, { align: CEN }));
      row++;
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hdr.length } };

  // ---------- 缺损记录 ----------
  ws = wb.addWorksheet("缺损记录");
  const h2 = ["桥跨", "部位", "构件", "构件编号/位置", "类别", "评定指标", "标准表", "标度", "描述"];
  const w2 = [8, 10, 18, 16, 12, 26, 10, 6, 40];
  h2.forEach((h, i) => { ws.getColumn(i + 1).width = w2[i]; cell(ws, 1, i + 1, h, { bold: true, align: CEN, fill: FILL_H, font: { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } } }); });
  row = 2;
  for (const span of asm.spans || []) {
    for (const c of span.components || []) {
      for (const f of c.findings || c.members.flatMap((m) => m.findings) || []) {
        const vals = [span.name, c.part, c.name, f.member_label, CATEGORY[f.category] || f.category, f.indicator, f.table_id, f.scale, f.description];
        vals.forEach((v, i) => cell(ws, row, i + 1, v == null ? "" : v, { align: i === 8 ? LEFT : CEN }));
        row++;
      }
    }
  }

  // ---------- 评定结果 ----------
  ws = wb.addWorksheet("评定结果");
  ws.getColumn(1).width = 3; ws.getColumn(2).width = 26; ws.getColumn(3).width = 40;
  ws.mergeCells("B2:C2");
  cell(ws, 2, 2, "桥跨与全桥技术状况评定结果", { font: { name: FONT, size: 14, bold: true, color: { argb: "FFFFFFFF" } }, fill: FILL_T, align: CEN });
  row = 4;
  for (const span of asm.spans || []) {
    cell(ws, row, 2, span.name, { bold: true });
    cell(ws, row, 3, `BSCI = ${span.BSCI}，${span.grade} 类（${GRADE_TEXT[span.grade]}）`);
    row++;
    if (span.grade_note) {
      ws.mergeCells(row, 2, row, 3);
      cell(ws, row, 2, "说明：" + span.grade_note);
      row++;
    }
  }
  cell(ws, row, 2, "全桥技术状况指数 BCI", { bold: true });
  cell(ws, row, 3, asm.BCI);
  row++;
  cell(ws, row, 2, "全桥技术状况等级", { bold: true });
  cell(ws, row, 3, asm.grade != null ? `${asm.grade} 类（${GRADE_TEXT[asm.grade]}）` : "");
  row++;
  cell(ws, row, 2, "养护对策", { bold: true });
  cell(ws, row, 3, asm.grade ? GRADE_ACTION[asm.grade] : "");
  row++;
  if (asm.grade_note) {
    ws.mergeCells(row, 2, row, 3);
    cell(ws, row, 2, "评定说明：" + asm.grade_note);
  }

  // ---------- 5类指标 ----------
  ws = wb.addWorksheet("5类指标检查");
  ws.getColumn(1).width = 8; ws.getColumn(2).width = 80; ws.getColumn(3).width = 10;
  ["序号", "单项控制指标", "是否命中"].forEach((h, i) => cell(ws, 1, i + 1, h, { bold: true, align: CEN, fill: FILL_H, font: { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } } }));
  const hits = new Set((bridge.five_class || []).filter((x) => x.hit).map((x) => x.index));
  FIVE_CLASS_INDICATORS.forEach((text, i) => {
    cell(ws, i + 2, 1, i + 1, { align: CEN });
    cell(ws, i + 2, 2, text);
    cell(ws, i + 2, 3, hits.has(i + 1) ? "命中" : "", { align: CEN, bold: hits.has(i + 1) });
  });

  await wb.xlsx.writeFile(outPath);
}

// ------------------------- Word -------------------------
function para(text, opt = {}) {
  return new Paragraph({
    alignment: opt.align || AlignmentType.LEFT,
    spacing: { before: opt.before || 0, after: opt.after || 60 },
    children: [new TextRun({ text: text == null ? "" : String(text), bold: !!opt.bold, size: opt.size || 21, font: FONT, color: opt.color })],
  });
}
function tc(text, opt = {}) {
  return new TableCell({
    width: { size: opt.width || 0, type: WidthType.AUTO },
    shading: opt.shading ? { fill: opt.shading } : undefined,
    children: [new Paragraph({
      alignment: opt.align || AlignmentType.LEFT,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: text == null ? "" : String(text), bold: !!opt.bold, size: 18, font: FONT })],
    })],
  });
}
function table(rows, widths = []) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((r, ri) => new TableRow({
      children: r.map((c, ci) => tc(c, {
        width: widths[ci],
        bold: ri === 0,
        align: ri === 0 ? AlignmentType.CENTER : undefined,
        shading: ri === 0 ? "EAF1F8" : undefined,
      })),
    })),
  });
}
function photoParagraphs(photos, uploadDir) {
  const out = [];
  for (const p of photos) {
    const fp = path.join(uploadDir, path.basename(p.filename || ""));
    if (!p.filename || !fs.existsSync(fp)) continue;
    try {
      const ext = path.extname(fp).slice(1).toLowerCase();
      const type = ext === "png" ? "png" : ext === "gif" ? "gif" : "jpg";
      out.push(new Paragraph({
        spacing: { before: 60, after: 40 },
        children: [new ImageRun({ type, data: fs.readFileSync(fp), transformation: { width: 320, height: 240 } })],
      }));
    } catch (e) { /* 忽略无法读取的图片 */ }
  }
  return out;
}

async function exportDocx(payload, outPath, uploadDir) {
  const bridge = payload.bridge;
  const asm = payload.assessment;
  const children = [];
  children.push(para("公路桥梁技术状况评定报告", { align: AlignmentType.CENTER, bold: true, size: 36, after: 80 }));
  children.push(para("（依据 JTG/T 5230—2026）", { align: AlignmentType.CENTER, size: 22, after: 200 }));

  children.push(para("一、桥梁概况", { bold: true, size: 26, before: 120, after: 80 }));
  children.push(table([
    ["项目", "内容", "项目", "内容"],
    ["桥梁名称", bridge.name || "", "桥型", bridge.bridge_type || ""],
    ["结构形式", bridge.structure_form || "", "跨径组合", bridge.span_combination || ""],
    ["桥梁全长(m)", bridge.total_length || "", "单孔最大跨径(m)", bridge.max_span || ""],
    ["建成年份", bridge.build_year || "", "评定日期", dateText(bridge.assess_date)],
    ["评定单位", bridge.org || "", "评定负责人", bridge.owner || ""],
  ]));

  children.push(para("二、评定结果", { bold: true, size: 26, before: 200, after: 80 }));
  children.push(table([
    ["桥跨", "BSCI", "等级", "说明"],
    ...(asm.spans || []).map((s) => [s.name, String(s.BSCI), `${s.grade} 类`, s.grade_note || ""]),
    ["全桥", String(asm.BCI == null ? "" : asm.BCI), asm.grade ? `${asm.grade} 类（${GRADE_TEXT[asm.grade]}）` : "", asm.grade_note || ""],
  ]));

  children.push(para("三、构件技术状况评定汇总", { bold: true, size: 26, before: 200, after: 80 }));
  for (const span of asm.spans || []) {
    children.push(para(span.name + `（BSCI=${span.BSCI}，${span.grade} 类）`, { bold: true, before: 80, after: 40 }));
    children.push(table([
      ["部位", "构件", "构件数", "EDI", "EFI", "EAI", "ECI", "等级"],
      ...span.components.filter((c) => !c.absent).map((c) => {
        const w = c.worst || {};
        return [c.part, c.name, String(c.member_count || 0), w.edi == null ? "" : String(w.edi), w.efi == null ? "" : String(w.efi), w.eai == null ? "" : String(w.eai), String(c.CI), `${c.ECL} 类`];
      }),
    ]));
  }

  children.push(para("四、缺损与功能异常记录", { bold: true, size: 26, before: 200, after: 80 }));
  for (const span of asm.spans || []) {
    for (const c of span.components || []) {
      const list = c.members.flatMap((m) => m.findings);
      if (!list.length) continue;
      children.push(para(`${span.name} / ${c.name}`, { bold: true, before: 80, after: 40 }));
      children.push(table([
        ["构件位置", "类别", "评定指标", "标度", "描述"],
        ...list.map((f) => [f.member_label || "", CATEGORY[f.category] || f.category, f.indicator, String(f.scale), f.description || ""]),
      ]));
      for (const f of list) children.push(...photoParagraphs(f.photos || [], uploadDir));
    }
  }

  children.push(para("五、5 类桥梁单项控制指标检查", { bold: true, size: 26, before: 200, after: 80 }));
  const hits = new Set((bridge.five_class || []).filter((x) => x.hit).map((x) => x.index));
  children.push(table([
    ["序号", "单项控制指标", "是否命中"],
    ...FIVE_CLASS_INDICATORS.map((t, i) => [String(i + 1), t, hits.has(i + 1) ? "命中" : ""]),
  ]));
  children.push(para("六、养护对策", { bold: true, size: 26, before: 200, after: 80 }));
  children.push(para(asm.grade ? `按构件技术状况等级，建议采取${GRADE_ACTION[asm.grade]}；具体方案应结合缺损范围、程度及 JTG 5120 的规定确定。` : "", {}));

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      children,
    }],
  });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
}

module.exports = { exportExcel, exportDocx };
