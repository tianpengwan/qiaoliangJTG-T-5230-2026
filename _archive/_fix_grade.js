const fs = require("fs");
const p = "./public/app.js";
let s = fs.readFileSync(p, "utf8");
// 删除 gradeProc 中 )) 与 ` 之间的多余反引号（即 ))`  +  →  )) + ）
const before = s;
s = s.replace(/nl2br\(renderMathSegments\(`.+?`\)\)` \+ \(a\.gradeNote/,
  (m) => m.replace("))` +", ")) +"));
if (s !== before) { fs.writeFileSync(p, s); console.log("fixed gradeProc"); }
else console.log("no change");