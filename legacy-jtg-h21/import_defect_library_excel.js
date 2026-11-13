const ExcelJS = require("exceljs");
const { db } = require("./db");
const file = process.argv[2];
if (!file) throw new Error("用法：node import_defect_library_excel.js <xlsx文件>");
(async()=>{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  const ws=wb.getWorksheet("缺陷库") || wb.worksheets[0];
  const header=ws.getRow(1).values.map(v=>String(v||"")); const ix=n=>header.indexOf(n)+1;
  const findComp=db.prepare(`SELECT c.id FROM bt_component c JOIN bt_part p ON p.id=c.part_id JOIN bt_struct_form sf ON sf.id=p.struct_form_id JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id WHERE bt.name=? AND sf.name=? AND p.name=? AND c.name=?`);
  const del=db.prepare("DELETE FROM bt_defect_scale WHERE defect_type_id=?");
  const upd=db.prepare("UPDATE bt_defect_type SET name=?,max_class=?,standard_ref=?,applicable_to=?,verified=1 WHERE id=?");
  const getDef=db.prepare("SELECT id FROM bt_defect_type WHERE component_id=? AND name=?");
  const insDef=db.prepare("INSERT INTO bt_defect_type(component_id,name,max_class,standard_ref,applicable_to,verified,sort_order,note) VALUES(?,?,?,?,?,1,?,?)");
  const insScale=db.prepare("INSERT INTO bt_defect_scale(defect_type_id,scale,qual,quan) VALUES(?,?,?,?)");
  let count=0; db.exec("BEGIN");
  try { for(let r=2;r<=ws.rowCount;r++) { const row=ws.getRow(r); const v=n=>row.getCell(ix(n)).value; const comp=findComp.get(v("桥型"),v("结构形式"),v("部位"),v("构件")); if(!comp) continue; const name=String(v("缺陷名称")||"").trim(); if(!name) continue; const max=Number(v("最高标度")); if(!max||max<1||max>5) throw new Error(`第${r}行最高标度无效`); let d=getDef.get(comp.id,name); const id=d?d.id:insDef.run(comp.id,name,max,v("标准表号")||null,v("适用构件")||null,r,"Excel导入").lastInsertRowid; if(d) upd.run(name,max,v("标准表号")||null,v("适用构件")||null,id); del.run(id); for(let s=1;s<=max;s++){ const qual=String(v(`标度${s}定性`)||"").trim(); if(!qual) throw new Error(`第${r}行标度${s}定性为空`); insScale.run(id,s,qual,String(v(`标度${s}定量`)||"—").trim()||"—"); } count++; } db.exec("COMMIT"); console.log({imported:count}); } catch(e){db.exec("ROLLBACK"); throw e;} })();
