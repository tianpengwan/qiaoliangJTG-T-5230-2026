// 将 public 前端资源同步到 Capacitor 的 www 目录
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "public");
const dst = path.join(__dirname, "..", "www");

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });

function copy(dir) {
  for (const entry of fs.readdirSync(path.join(src, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(path.join(dst, rel), { recursive: true });
      copy(rel);
    } else if (entry.isFile() && entry.name !== "sw.js") {
      fs.copyFileSync(path.join(src, rel), path.join(dst, rel));
    }
  }
}
copy("");
console.log("前端资源已同步到 www/");
