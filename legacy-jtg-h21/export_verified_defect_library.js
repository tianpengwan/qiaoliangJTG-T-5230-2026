// 从 SQLite 导出仅含“原图逐表核验”记录的新缺陷库 JSON。
const fs = require("fs");
const path = require("path");
const { db } = require("./db");

const rows = db.prepare(`SELECT bt.name bridge_type,sf.name structure_form,p.name part,c.name component,
  d.id,d.name,d.max_class,d.standard_ref,d.applicable_to
  FROM bt_defect_type d JOIN bt_component c ON c.id=d.component_id
  JOIN bt_part p ON p.id=c.part_id JOIN bt_struct_form sf ON sf.id=p.struct_form_id
  JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id
  WHERE d.verified=1 AND d.standard_ref IS NOT NULL
  ORDER BY bt.sort_order,sf.sort_order,p.sort_order,c.sort_order,d.standard_ref,d.id`).all();
const getScales = db.prepare("SELECT scale,qual,quan FROM bt_defect_scale WHERE defect_type_id=? ORDER BY scale");
const legacyAliases = new Set(["渗漏","钢构件锈蚀","堵塞","伸缩失效","锚固区开裂","缺损","松动","锈蚀"]);
const output = { schema_version: 2, standard: "JTG/T H21-2011", source: "pages 原图逐表人工核验", generated_at: new Date().toISOString(), bridge_types: {} };
let accepted=0, rejected=[];
for (const r of rows) {
  if (legacyAliases.has(r.name)) continue;
  const scales=getScales.all(r.id);
  const sequence=scales.map((s)=>s.scale);
  const complete=sequence.length===r.max_class && sequence.every((x,i)=>x===i+1) && scales.every((s)=>String(s.qual||"").trim());
  if (!complete) { rejected.push({ id:r.id, table_ref:r.standard_ref, name:r.name, reason:"标度不连续或定性描述为空" }); continue; }
  const bt=output.bridge_types[r.bridge_type] ||= { structure_forms:{} };
  const sf=bt.structure_forms[r.structure_form] ||= { parts:{} };
  const part=sf.parts[r.part] ||= { components:{} };
  const comp=part.components[r.component] ||= { defects:[] };
  comp.defects.push({ name:r.name, table_ref:r.standard_ref, applicable_to:r.applicable_to||null, max_class:r.max_class,
    scales:scales.map((s)=>({ scale:s.scale, qualitative:s.qual||"", quantitative:s.quan||"" })) });
  accepted++;
}
output.audit={ accepted, rejected };
const out=path.join(__dirname,"data","defect_library.json");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(output,null,2),"utf8");
console.log({out,accepted,rejected:rejected.length});
