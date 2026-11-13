// DOCX 评定报告导出，包含缺陷照片及评分摘要。
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, ImageRun, PageBreak, ShadingType
} = require("docx");

const blue = "1F4E78";
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathDocument = mathjax.document("", { InputJax: new TeX(), OutputJax: new SVG({ fontCache: "none" }) });
const cell = (text, bold = false) => new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(text ?? ""), bold, font: "Microsoft YaHei", size: 20 })] })] });
const table = (headers, rows, columnWidths) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, ...(columnWidths ? { columnWidths } : {}), rows: [
  new TableRow({ children: headers.map((h) => new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: "000000", font: "Microsoft YaHei", size: 20 })] })] })) }),
  ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) }))
] });
const formula = (text, bold = false) => new Paragraph({ spacing: { before: 50, after: 50 }, children: [new TextRun({ text, bold, font: "Consolas", size: 19 })] });
const round2 = (v) => Math.round(Number(v) * 100) / 100;
const memberScoreSymbol = (part) => ({ "上部结构": "PMCI", "下部结构": "BMCI", "桥面系": "DMCI" }[part] || "PMCI");
const componentScoreSymbol = (part) => ({ "上部结构": "PCCI", "下部结构": "BCCI", "桥面系": "DCCI" }[part] || "PCCI");
function readableFilename(name) {
  if (!name || !/[\u0080-\u00ff]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return /[\u3400-\u9fff]/.test(decoded) && !decoded.includes("�") ? decoded : name;
  } catch (e) { return name; }
}

async function formulaImage(tex, fallback) {
  try {
    const node = mathDocument.convert(tex, { display: true });
    const svg = adaptor.outerHTML(node).replace(/^<mjx-container[^>]*>/, "").replace(/<\/mjx-container>$/, "");
    const png = await sharp(Buffer.from(svg)).resize({ width: 900, withoutEnlargement: true }).png().toBuffer();
    const meta = await sharp(png).metadata();
    const width = Math.min(520, meta.width || 520);
    const height = Math.max(24, Math.round((meta.height || 50) * width / (meta.width || width)));
    return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new ImageRun({ data: png, transformation: { width, height }, type: "png" })] });
  } catch (e) {
    return formula(fallback || tex);
  }
}

async function calculationProcess(a) {
  const out = [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "四、详细计算过程", font: "Microsoft YaHei" })] })];
  if (a.fiveClassHit) {
    out.push(new Paragraph({ children: [new TextRun({ text: "命中五类桥梁单项控制指标，依据标准直接判定为 5 类，不再执行构件、部件、部位及全桥评分计算。", bold: true, font: "Microsoft YaHei", size: 21 })] }));
    return out;
  }
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "4.1 构件与部件评分", font: "Microsoft YaHei" })] }));
  out.push(await formulaImage(`PMCI_l\,(BMCI_l\ \text{或}\ DMCI_l)=100-\sum_{x=1}^{k}U_x`, "PMCI_l（BMCI_l 或 DMCI_l）= 100 - ΣU_x"));
  out.push(await formulaImage(`U_1=DP_{i1}\quad(x=1)`, "x=1 时，U_1 = DP_i1"));
  out.push(await formulaImage(`U_x=\frac{DP_{ij}}{100\sqrt{x}}\left(100-\sum_{y=1}^{x-1}U_y\right),\quad j=x,\ x=2,3,\ldots,k`, "x>=2 时，U_x = DP_ij/(100×sqrt(x))×(100-ΣU_y)"));
  for (const c of (a.componentScores || [])) {
    const memberSymbol = memberScoreSymbol(c.part);
    const componentSymbol = componentScoreSymbol(c.part);
    out.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${c.part} - ${c.name}（${c.is_major ? "主要部件" : "次要部件"}，n=${c.member_count}）`, bold: true, font: "Microsoft YaHei", size: 21 })] }));
    for (let i = 0; i < (c.memberDetails || []).length; i++) {
      const md = c.memberDetails[i];
      if (md.directZero) {
        out.push(formula(`构件 ${i + 1}: DP 含 ${md.invalidDp} >= 100，因此 ${memberSymbol}_${i + 1} = 0`));
      } else if (md.steps && md.steps.length) {
        out.push(await formulaImage(`DP=[${md.steps.map((s) => s.dp).join(",\,")}]`, `构件 ${i + 1}: DP（降序）= [${md.steps.map((s) => s.dp).join(", ")}]`));
        for (const s of md.steps) {
          if (s.i === 1) out.push(await formulaImage(`U_1=DP_{i1}=${s.dp},\quad \sum U=${s.su}`, `U1 = DP_i1 = ${s.dp}，累计 U = ${s.su}`));
          else {
            const previous = round2(s.su - s.u);
            out.push(await formulaImage(`U_${s.i}=\frac{DP_{i${s.i}}}{100\sqrt{${s.i}}}\left(100-\sum_{y=1}^{${s.i - 1}}U_y\right)=\frac{${s.dp}}{100\sqrt{${s.i}}}(100-${previous})=${s.u}`, `U${s.i} = ${s.dp} / (100 x sqrt(${s.i})) x (100 - ${previous}) = ${s.u}`));
          }
        }
        out.push(await formulaImage(`${memberSymbol}_{${i + 1}}=100-\sum_{x=1}^{k}U_x=100-${md.steps[md.steps.length - 1].su}=\mathbf{${md.score}}`, `${memberSymbol}_${i + 1} = 100 - ${md.steps[md.steps.length - 1].su} = ${md.score}`));
      }
    }
    out.push(formula(`${memberSymbol} 平均分 = ${c.avg}；${memberSymbol}_min = ${c.min}；t = ${c.t == null ? "无穷大" : c.t}`));
    out.push(await formulaImage(c.t == null ? `${componentSymbol}_i=\overline{${memberSymbol}}=${c.raw}` : `${componentSymbol}_i=\overline{${memberSymbol}}-\frac{100-${memberSymbol}_{\min}}{t}=${c.avg}-\frac{100-${c.min}}{${c.t}}=${c.raw}`, c.t == null ? `${componentSymbol}_i = ${c.raw}` : `${componentSymbol}_i = ${c.avg} - (100 - ${c.min}) / ${c.t} = ${c.raw}`));
    if (c.controlled) out.push(formula(`主要部件初算 ${componentSymbol}_i = ${c.raw}，位于 [0,40) 区间，执行最差构件控制，${componentSymbol}_i = ${memberSymbol}_min = ${c.score}`, true));
    else out.push(formula(`部件最终评分 ${componentSymbol}_i = ${c.score}`, true));
  }
  const groups = {};
  for (const c of (a.componentScores || [])) (groups[c.part] ||= []).push(c);
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "4.2 部位评分", font: "Microsoft YaHei" })] }));
  const keys = { "上部结构": "SPCI", "下部结构": "SBCI", "桥面系": "BDCI" };
  for (const [name, comps] of Object.entries(groups)) {
    const present = comps.filter((c) => c.member_count > 0 || (c.memberScores || []).some((s) => s < 100));
    if (!present.length) { out.push(formula(`${name}: 无既有部件记录，按完好计 100`)); continue; }
    const sw = present.reduce((n, c) => n + (c.weight || 0), 0);
    const partSymbol = keys[name];
    const componentSymbol = componentScoreSymbol(name);
    const adjusted = present.map((c) => ({ ...c, adjustedWeight: sw ? (c.weight || 0) / sw : 0 }));
    const terms = adjusted.map((c) => `${c.score} x ${round2(c.adjustedWeight)}`).join(" + ");
    out.push(await formulaImage(`${partSymbol}=\sum_{i=1}^{m}${componentSymbol}_i\times W_i=${adjusted.map((c) => `${c.score}\times${round2(c.adjustedWeight)}`).join("+")}=\mathbf{${a.partScores[partSymbol]}}`, `${name}: ${terms} = ${a.partScores[partSymbol]}`));
  }
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "4.3 全桥评分及等级", font: "Microsoft YaHei" })] }));
  out.push(await formulaImage(`Dr=0.20\times${a.partScores.BDCI}+0.40\times${a.partScores.SPCI}+0.40\times${a.partScores.SBCI}=\mathbf{${a.Dr}}`, `Dr = 0.20 x ${a.partScores.BDCI} + 0.40 x ${a.partScores.SPCI} + 0.40 x ${a.partScores.SBCI} = ${a.Dr}`));
  out.push(formula(`依据评分区间，Dr = ${a.Dr}，全桥技术状况评定为 ${a.grade} 类。${a.gradeNote || ""}`, true));
  return out;
}

async function exportDocx(payload, outPath, uploadDir) {
  const b = payload.bridge, a = payload.assessment;
  const calcChildren = await calculationProcess(a);
  const bridgePhotoLabels = { front: "桥梁正面照", side: "桥梁侧面照", location: "桥梁定位照" };
  const bridgePhotoCells = [];
  for (const photo of (b.bridge_photos || [])) {
    const fp = path.join(uploadDir, path.basename(photo.filename || ""));
    if (!photo.type || !bridgePhotoLabels[photo.type] || !fs.existsSync(fp)) continue;
    const ext = path.extname(fp).toLowerCase();
    const imageType = ext === ".jpg" || ext === ".jpeg" ? "jpg" : ext === ".gif" ? "gif" : "png";
    bridgePhotoCells.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: fs.readFileSync(fp), transformation: { width: 250, height: 180 }, type: imageType })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: bridgePhotoLabels[photo.type], font: "Microsoft YaHei", size: 20 })] })
    ] }));
  }
  const bridgePhotoRows = [];
  for (let i = 0; i < bridgePhotoCells.length; i += 2) {
    const cells = [bridgePhotoCells[i]];
    if (bridgePhotoCells[i + 1]) cells.push(bridgePhotoCells[i + 1]);
    else cells.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "" })] })] }));
    bridgePhotoRows.push(new TableRow({ cantSplit: true, children: cells }));
  }
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "公路桥梁技术状况评定报告", bold: true, size: 34, font: "Microsoft YaHei", color: blue })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: "依据 JTG/T H21—2011", size: 22, font: "Microsoft YaHei" })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "一、桥梁概况", font: "Microsoft YaHei" })] }),
    table(["项目", "内容", "项目", "内容"], [
      ["桥梁名称", b.name, "桥梁类型", b.bridge_type], ["结构形式", b.structure_form, "跨径组合", b.span_combination],
      ["桥梁全长(m)", b.total_length, "最大跨径(m)", b.max_span], ["评定日期", b.assess_date, "评定单位", b.org], ["评定负责人", b.owner, "备注", b.remark]
    ]),
    ...(bridgePhotoRows.length ? [
      new Paragraph({ spacing: { before: 180, after: 80 }, children: [new TextRun({ text: "桥梁照片", bold: true, font: "Microsoft YaHei", size: 24, color: blue })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4680, 4680], rows: bridgePhotoRows })
    ] : []),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "二、评定结果", font: "Microsoft YaHei" })] }),
    table(["指标", "结果"], [["技术状况等级", a.grade == null ? "" : `${a.grade} 类`], ["全桥评分 Dr", a.Dr], ["上部结构 SPCI", a.partScores.SPCI], ["下部结构 SBCI", a.partScores.SBCI], ["桥面系 BDCI", a.partScores.BDCI], ["五类控制指标", a.fiveClassHit ? "命中，整桥判定为 5 类" : "未命中"]]),
    new Paragraph({ children: [new TextRun({ text: a.gradeNote || "评定结果按标准公式自动计算。", font: "Microsoft YaHei", size: 21 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "三、部件评分明细", font: "Microsoft YaHei" })] }),
    table(["部位", "部件", "构件数", "部件评分", "等级", "控制"], (a.componentScores || []).map((c) => [c.part, c.name, c.member_count, c.score, `${c.grade} 类`, c.controlled ? "最差构件控制" : ""])),
    ...calcChildren,
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "五、缺陷记录及照片", font: "Microsoft YaHei" })] })
  ];
  let hasPhoto = false;
  let photoNo = 0;
  for (const comp of (b.components || [])) for (const d of (comp.defects || [])) {
    const photos = d.photos || [];
    if (!d.defect_type && !photos.length) continue;
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${comp.part} / ${comp.name} / 构件 ${d.member_label || "未定位"}`, bold: true, font: "Microsoft YaHei", size: 22 })] }));
    const photoIds = photos.length ? photos.map(() => `照片${++photoNo}`) : ["/"];
    children.push(table(["缺陷类型", "标度", "DP", "描述", "照片编号"], [[d.defect_type, d.scale, d.dp, d.description, photoIds.join("、")]], [3000, 900, 700, 3260, 1500]));
    const photoCells = [];
    for (let pi = 0; pi < photos.length; pi++) {
      const p = photos[pi];
      const fp = path.join(uploadDir, p.filename);
      if (!fs.existsSync(fp)) continue;
      hasPhoto = true;
      const ext = path.extname(fp).toLowerCase();
      const imageType = ext === ".jpg" || ext === ".jpeg" ? "jpg" : ext === ".gif" ? "gif" : "png";
      const captionParts = [comp.name];
      if (d.member_label) captionParts.push(`构件 ${d.member_label}`);
      captionParts.push(d.defect_type || "缺陷照片");
      photoCells.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: fs.readFileSync(fp), transformation: { width: 250, height: 180 }, type: imageType })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `图：${captionParts.join(" - ")}`, font: "Microsoft YaHei", size: 16 })] })
      ] }));
    }
    if (photoCells.length) {
      const photoRows = [];
      for (let i = 0; i < photoCells.length; i += 2) {
        const cells = [photoCells[i]];
        if (photoCells[i + 1]) cells.push(photoCells[i + 1]);
        else cells.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "/", font: "Microsoft YaHei", size: 22 })] })] }));
        photoRows.push(new TableRow({ cantSplit: true, children: cells }));
      }
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4680, 4680], rows: photoRows }));
    } else {
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4680, 4680], rows: [new TableRow({ cantSplit: true, children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "/", font: "Microsoft YaHei", size: 22 })] })] }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "/", font: "Microsoft YaHei", size: 22 })] })] })
      ] })] }));
    }
  }
  if (!hasPhoto) children.push(new Paragraph({ children: [new TextRun({ text: "本次评定未附缺陷照片。", font: "Microsoft YaHei", size: 21 })] }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "说明：本报告由系统依据录入数据自动生成，现场检测人员应对原始记录和评定结论进行复核。", font: "Microsoft YaHei", size: 18 })] }));
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children }] });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, await Packer.toBuffer(doc));
  return outPath;
}
module.exports = { exportDocx };
