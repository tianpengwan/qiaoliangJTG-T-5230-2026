// =====================================================================
// JTG/T 5230—2026 技术状况评定计算
// 流程（图 3.1.7）：
//   构件缺损状况 EDI → 功能状况 EFI → 影响状况 EAI → 构件技术状况 ECI/ECL
//   → 桥跨技术状况 BSCI → 全桥技术状况 BCI
// 公式：
//   ECI = EDI + EFI + EAI（≥5 取 5）                     式(3.2.5)
//   BSCI(i) = 100 − Σ CI(j)·ω·γ/5                        式(3.3.1)
//   BCI = BSCImin + (BSCIlim − BSCImin)(BSCI均值 − BSCImin)/(BSCImax − BSCImin)  式(3.4.3)
// =====================================================================
const {
  PARTS, GRADE_LIMIT, GRADE_TEXT, eciToGrade, bsciToGrade, table,
} = require("./templates5230");

const CATEGORY = {
  durability: "耐久性缺损",
  structural: "结构性缺损",
  function: "功能状况",
  impact: "影响状况",
};

function round(v, d = 1) {
  if (v == null || isNaN(v)) return v;
  const f = Math.pow(10, d);
  // 规避浮点误差（如 89.95000000001）
  return Math.round((v + Number.EPSILON) * f) / f;
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 单个构件（一片梁/一个墩/一道伸缩缝……）的评定
function assessMember(findings = []) {
  let durability = 0;
  let structural = 0;
  let func = 0;
  let impact = 0;
  let hasImpact = false;
  const used = [];
  for (const f of findings) {
    if (!f || f.scale == null || f.scale === "") continue;
    const scale = Number(f.scale);
    if (isNaN(scale)) continue;
    if (f.category === "durability") {
      durability = Math.max(durability, clamp(scale, 0, 2));
      used.push(f);
    } else if (f.category === "structural") {
      structural = Math.max(structural, clamp(scale, 0, 3));
      used.push(f);
    } else if (f.category === "function") {
      func = Math.max(func, clamp(scale, 0, 2));
      used.push(f);
    } else if (f.category === "impact") {
      impact = hasImpact ? Math.max(impact, clamp(scale, -1, 1)) : clamp(scale, -1, 1);
      hasImpact = true;
      used.push(f);
    }
  }
  const edi = Math.max(durability, structural);
  const raw = edi + func + impact;
  const eci = clamp(raw, 0, 5);
  return {
    edi, eddi: durability, esdi: structural, efi: func, eai: impact,
    eci, ecl: eciToGrade(eci), raw,
    hasData: used.length > 0,
    findings: used,
  };
}

// 汇总一个构件类型（部件）下所有构件：CI(j) = 最差构件技术状况标度
function assessComponent(comp) {
  const findings = comp.findings || [];
  const map = new Map();
  for (const f of findings) {
    if (f.scale == null || f.scale === "" || !f.category) continue;
    const label = (f.member_label && String(f.member_label).trim()) || "未定位";
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(f);
  }
  const members = [];
  for (const [label, list] of map.entries()) {
    members.push(Object.assign({ label }, assessMember(list)));
  }
  const memberCount = Number(comp.member_count || 0);
  const wholeComponent = members.some((m) => m.label === "全构件");
  const evaluated = wholeComponent ? Math.max(memberCount, members.length) : members.length;
  // 未记录缺损的构件视为完好（ECI=0）
  const ci = members.length ? Math.max(...members.map((m) => m.eci)) : 0;
  const worst = members.length ? members.reduce((a, b) => (b.eci > a.eci ? b : a), members[0]) : null;
  return {
    id: comp.id,
    span_id: comp.span_id,
    part: comp.part,
    name: comp.name,
    comp_key: comp.comp_key,
    weight: Number(comp.weight || 0),
    gamma: Number(comp.gamma || 0),
    is_major: !!comp.is_major,
    absent: !!comp.absent,
    member_count: memberCount,
    evaluated_members: evaluated,
    finding_count: findings.length,
    members: members.sort((a, b) => b.eci - a.eci),
    worst,
    CI: ci,
    ECL: eciToGrade(ci),
    ECL_text: GRADE_TEXT[eciToGrade(ci)],
    structural_table: comp.structural_table,
    material: comp.material,
    efi_table: comp.efi_table,
  };
}

function assessSpan(span, components, options = {}) {
  const assessed = components.map(assessComponent);
  const hasData = assessed.some((c) => c.finding_count > 0);
  // 部件权重按“全桥设置最完整”原则：未设置的部件不参与，权重在部位内按比例重分配
  const partSummaries = {};
  let sum = 0;
  let weightedSum = 0;
  for (const part of PARTS) {
    const list = assessed.filter((c) => c.part === part);
    const active = list.filter((c) => !c.absent);
    const totalWeight = active.reduce((a, c) => a + c.weight, 0);
    let partContribution = 0;
    if (active.length && totalWeight > 0) {
      for (const c of active) {
        // ω 为百分制权重（附录 B 中 40 表示 40%），归一到 100
        const omega = (c.weight / totalWeight) * 100;
        const gamma = c.gamma || (options.gamma && options.gamma[part]) || 0;
        const contribution = (c.CI * omega * gamma) / 5;
        c.omega = round(omega, 2);
        c.contribution = round(contribution, 2);
        partContribution += contribution;
      }
    }
    sum += partContribution;
    weightedSum += partContribution;
    partSummaries[part] = {
      components: list,
      present: active.length,
      contribution: round(partContribution, 2),
    };
  }
  let bsci = round(100 - weightedSum, 1);
  bsci = clamp(bsci, 0, 100);
  let grade = bsciToGrade(bsci);
  let gradeNote = "";

  // 第 3.3.3 条：主要构件 4/5 类且影响桥梁安全时，按最差构件等级评定
  const majorBad = assessed.filter((c) => c.is_major && !c.absent && c.ECL >= 4)
    .sort((a, b) => b.ECL - a.ECL);
  const override = span.major_override || options.major_override;
  if (override && override.hit && majorBad.length) {
    const worst = majorBad[0];
    grade = worst.ECL;
    bsci = GRADE_LIMIT[grade];
    gradeNote = `适用第 3.3.3 条：主要构件“${worst.name}”技术状况为 ${worst.ECL} 类并影响桥梁安全，桥跨按该构件等级评定，BSCI 取 ${bsci}。`;
    if (override.note) gradeNote += ` 复核说明：${override.note}`;
  }
  if (!hasData) {
    bsci = null;
    grade = null;
    gradeNote = "尚未录入任何评定记录，该桥跨暂不评定。";
  }

  const triggers = [];
  for (const c of assessed) {
    if (c.absent) continue;
    if (c.CI === 0 && c.member_count === 0) triggers.push(`${c.name}：尚未录入构件数量`);
    if (c.CI >= 3 && c.is_major && c.worst && c.worst.efi === 0 && c.worst.edi === 3) {
      triggers.push(`${c.name}：缺损状况标度为 3，宜开展影响状况评定`);
    }
    if (c.is_major && c.worst && c.worst.efi === 2 && c.worst.eai === 0 && !c.worst.hasImpact) {
      triggers.push(`${c.name}：功能状况标度为 2，宜开展影响状况评定`);
    }
  }

  return {
    id: span.id,
    span_no: span.span_no,
    name: span.name || `第${span.span_no}跨`,
    BSCI: bsci,
    grade,
    grade_text: grade == null ? null : GRADE_TEXT[grade],
    grade_note: gradeNote,
    parts: partSummaries,
    components: assessed,
    major_bad: majorBad,
    major_override: override || null,
    warnings: [...new Set(triggers)],
  };
}

function assess(bridge) {
  const validation = validateAssessmentInput(bridge);
  const spans = (bridge.spans || []).slice().sort((a, b) => (a.span_no || 0) - (b.span_no || 0));
  const components = bridge.components || [];
  const spanResults = spans.map((span) => {
    const list = components.filter((c) => c.span_id === span.id);
    return assessSpan(span, list.length ? list : components.filter((c) => !c.span_id), bridge);
  });

  // 第 3.4 节 全桥评定
  let BCI = null;
  let grade = null;
  let gradeNote = "";
  const completed = spanResults.filter((s) => s.grade != null && s.BSCI != null);
  if (!spanResults.length) {
    gradeNote = "尚未设置桥跨。";
  } else if (completed.length < spanResults.length) {
    gradeNote = "存在尚未录入评定记录的桥跨，全桥暂不评定。";
  } else if (spanResults.length === 1) {
    BCI = spanResults[0].BSCI;
    grade = spanResults[0].grade;
    gradeNote = "单跨桥梁：以桥跨技术状况等级和指数作为全桥结果。";
  } else if (spanResults.length > 1) {
    const grades = spanResults.map((s) => s.grade);
    const allSame = grades.every((g) => g === grades[0]);
    const maxB = Math.max(...spanResults.map((s) => s.BSCI));
    const minB = Math.min(...spanResults.map((s) => s.BSCI));
    const avgB = spanResults.reduce((a, s) => a + s.BSCI, 0) / spanResults.length;
    if (allSame) {
      grade = grades[0];
      BCI = round(avgB, 1);
      gradeNote = "各桥跨技术状况等级一致：以该等级作为全桥等级，以各桥跨指数算术平均值作为全桥指数。";
    } else {
      const worstGrade = Math.max(...grades);
      const worstSpans = spanResults.filter((s) => s.grade === worstGrade).map((s) => s.name);
      const lim = GRADE_LIMIT[worstGrade];
      if (maxB === minB) {
        BCI = round(minB, 1);
      } else {
        BCI = round(minB + ((lim - minB) * (avgB - minB)) / (maxB - minB), 1);
      }
      BCI = clamp(BCI, 0, 100);
      grade = worstGrade;
      gradeNote = `各桥跨等级不一致：以最差桥跨（${worstSpans.join("、")}，${worstGrade} 类）作为全桥等级，全桥指数按式(3.4.3)计算。`;
    }
  }

  // 第 3.4.5 条 5 类单项控制指标
  const fiveHits = (bridge.five_class || []).filter((x) => x && x.hit);
  const fiveClassHit = fiveHits.length > 0;
  if (fiveClassHit) {
    grade = 5;
    gradeNote = "命中全桥 5 类桥梁单项控制指标，全桥技术状况等级直接评定为 5 类（单项控制指标法）。";
  }

  return {
    standard: "JTG/T 5230—2026",
    spans: spanResults,
    BCI,
    grade,
    grade_text: grade == null ? null : GRADE_TEXT[grade],
    grade_note: gradeNote,
    fiveClassHit,
    fiveClass: fiveHits,
    validation,
  };
}

function validateAssessmentInput(bridge) {
  const errors = [];
  const warnings = [];
  const spans = bridge.spans || [];
  if (!spans.length) errors.push("尚未设置桥跨（评定单元）");
  const components = bridge.components || [];
  if (!components.length) errors.push("尚未生成评定构件");
  const spanIds = new Set(spans.map((s) => s.id));
  for (const c of components) {
    if (c.span_id && !spanIds.has(c.span_id)) errors.push(`构件“${c.name}”所属桥跨不存在`);
    if (!PARTS.includes(c.part)) errors.push(`构件“${c.name}”的部位不合法`);
    if (!(Number(c.weight) > 0)) warnings.push(`构件“${c.name}”权重未设置`);
    if (!c.absent && !(Number(c.member_count) > 0)) warnings.push(`${c.name}：尚未填写构件数量`);
    const labels = new Set();
    for (const f of c.findings || []) {
      if (f.category && !CATEGORY[f.category]) errors.push(`${c.name}：未知评定类别 ${f.category}`);
      if (!f.indicator) errors.push(`${c.name}：存在未选择评定指标的记录`);
      if (f.scale == null || f.scale === "") {
        warnings.push(`${c.name}：指标“${f.indicator || ""}”未选择评定标度`);
        continue;
      }
      const sc = Number(f.scale);
      const t = f.table_id ? table(f.table_id) : null;
      const allowed = t ? t.scales : f.category === "function" ? [0, 1, 2] : f.category === "impact" ? [-1, 0, 1] : [0, 1, 2, 3];
      if (!allowed.includes(sc)) errors.push(`${c.name}：指标“${f.indicator}”标度 ${f.scale} 超出范围`);
      if (!String(f.member_label || "").trim()) warnings.push(`${c.name}：存在未填写构件编号/位置的记录`);
      else labels.add(String(f.member_label).trim());
    }
    const n = Number(c.member_count || 0);
    if (n > 0 && labels.size > n) errors.push(`${c.name}：已评定构件数 ${labels.size} 大于构件总数 ${n}`);
  }
  // 每个部位至少应有一个启用部件
  for (const part of PARTS) {
    const list = components.filter((c) => c.part === part && !c.absent);
    if (!list.length) warnings.push(`${part}：无启用部件，该部位不参与计算`);
  }
  const totalFindings = components.reduce((a, c) => a + ((c.findings || []).length), 0);
  if (!totalFindings) errors.push("尚未录入任何评定记录");
  for (const span of spans) {
    const list = components.filter((c) => c.span_id === span.id);
    if (list.length && !list.some((c) => (c.findings || []).length)) {
      errors.push(`${span.name || "第" + span.span_no + "跨"}尚未录入任何评定记录`);
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

module.exports = {
  assess,
  assessSpan,
  assessComponent,
  assessMember,
  validateAssessmentInput,
  CATEGORY,
};
