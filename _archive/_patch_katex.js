// v3: 用正则捕获行内内容并拼接新模板，彻底避免反斜杠转义问题
const fs = require("fs");
const path = "./public/app.js";
let s = fs.readFileSync(path, "utf8");

// ① 规则 4.1.7 混排公式行：捕获中间内容，拼入新模板
const r1 = /<div class='formula' style='font-size:13px;color:#555'>规则 4\.1\.7：(.+?)<\/div>/;
if (r1.test(s)) {
  s = s.replace(r1, (m, inner) =>
    "<div class='formula' style='font-size:13px;color:#555'>${renderMathSegments('规则 4.1.7：" + inner + "')}</div>"
  );
  console.log("OK 规则4.1.7");
} else console.log("!! 规则4.1.7 not found");

// ② memberProc directZero：把 calc-step 的整段内容包进 renderMathSegments(`...`)
//    原行：memberProc += `<div class='calc-step'>...CONTENT...</div>`;
//    新行：memberProc += `<div class='calc-step'>${renderMathSegments(`CONTENT`)}</div>`;
const r2 = /(memberProc \+= `<div class='calc-step'>)([^`]+?)(<\/div>`;)/;
if (r2.test(s)) {
  s = s.replace(r2, (m, head, content, tail) =>
    head + "${renderMathSegments(`" + content + "`)}" + tail
  );
  console.log("OK directZero");
} else console.log("!! directZero not found");

// ③ memberProc 无缺陷：同样包裹
//    原行：memberProc += `<div class='calc-step'>构件 #${mi + 1}：无缺陷，记 $\\mathbf{100}$ 分</div>`;
const r3 = /memberProc \+= `<div class='calc-step'>(构件 #\$\{mi \+ 1\}：无缺陷，记 [^<]+)<\/div>`;/;
if (r3.test(s)) {
  s = s.replace(r3, (m, content) =>
    "memberProc += `<div class='calc-step'>${renderMathSegments(`" + content + "`)}</div>`;"
  );
  console.log("OK 无缺陷");
} else console.log("!! 无缺陷 not found");

// ④ drProc：整行替换。匹配整个 const drProc = `...`;  （注意可能含换行/特殊字符，用 [\s\S]*?）
const r4 = /(const drProc = `)([\s\S]*?)(`;)/;
if (r4.test(s)) {
  s = s.replace(r4, (m, head, body, tail) =>
    "const drProc = nl2br(renderMathSegments(`" + body.replace(/<br>/g, "\\n") + "`))" + tail
  );
  console.log("OK drProc");
} else console.log("!! drProc not found");

// ⑤ gradeProc
const r5 = /(const gradeProc = `)([\s\S]*?)(` \+ \(a\.gradeNote)/;
if (r5.test(s)) {
  s = s.replace(r5, (m, head, body, tail) =>
    "const gradeProc = nl2br(renderMathSegments(`" + body + "`))" + tail
  );
  console.log("OK gradeProc");
} else console.log("!! gradeProc not found");

fs.writeFileSync(path, s);
console.log("done. length:", s.length);