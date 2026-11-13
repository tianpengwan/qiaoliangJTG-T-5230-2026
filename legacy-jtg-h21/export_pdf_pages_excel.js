const ExcelJS=require("exceljs"); const fs=require("fs"); const path=require("path");
const wb=new ExcelJS.Workbook(); const dir=path.join(__dirname,"..","pages");
for(let img=20;img<=99;img++){
  const file=path.join(dir,`${img}.jpg`); if(!fs.existsSync(file)) continue;
  const pdf=img-5; const ws=wb.addWorksheet(`PDF${pdf}`); ws.getColumn(1).width=24; ws.getColumn(2).width=30; ws.getColumn(3).width=30; ws.getColumn(4).width=30;
  ws.getCell("A1").value=`PDF第${pdf}页（原图 pages/${img}.jpg）`; ws.getCell("A1").font={bold:true,size:14}; ws.mergeCells("A1:D1");
  ws.getCell("A2").value="本页原图（保持规范表格版式）"; ws.getCell("A2").font={bold:true}; ws.mergeCells("A2:D2");
  const id=wb.addImage({filename:file,extension:"jpeg"}); ws.addImage(id,{tl:{col:0,row:2},ext:{width:900,height:1273}});
  ws.getCell("A70").value="视觉识别录入区"; ws.getCell("A70").font={bold:true,size:13}; ws.mergeCells("A70:D70");
  ws.getCell("A71").value="表号"; ws.getCell("B71").value="缺陷名称"; ws.getCell("C71").value="标度/定性描述"; ws.getCell("D71").value="定量描述"; ws.getRow(71).font={bold:true};
  for(let r=72;r<=90;r++){ws.getRow(r).height=32; ws.getRow(r).alignment={vertical:"top",wrapText:true};}
  ws.views=[{state:"frozen",ySplit:2}];
}
const out=process.argv[2]||path.join(__dirname,"exports","规范PDF15-94原页表格.xlsx"); fs.mkdirSync(path.dirname(out),{recursive:true}); wb.xlsx.writeFile(out).then(()=>console.log({out,sheets:wb.worksheets.length}));
