// 桥梁缺损图像 AI 甄别（OpenAI 兼容多模态接口）
// 依据 JTG/T 5230—2026 第 4~15 章：在指定评定类别下，从候选指标中识别
// 指标名称、评定标度（0~2 / 0~3 / -1~1）并给出定量中文描述。
//
// 环境变量：
//   VISION_PROVIDER=openai
//   VISION_API_KEY=sk-xxx
//   VISION_BASE_URL=https://api.openai.com/v1
//   VISION_MODEL=gpt-4o-mini
//   VISION_TIMEOUT_MS=60000

const fs = require("fs");

const SYSTEM_PROMPT = `你是一名资深的公路桥梁外观检查专家，严格依据《公路桥梁技术状况评定标准》（JTG/T 5230—2026）进行缺损识别。

任务：分析用户提供的桥梁构件照片，在给定的“评定类别”和“候选评定指标”中，选出照片中表现最明显、最严重的一项指标，并按该指标的标度描述判定评定标度，给出简洁、定量的中文描述。

判定原则：
- 只能从候选指标中选择一项，指标名称必须与候选列表完全一致；
- 评定标度必须落在该指标给出的标度范围内；
- 标度 0 表示完好或该指标未出现；标度越大越严重；
- 影响状况类别的标度为 -1（趋向稳定）、0（缓慢发展）、1（加速发展/可能导致垮塌/灾害影响）；
- 一张照片包含多项缺损时，选择对标度贡献最大的一项；
- 若照片中未见候选指标所述缺损，指标填“无明显缺损”，标度填 0。

描述要求：中文、简洁，尽量给出可测量量（裂缝宽度 mm、长度 m、面积或范围占比、变形量、缺失数量等）。

输出：只输出一个 JSON 对象，不要任何额外文字。
JSON 字段：
- indicator: 字符串，必须来自候选指标列表或“无明显缺损”；
- scale: 整数；
- description: 字符串；
- confidence: 0~1 浮点数。`;

function buildUserPrompt({ partName, componentName, category, indicators }) {
  const list = (indicators || []).map((it) => {
    const scales = (it.scales || []).map((text, i) => `    ${i}: ${text}`).join("\n");
    return `- ${it.name}\n${scales}`;
  }).join("\n");
  return `桥梁部位：${partName || "未知"}；构件：${componentName || "未知"}。
本次评定类别：${category || "结构性缺损"}。
候选评定指标及标度描述：
${list || "（未提供候选指标）"}

请依据照片选择最严重的一项指标并判定标度，只输出 JSON。`;
}

function mimeOf(p) {
  const e = (p.split(".").pop() || "jpg").toLowerCase();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[e] || "image/jpeg";
}
function parseJSON(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}
function scaleRange(indicators, indicatorName) {
  const it = (indicators || []).find((x) => x.name === indicatorName);
  if (!it || !it.scales || !it.scales.length) return { min: 0, max: 3 };
  return { min: Number(it.scales[0]) || 0, max: Number(it.scales[it.scales.length - 1]) || 3 };
}

async function openaiAssess({ imagePath, partName, componentName, category, indicators }) {
  const apiKey = process.env.VISION_API_KEY;
  const baseUrl = (process.env.VISION_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.VISION_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("未配置 VISION_API_KEY，无法调用视觉模型。");
  const mime = mimeOf(imagePath);
  const b64 = fs.readFileSync(imagePath).toString("base64");
  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt({ partName, componentName, category, indicators }) },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 800,
  };
  const timeout = Number(process.env.VISION_TIMEOUT_MS || 60000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let resp;
  try {
    resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`视觉模型接口错误 ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  const parsed = parseJSON(content);
  if (!parsed || !parsed.indicator) throw new Error("视觉模型未返回有效 JSON：" + content.slice(0, 200));
  const names = (indicators || []).map((x) => x.name);
  let indicator = parsed.indicator;
  if (indicator !== "无明显缺损" && !names.includes(indicator)) {
    const hit = names.find((n) => n.includes(indicator) || indicator.includes(n));
    indicator = hit || "无明显缺损";
  }
  const r = scaleRange(indicators, indicator);
  let scale = Math.round(Number(parsed.scale));
  if (!Number.isFinite(scale)) scale = r.min;
  scale = Math.min(r.max, Math.max(r.min, scale));
  return {
    category,
    indicator,
    scale,
    description: parsed.description || "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    raw: content,
  };
}

async function assessPhoto(opts) {
  const info = providerInfo();
  if (!info.enabled) throw new Error("AI 图片识别未配置");
  if (info.provider === "openai") return await openaiAssess(opts);
  throw new Error("未知 VISION_PROVIDER: " + info.provider + "（仅支持 openai）");
}

function providerInfo() {
  const provider = (process.env.VISION_PROVIDER || "disabled").trim().toLowerCase();
  const configured = provider === "openai" && !!process.env.VISION_API_KEY?.trim();
  return {
    enabled: configured,
    configured,
    provider,
    model: provider === "openai" ? (process.env.VISION_MODEL || "gpt-4o-mini") : null,
    baseUrl: provider === "openai" ? (process.env.VISION_BASE_URL || "https://api.openai.com/v1") : null,
  };
}

module.exports = { assessPhoto, providerInfo, SYSTEM_PROMPT, buildUserPrompt };
