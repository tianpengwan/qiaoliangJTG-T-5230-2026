// JTG/T H21—2011 评分计算（构件→部件→部位→全桥）
// 输入：bridge 对象 { components:[{id,part,name,weight,is_major,member_count, defects:[{dp,scale,...}]}] }
// 输出：各部件评分、部位评分、全桥评分、等级、五类控制结论。
//
// 流程约定（JTG/T H21—2011 图 3.3.1）：
// 1. 先判定 5 类桥梁单项控制指标；任一命中 → 总体直接判 5 类，不进入后续评分。
// 2. 未命中时，才执行 构件→部件→部位→全桥 的评分流程。

// t 值表（表 4.1.2）
const T_TABLE = [
  [1, Infinity], [2, 10.0], [3, 9.7], [4, 9.5], [5, 9.2], [6, 8.9], [7, 8.7],
  [8, 8.5], [9, 8.3], [10, 8.1], [11, 7.9], [12, 7.7], [13, 7.5], [14, 7.3],
  [15, 7.2], [16, 7.08], [17, 6.96], [18, 6.84], [19, 6.72], [20, 6.60],
  [21, 6.48], [22, 6.36], [23, 6.24], [24, 6.12], [25, 6.00], [26, 5.88],
  [27, 5.76], [28, 5.64], [29, 5.52], [30, 5.40], [40, 4.90], [50, 4.40],
  [60, 4.00], [70, 3.60], [80, 3.20], [90, 2.80], [100, 2.50], [200, 2.30],
];

function tValue(n) {
  if (n <= 1) return Infinity;
  if (n >= 200) return 2.30;
  for (let i = 0; i < T_TABLE.length - 1; i++) {
    const [n1, t1] = T_TABLE[i];
    const [n2, t2] = T_TABLE[i + 1];
    if (n >= n1 && n <= n2) {
      if (n1 === n2) return t1;
      if (t1 === Infinity) return t2; // n 落在 [1,2] 起点，直接取精确端，避免 ∞ 参与插值
      return t1 + (t2 - t1) * (n - n1) / (n2 - n1);
    }
  }
  return 2.30;
}

function gradeOf(score) {
  if (score >= 95) return 1;
  if (score >= 80) return 2;
  if (score >= 60) return 3;
  if (score >= 40) return 4;
  return 5;
}

// 单个构件评分：输入该构件各缺陷扣分值 dp 列表
function memberScore(dps) {
  if (dps.length === 0) return 100;
  if (dps.some((d) => d >= 100)) return 0;
  const sorted = [...dps].sort((a, b) => b - a); // 从大到小
  let sumU = 0;
  for (let x = 0; x < sorted.length; x++) {
    const dp = sorted[x];
    let u;
    if (x === 0) {
      u = dp;
    } else {
      u = (dp / (100 * Math.sqrt(x + 1))) * (100 - sumU);
    }
    sumU += u;
  }
  return Math.max(0, 100 - sumU);
}

// 构件评分的逐步分解（供前端展示计算过程）：DP 按从大到小排序，
// U_1 = DP_1；U_i = DP_i / (100·√i) · (100 - ΣU_前)，最终 P_mci = 100 - ΣU。
function memberScoreDetail(dps) {
  if (dps.length === 0) return { score: 100, directZero: false, steps: [] };
  if (dps.some((d) => d >= 100)) {
    const invalid = dps.filter((d) => d >= 100).sort((a, b) => b - a);
    return { score: 0, directZero: true, steps: [], invalidDp: invalid[0] };
  }
  const sorted = [...dps].sort((a, b) => b - a);
  let sumU = 0;
  const steps = [];
  for (let x = 0; x < sorted.length; x++) {
    const dp = sorted[x];
    let u;
    if (x === 0) u = dp;
    else u = (dp / (100 * Math.sqrt(x + 1))) * (100 - sumU);
    sumU += u;
    steps.push({ i: x + 1, dp: round(dp), u: round(u), su: round(sumU) });
  }
  return { score: round(Math.max(0, 100 - sumU)), directZero: false, steps };
}

function assess(bridge) {
  const validation = validateAssessmentInput(bridge);
  // 第一步：5 类单项控制指标（前置判定）
  const fiveClass = (bridge.five_class || []).filter((x) => x && x.hit);
  const fiveClassHit = fiveClass.length > 0;
  if (fiveClassHit) {
    return {
      componentScores: [],
      partScores: { SPCI: null, SBCI: null, BDCI: null },
      Dr: null,
      grade: 5,
      gradeNote: "命中 5 类桥梁单项控制指标，桥梁总体技术状况直接判定为 5 类。",
      fiveClassHit: true,
      fiveClass,
      validation,
    };
  }

  const parts = { "上部结构": { weight: 0.40, comps: [] }, "下部结构": { weight: 0.40, comps: [] }, "桥面系": { weight: 0.20, comps: [] } };

  for (const comp of bridge.components || []) {
    const part = parts[comp.part];
    if (!part) continue;

    // 按构件位置聚合缺陷
    const memberMap = new Map();
    for (const d of comp.defects || []) {
      // 空白占位行和未完成的缺陷不进入扣分计算。
      if (!d.defect_type || d.scale == null || d.dp == null) continue;
      // 未填写构件编号时，病害仍属于同一“未定位构件”。按构件合并
      // 才能正确执行公式 4.1.1 的多项缺损叠加；不能按病害行拆成多个构件。
      const key = (d.member_label && String(d.member_label).trim()) ? String(d.member_label).trim() : "__unlocated";
      if (!memberMap.has(key)) memberMap.set(key, new Map());
      // 公式 4.1.1 中 k 为发生扣分的“检测指标种类数”。同一构件同一
      // 指标多处病害按最不利标度取 DP，不能重复作为多个指标叠加。
      const indicators = memberMap.get(key);
      indicators.set(d.defect_type, Math.max(indicators.get(d.defect_type) || 0, d.dp));
    }
    const defectMemberCount = memberMap.size;
    const n = Math.max(comp.member_count || 0, defectMemberCount);

    const scores = [];
    const memberDetails = [];
    for (const indicators of memberMap.values()) {
      const dps = [...indicators.values()];
      scores.push(memberScore(dps));
      memberDetails.push(memberScoreDetail(dps));
    }
    for (let i = scores.length; i < n; i++) {
      scores.push(100); // 无缺陷构件计 100
      memberDetails.push({ score: 100, directZero: false, steps: [] });
    }

    const avg = n > 0 ? scores.reduce((a, b) => a + b, 0) / n : 100;
    const min = n > 0 ? Math.min(...scores) : 100;
    const t = tValue(n);

    // 部件评分（公式 4.1.2）
    let raw = t === Infinity ? avg : avg - (100 - min) / t;
    raw = Math.max(0, raw);

    // 主要部件的部件初算评分 P_ci 位于 [0,40) 时，取最差构件评分。
    // 判定对象是 P_ci（raw），不是最差构件评分 P_mci,min。
    let finalScore = raw;
    let controlled = false;
    if (comp.is_major && raw < 40) {
      finalScore = min;
      controlled = true;
    }

    part.comps.push({
      id: comp.id, name: comp.name, part: comp.part, weight: comp.weight, is_major: comp.is_major,
      member_count: n, avg: round(avg), min: round(min), t: t === Infinity ? null : round(t, 2),
      raw: round(raw), score: round(finalScore), grade: gradeOf(finalScore), controlled,
      memberScores: scores.map((s) => round(s)),
      memberDetails,
    });
  }

  // 部位评分（公式 4.1.3）：部件权重在“既有部件”内按比例分配
  const partScores = {};
  for (const [partName, part] of Object.entries(parts)) {
    // “既有部件” = 已填构件数 或 实际存在缺损的部件；其余视为完好（满分）
    const present = part.comps.filter(
      (c) => (c.member_count || 0) > 0 || (c.memberScores && c.memberScores.some((s) => s < 100))
    );
    if (present.length === 0) { partScores[partName] = 100; continue; }
    const totalW = present.reduce((a, c) => a + (c.weight || 0), 0);
    let score = 0;
    for (const c of present) {
      const effW = totalW > 0 ? (c.weight || 0) / totalW : 0; // 未设置部件权重按比例分配
      score += c.score * effW;
    }
    partScores[partName] = round(score);
  }

  const SPCI = partScores["上部结构"];
  const SBCI = partScores["下部结构"];
  const BDCI = partScores["桥面系"];
  const Dr = round(BDCI * 0.20 + SPCI * 0.40 + SBCI * 0.40);

  let finalGrade = gradeOf(Dr);
  let gradeNote = "";
  if (SPCI >= 60 && SPCI < 80 && SBCI >= 60 && SBCI < 80 && BDCI >= 40 && BDCI < 60 && Dr >= 40 && Dr < 60) {
    // 规则 4.1.7：上、下部为 3 类，桥面系 4 类，且 40≤Dr<60 → 总体可评 3 类
    finalGrade = 3;
    gradeNote = "适用规则 4.1.7：上、下部结构 3 类、桥面系 4 类且 40≤Dr<60，总体评定为 3 类。";
  }
  const safetyCandidates = Object.values(parts).flatMap((p) => p.comps)
    .filter((c) => c.is_major && c.grade >= 4)
    .map((c) => ({ id: c.id, name: c.name, part: c.part, score: c.score, grade: c.grade }));
  const override = bridge.safety_override;
  if (override && override.hit && safetyCandidates.length) {
    const worstGrade = Math.max(...safetyCandidates.map((c) => c.grade));
    if (worstGrade > finalGrade) finalGrade = worstGrade;
    gradeNote = `适用规则 4.1.8：主要部件达到${worstGrade}类且经人工复核确认影响桥梁安全，按最差主要部件评定。${override.note ? " 复核说明：" + override.note : ""}`;
  }

  return {
    componentScores: Object.values(parts).flatMap((p) => p.comps),
    partScores: { SPCI, SBCI, BDCI },
    Dr,
    grade: finalGrade,
    gradeNote,
    fiveClassHit: false,
    fiveClass: [],
    validation,
    safetyCandidates,
    safetyOverride: override || null,
  };
}

function validateAssessmentInput(bridge) {
  const errors = [], warnings = [];
  const partCounts = { "上部结构": 0, "下部结构": 0, "桥面系": 0 };
  for (const comp of bridge.components || []) {
    const n = Number(comp.member_count || 0);
    if (n > 0 && Object.prototype.hasOwnProperty.call(partCounts, comp.part)) partCounts[comp.part]++;
    const completedLabels = new Set();
    for (const d of comp.defects || []) {
      const hasAny = !!(d.defect_type || d.description || d.scale != null || (d.photos || []).length);
      if (!hasAny) continue;
      if (!d.defect_type) errors.push(`${comp.name}：存在未选择缺陷类型的记录`);
      if (d.defect_type && d.scale == null) errors.push(`${comp.name}：缺陷“${d.defect_type}”未选择标度`);
      if (d.defect_type && !String(d.member_label || "").trim()) warnings.push(`${comp.name}：缺陷“${d.defect_type}”未填写构件位置/编号`);
      if (d.defect_type && d.scale != null) completedLabels.add(String(d.member_label || "").trim() || "未定位");
    }
    if (completedLabels.size > n) errors.push(`${comp.name}：已记录缺陷的构件数 ${completedLabels.size} 大于构件总数 ${n}`);
  }
  for (const [part, count] of Object.entries(partCounts)) {
    if (count === 0) errors.push(`${part}：尚未确认任何既有部件的构件数量`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function round(v, d = 2) {
  if (v == null || isNaN(v)) return v;
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

module.exports = { assess, tValue, gradeOf, memberScore, memberScoreDetail, validateAssessmentInput, dpValue: undefined };
