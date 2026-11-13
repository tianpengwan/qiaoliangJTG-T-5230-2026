const ExcelJS = require("exceljs");
const path = require("path");
const { db } = require("./db");

// 规范章节在原图中的页段；PDF页码=图片编号-5（用户提供的页码对应关系）。
const IMAGE_RANGES = [
  ["5.",24,27], ["6.1",34,36], ["6.2",37,41], ["6.3",42,52],
  ["7.",53,66], ["8.",67,74], ["9.",75,89], ["10.",90,99]
];
function sourceImage(ref){
  const hit=IMAGE_RANGES.find(x=>ref && ref.startsWith(x[0]));
  return hit ? `pages/${hit[1]}-${hit[2]}.jpg` : "pages/20-99.jpg";
}
function pdfPage(ref){
  const hit=IMAGE_RANGES.find(x=>ref && ref.startsWith(x[0]));
  return hit ? `${hit[1]-5}-${hit[2]-5}` : "15-94";
}
const wb=new ExcelJS.Workbook();
const ws=wb.addWorksheet("PDF15-94缺陷表");
const headers=["PDF页码","原图文件","桥型","结构形式","部位","构件","缺陷名称","标准表号","最高标度","适用构件"];
for(let i=1;i<=5;i++) headers.push(`标度${i}定性`,`标度${i}定量`);
ws.addRow(headers);
const rows=db.prepare(`SELECT bt.name bridge_type,sf.name structure_form,p.name part,c.name component,
 d.id,d.name defect_name,d.max_class,d.standard_ref,d.applicable_to
 FROM bt_defect_type d JOIN bt_component c ON c.id=d.component_id JOIN bt_part p ON p.id=c.part_id
 JOIN bt_struct_form sf ON sf.id=p.struct_form_id JOIN bt_bridge_type bt ON bt.id=sf.bridge_type_id
 WHERE d.standard_ref IS NOT NULL ORDER BY d.standard_ref,bt.sort_order,sf.sort_order,p.sort_order,c.sort_order,d.id`).all();
const scales=db.prepare("SELECT scale,qual,quan FROM bt_defect_scale WHERE defect_type_id=? ORDER BY scale");
for(const r of rows){
  const vals=[pdfPage(r.standard_ref),sourceImage(r.standard_ref),r.bridge_type,r.structure_form,r.part,r.component,r.defect_name,r.standard_ref,r.max_class,r.applicable_to||""];
  const ss=scales.all(r.id); for(let i=1;i<=5;i++){const s=ss.find(x=>x.scale===i); vals.push(s?.qual||"",s?.quan||"");} ws.addRow(vals);
}
ws.views=[{state:"frozen",ySplit:1}]; ws.autoFilter=`A1:T${rows.length+1}`;
ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}}; ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F4E78"}}; ws.getRow(1).alignment={horizontal:"center",vertical:"middle",wrapText:true};
ws.eachRow((row,i)=>{row.alignment={vertical:"top",wrapText:true}; if(i>1&&i%2===0) row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F6FA"}};});
[12,18,16,20,16,22,24,14,10,20,34,28,34,28,34,28,34,28,34,28].forEach((w,i)=>ws.getColumn(i+1).width=w); ws.getRow(1).height=34;
const info=wb.addWorksheet("使用说明"); info.getCell("A1").value="PDF第15-94页缺陷表 Excel 汇总"; info.getCell("A1").font={bold:true,size:16};
info.getCell("A3").value="原图对应：PDF第15页 = pages/20.jpg，PDF第94页 = pages/99.jpg。";
info.getCell("A4").value="每行对应一个标准缺陷；标准表号和原图文件列用于逐项核对。"; info.getCell("A5").value="规范定量栏没有指标时保留“—”，不要留空。"; info.getColumn(1).width=100;
const out=process.argv[2]||path.join(__dirname,"exports","规范PDF15-94缺陷表.xlsx"); require("fs").mkdirSync(path.dirname(out),{recursive:true}); wb.xlsx.writeFile(out).then(()=>console.log({out,rows:rows.length}));
