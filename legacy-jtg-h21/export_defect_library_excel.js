const ExcelJS = require("exceljs");
const path = require("path");
const { db } = require("./db");

const out = process.argv[2] || path.join(__dirname, "exports", "缺陷库编辑模板.xlsx");
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("缺陷库");
const headers = ["桥型","结构形式","部位","构件","缺陷名称","标准表号","最高标度","适用构件","标度1定性","标度1定量","标度2定性","标度2定量","标度3定性","标度3定量","标度4定性","标度4定量","标度5定性","标度5定量"];
ws.addRow(headers);
const rows = db.prepare(`SELECT bt.name bridge_type,sf.name structure_form,p.name part,c.name component,
 d.id,d.name defect_name,d.max_class,d.standard_ref,d.applicable_to
 FROM bt_defect_type d JOIN bt_component c ON c.id=d.component_id JOIN bt_part p ON p.id=c.part_id
 JOIN bt_struct_form sf ON sf.id=p.struct_form_id JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id
 ORDER BY bt.sort_order,sf.sort_order,p.sort_order,c.sort_order,d.sort_order,d.id`).all();
const scales = db.prepare("SELECT scale,qual,quan FROM bt_defect_scale WHERE defect_type_id=? ORDER BY scale");
for (const r of rows) {
  const vals = [r.bridge_type,r.structure_form,r.part,r.component,r.defect_name,r.standard_ref,r.max_class,r.applicable_to || ""];
  const ss = scales.all(r.id);
  for (let i=1;i<=5;i++) { const s=ss.find(x=>x.scale===i); vals.push(s?.qual || "", s?.quan || ""); }
  ws.addRow(vals);
}
ws.views = [{state:"frozen",ySplit:1}];
ws.autoFilter = `A1:R${rows.length + 1}`;
ws.getRow(1).font = {bold:true,color:{argb:"FFFFFFFF"}};
ws.getRow(1).fill = {type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}};
ws.getRow(1).alignment = {horizontal:"center",vertical:"middle",wrapText:true};
ws.eachRow((row,i)=>{ row.alignment={vertical:"top",wrapText:true}; if(i>1 && i%2===0) row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F6FA"}}; });
const widths=[16,20,16,22,24,14,10,20,34,28,34,28,34,28,34,28,34,28];
widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
ws.getRow(1).height=32;
const note = wb.addWorksheet("填写说明");
note.getCell("A1").value="缺陷库 Excel 编辑说明"; note.getCell("A1").font={bold:true,size:16};
note.getCell("A3").value="1. 每行代表一个构件缺陷，分类列请勿修改；可直接复制粘贴缺陷名称、标度及描述。";
note.getCell("A4").value="2. 最高标度必须与已填写的标度组数量一致，未使用的标度列留空。";
note.getCell("A5").value="3. 定性描述和定量描述均可编辑；规范没有定量指标时填写“—”，不要留空。";
note.getCell("A6").value="4. 修改完成后运行：node import_defect_library_excel.js exports/缺陷库编辑模板.xlsx";
note.getColumn(1).width=110;
require("fs").mkdirSync(path.dirname(out),{recursive:true});
wb.xlsx.writeFile(out).then(()=>console.log(out));
