// 隔离测试 gradeProc 模板字符串
const a = { Dr: 80, grade: 2 };
function gradeBand(dr) { return "80 \\le Dr < 95"; }
const gradeProc = nl2br(renderMathSegments(`$Dr=${a.Dr}\\to ${gradeBand(a.Dr)}\\to$ 评定为 $\\mathbf{${a.grade}\\text{类}}$`)) + (a.gradeNote ? `<br><span>规则</span>` : '');
console.log(gradeProc);
function renderMathSegments(t){ return t; }
function nl2br(s){ return s; }