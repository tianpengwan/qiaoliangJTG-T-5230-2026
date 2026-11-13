// -*- coding: utf-8 -*-
// 桥梁评定 Excel 导出（Node.js 版，使用 exceljs，无 Python 依赖）
// 用法：被 server.js 直接 require 调用： const { exportBridge } = require("./export_bridge");
//       await exportBridge(payload, outPath);

const ExcelJS = require("exceljs");

// ---- 样式常量 ----
const FONT = "微软雅黑";
const TITLE = { name: FONT, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
const H = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
const B = { name: FONT, size: 10 };
const BOLD = { name: FONT, size: 10, bold: true };
const FILL_T = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
const FILL_H = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
const FILL_G = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
const THIN = { style: "thin", color: { argb: "FFBFBFBF" } };
const BORDER = { left: THIN, right: THIN, top: THIN, bottom: THIN };
const CEN = { horizontal: "center", vertical: "center", wrapText: true };
const LEFT = { horizontal: "left", vertical: "center", wrapText: true };

function cell(ws, r, c, value, opt = {}) {
  const cl = ws.getCell(r, c);
  cl.value = value;
  if (opt.font) cl.font = opt.font;
  if (opt.fill) cl.fill = opt.fill;
  cl.alignment = opt.align || LEFT;
  if (opt.border) cl.border = BORDER;
  return cl;
}

// 五个部位评分键（用于评定结果表的汇总行）
const PS_KEYS = [
  ["桥面系 BDCI", (a) => a.partScores.BDCI],
  ["上部结构 SPCI", (a) => a.partScores.SPCI],
  ["下部结构 SBCI", (a) => a.partScores.SBCI],
  ["全桥总体评分 Dr", (a) => a.Dr],
  ["全桥技术状况等级", (a) => (a.grade != null ? a.grade + " 类" : "")],
  ["5类控制指标结论", (a) => (a.fiveClassHit ? "命中→5类" : "未命中")],
];

const FIVE_INDICATORS = [
  "上部结构有落梁；或有梁、板断裂现象。",
  "梁式桥上部承重构件控制截面出现全截面开裂；或组合结构结合面开裂贯通。",
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
  "桥墩（桥台或基础）不稳定，出现严重滑动、下沉、位移、倾斜等。",
  "悬索桥、斜拉桥索塔基础严重沉降或位移；或悬索桥锚碇水平位移/沉降。",
];

async function exportBridge(payload, outPath) {
  const bridge = payload.bridge;
  const asm = payload.assessment;
  const wb = new ExcelJS.Workbook();
  wb.creator = "桥梁技术状况评定在线应用";
  wb.views = [{ showGridLines: false }];

  // ---- 0 说明 ----
  let ws = wb.addWorksheet("0_说明");
  ws.views = [{ showGridLines: false }];
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 100;
  cell(ws, 2, 2, "公路桥梁技术状况评定报告（JTG/T H21—2011）", { font: TITLE, fill: FILL_T, align: CEN });
  cell(ws, 4, 2, "本表由『桥梁技术状况评定在线应用』导出。评分依据 JTG/T H21—2011 自动计算。", { font: B });
  cell(ws, 5, 2, "等级区间：[95,100]=1类；[80,95)=2类；[60,80)=3类；[40,60)=4类；[0,40)=5类。", { font: B });
  cell(ws, 6, 2, "注：命中『五类控制指标』任一条，整桥直接判 5 类。", { font: B });

  // ---- 1 桥梁概况 ----
  ws = wb.addWorksheet("1_桥梁概况");
  ws.views = [{ showGridLines: false }];
  ws.getColumn(1).width = 3;   // 缩进
  ws.getColumn(2).width = 22;  // 标签
  ws.getColumn(3).width = 40;  // 值
  ws.getColumn(4).width = 22;  // 标签
  ws.getColumn(5).width = 40;  // 值
  cell(ws, 2, 2, "桥梁概况", { font: TITLE, fill: FILL_T, align: CEN });
  ws.mergeCells(2, 2, 2, 5);
  const basic = [
    ["桥梁名称", bridge.name], ["桥梁类型", bridge.bridge_type],
    ["结构形式", bridge.structure_form], ["跨径组合", bridge.span_combination],
    ["桥梁全长(m)", bridge.total_length], ["单孔最大跨径(m)", bridge.max_span],
    ["建成年份", bridge.build_year], ["上次评定等级", bridge.last_grade],
    ["上次评定年份", bridge.last_year], ["本次评定日期", bridge.assess_date],
    ["检测/评定单位", bridge.org], ["评定负责人", bridge.owner],
    ["备注", bridge.remark],
  ];
  let r = 4;
  for (let i = 0; i < basic.length; i += 2) {
    const left = basic[i];
    const right = basic[i + 1];
    cell(ws, r, 2, left[0], { font: BOLD, fill: FILL_G, align: LEFT, border: true });
    cell(ws, r, 3, left[1] == null ? "" : left[1], { font: B, align: LEFT, border: true });
    if (right) {
      cell(ws, r, 4, right[0], { font: BOLD, fill: FILL_G, align: LEFT, border: true });
      cell(ws, r, 5, right[1] == null ? "" : right[1], { font: B, align: LEFT, border: true });
    } else {
      // 奇数个字段时，右侧两列留空但保留边框，保持表格完整
      cell(ws, r, 4, "", { font: BOLD, fill: FILL_G, align: LEFT, border: true });
      cell(ws, r, 5, "", { font: B, align: LEFT, border: true });
    }
    r++;
  }

  // ---- 2 构件数量 ----
  ws = wb.addWorksheet("2_构件数量");
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 2, xSplit: 0 }];
  const hdr2 = ["序号", "部位", "部件名称", "是否主要部件", "构件数量 n"];
  const wdt2 = [6, 12, 30, 14, 14];
  hdr2.forEach((h, j) => {
    ws.getColumn(j + 1).width = wdt2[j];
    cell(ws, 2, j + 1, h, { font: H, fill: FILL_H, align: CEN, border: true });
  });
  r = 3;
  (bridge.components || []).forEach((comp, idx) => {
    cell(ws, r, 1, idx + 1, { font: B, align: CEN, border: true });
    cell(ws, r, 2, comp.part, { font: B, align: LEFT, border: true });
    cell(ws, r, 3, comp.name, { font: B, align: LEFT, border: true });
    cell(ws, r, 4, comp.is_major ? "是" : "否", { font: B, align: CEN, border: true });
    cell(ws, r, 5, comp.member_count || 0, { font: B, align: CEN, border: true });
    r++;
  });

  // ---- 3 缺损记录 ----
  ws = wb.addWorksheet("3_缺损记录");
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 2, xSplit: 0 }];
  const hdr3 = ["序号", "部位", "部件名称", "构件位置", "缺陷类型", "缺陷描述/范围", "缺陷标度", "最高类别", "DP(自动)", "备注"];
  const wdt3 = [5, 11, 20, 16, 14, 30, 10, 10, 10, 14];
  hdr3.forEach((h, j) => {
    ws.getColumn(j + 1).width = wdt3[j];
    cell(ws, 2, j + 1, h, { font: H, fill: FILL_H, align: CEN, border: true });
  });
  r = 3;
  let idx = 1;
  (bridge.components || []).forEach((comp) => {
    (comp.defects || []).forEach((d) => {
      cell(ws, r, 1, idx, { font: B, align: CEN, border: true });
      cell(ws, r, 2, comp.part, { font: B, align: LEFT, border: true });
      cell(ws, r, 3, comp.name, { font: B, align: LEFT, border: true });
      cell(ws, r, 4, d.member_label || "", { font: B, align: LEFT, border: true });
      cell(ws, r, 5, d.defect_type || "", { font: B, align: LEFT, border: true });
      cell(ws, r, 6, d.description || "", { font: B, align: LEFT, border: true });
      cell(ws, r, 7, d.scale || "", { font: B, align: CEN, border: true });
      cell(ws, r, 8, d.max_class != null ? d.max_class + "类" : "", { font: B, align: CEN, border: true });
      // DP 自动公式（与 openpyxl 版一致）
      ws.getCell(r, 9).value = {
        formula:
          'IF(OR($G' + r + '="",$H' + r + '=""),"",' +
          'IF($H' + r + '="5类",CHOOSE($G' + r + ',0,35,45,60,100),' +
          'IF($H' + r + '="4类",CHOOSE($G' + r + ',0,25,40,50,""),' +
          'IF($H' + r + '="3类",CHOOSE($G' + r + ',0,20,35,"",""),""))))',
      };
      ws.getCell(r, 9).font = B;
      ws.getCell(r, 9).alignment = CEN;
      ws.getCell(r, 9).border = BORDER;
      cell(ws, r, 10, "", { font: B, align: LEFT, border: true });
      r++;
      idx++;
    });
  });

  // ---- 4 五类控制指标 ----
  ws = wb.addWorksheet("4_五类控制指标");
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 2, xSplit: 0 }];
  const hdr4 = ["序号", "5 类单项控制指标", "是否命中", "情况说明"];
  const wdt4 = [5, 80, 10, 30];
  hdr4.forEach((h, j) => {
    ws.getColumn(j + 1).width = wdt4[j];
    cell(ws, 2, j + 1, h, { font: H, fill: FILL_H, align: CEN, border: true });
  });
  const fc = {};
  (bridge.five_class || []).forEach((x) => (fc[x.id] = x));
  r = 3;
  FIVE_INDICATORS.forEach((txt, i) => {
    const id = i + 1;
    const rec = fc[id] || {};
    cell(ws, r, 1, id, { font: B, align: CEN, border: true });
    cell(ws, r, 2, txt, { font: B, align: LEFT, border: true });
    cell(ws, r, 3, rec.hit ? "是" : "否", { font: B, align: CEN, border: true });
    cell(ws, r, 4, rec.note || "", { font: B, align: LEFT, border: true });
    r++;
  });

  // ---- 5 评定结果 ----
  ws = wb.addWorksheet("5_评定结果");
  ws.views = [{ showGridLines: false }];
  cell(ws, 1, 1, "评定结果（由系统依据 JTG/T H21—2011 自动计算）", { font: TITLE, fill: FILL_T, align: CEN });
  ws.mergeCells(1, 1, 1, 5);
  const scoreMap = {};
  (asm.componentScores || []).forEach((c) => (scoreMap[c.id] = c));
  const hdr5 = ["部位", "部件名称", "部件评分", "部件等级", "备注（最差构件控制）"];
  const wdt5 = [12, 30, 12, 12, 30];
  hdr5.forEach((h, j) => {
    ws.getColumn(j + 1).width = wdt5[j];
    cell(ws, 3, j + 1, h, { font: H, fill: FILL_H, align: CEN, border: true });
  });
  r = 4;
  (bridge.components || []).forEach((comp) => {
    const sc = scoreMap[comp.id] || {};
    cell(ws, r, 1, comp.part, { font: B, align: LEFT, border: true });
    cell(ws, r, 2, comp.name, { font: B, align: LEFT, border: true });
    cell(ws, r, 3, sc.score != null ? sc.score : "", { font: B, align: CEN, border: true });
    cell(ws, r, 4, sc.grade != null ? sc.grade + "类" : "", { font: B, align: CEN, border: true });
    cell(ws, r, 5, sc.controlled ? "最差构件控制" : "", { font: B, align: LEFT, border: true });
    r++;
  });
  r++;
  PS_KEYS.forEach(([k, fn]) => {
    const v = fn(asm);
    cell(ws, r, 1, k, { font: BOLD, fill: FILL_G, align: LEFT, border: true });
    ws.mergeCells(r, 2, r, 5);
    cell(ws, r, 2, v != null ? v : "", { font: B, align: LEFT, border: true });
    r++;
  });
  cell(ws, r + 1, 1, "评定意见：", { font: BOLD });
  ws.mergeCells(r + 2, 1, r + 2, 5);
  cell(ws, r + 2, 1, asm.gradeNote || "", { font: B, align: LEFT });

  await wb.xlsx.writeFile(outPath);
  return outPath;
}

module.exports = { exportBridge };
