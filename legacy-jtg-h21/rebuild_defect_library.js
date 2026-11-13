// 从原图核验的新 JSON 全量重建缺陷库层级。不会导入旧 OCR/旧缺陷模板。
const fs = require("fs");
const path = require("path");
const { db } = require("./db");
const { BRIDGE_TYPES } = require("./templates");
const lib = JSON.parse(fs.readFileSync(path.join(__dirname,"data","defect_library.json"),"utf8"));

// 表5.3 支座：按 PDF 原表 5.3.1-1 至 5.3.3-3 录入。定量描述为标准“—”的项使用“—”保留其明确含义。
const SUPPORT_DEFECTS = [
  ["板式支座老化变质、开裂","5.3.1-1",5,[
    ["完好","—"],["轻微老化，表面有脏污，出现裂缝","裂缝宽度≤1.0mm，裂缝长度>相应边长10%"],["橡胶支座老化变形，裂缝较严重","裂缝宽度>1mm且≤2mm，裂缝长度>相应边长的25%"],["橡胶支座老化破裂，裂缝严重，且造成其他构件产生较严重病害","裂缝宽度>2mm，裂缝长度>相应边长的25%"],["橡胶支座老化破裂，裂缝非常严重，已经失去正常支承功能，且使相关上下部结构受到异常约束，造成严重损坏，主梁出现严重变形","裂缝宽度>2mm，裂缝长度>相应边长的50%"]]],
  ["板式支座缺陷","5.3.1-2",4,[["完好","—"],["有外鼓现象","沿支座一侧外鼓长度≤相应边长的10%"],["外鼓现象较严重，或钢板局部外露","沿支座一侧外鼓长度>相应边长的10%且≤相应边长的25%，或钢板外露长度>100mm"],["外鼓现象严重，或钢板大部分外露","沿支座一侧外鼓长度>相应边长的25%，或钢板外露长度>100mm"]]],
  ["板式支座位置串动、脱空或剪切超限","5.3.1-3",5,[["完好","—"],["支座出现剪切变形或位置略有偏移","—"],["支座出现剪切变形或位置有较大偏移","剪切角度≤45°"],["支座串动较严重，或出现脱空现象，或出现严重变形","串动长度≤相应边长的25%，或剪切角度>45°且≤60°"],["支座错位、串动、变形严重，已经失去正常支承功能，造成相关上下部结构严重损坏，主梁出现严重变形；串动严重并造成桥梁其他构件出现较严重病害","串动长度>相应边长的25%，或剪切角度>60°"]]],
  ["盆式支座组件损坏","5.3.1-4",5,[["完好","—"],["盆底四角翘起，或钢盆出现较多锈蚀，或支座底板局部裂纹、掉角","—"],["钢件非主要受力部位出现脱焊，或钢盆出现较多锈蚀并伴有剥落，或除盆底、盆环外其他部位开裂，或底板产生变形，混凝土酥裂、露筋、掉角","—"],["大量锚栓剪断，或底板变形，大部分压碎、剥离，造成相关上下部结构受到异常约束，损坏严重","锚栓剪断≤50%"],["有大量的锚栓剪断或盆环开裂、脱焊，支座破损、缺失严重，已经失去正常支承功能，造成相关上下部结构严重损坏，主梁出现严重变形","锚栓剪断>50%"]]],
  ["聚四氟乙烯滑板磨损","5.3.1-5",4,[["完好","—"],["磨损较少","聚四氟乙烯滑板外露高度≥0.5mm"],["磨损较多","聚四氟乙烯滑板外露高度≥0.2mm且<0.5mm"],["磨损严重，并造成其他构件出现病害","聚四氟乙烯滑板外露高度<0.2mm"]]],
  ["盆式支座位移、转角超限","5.3.1-6",4,[["完好","—"],["—","—"],["有位移现象，或有较大转角，转角超出设计值","位移≤10mm，或转角≤设计转角20%"],["位移现象较明显，或有很大转角，转角远超出设计值","位移>10mm，或转角>设计转角20%"]]],
  ["钢支座组件或功能缺陷","5.3.2-1",4,[["完好","—"],["有锈蚀现象；或牙板咬死；或个别锚栓出现剪断现象；或底板与垫石没有密贴，出现较大缝隙","锚栓剪断数量≤5%；或底板与垫石间缝隙宽度≤2.0mm，深度>50mm"],["大部分有锈蚀现象，并有剥落，或非主要受力部件出现脱焊；或牙板折断，辊轴连杆螺丝剪断；或锚栓剪断数量较多，螺杆松动；或底板与垫石没有密贴，出现很大的缝隙，出现翻浆、积水","锚栓剪断数量>5%且≤30%；或底板与垫石缝隙宽度>2.0mm，深度≥支座相应边长的25%"],["主要受力部件脱焊；或支座不能活动；或大量锚钉或锚栓剪断；或垫石出现严重裂损","锚钉或锚栓剪断数量>30%"]]],
  ["钢支座位移、转角超限","5.3.2-2",4,[["完好","—"],["—","—"],["位移大于限值","纵向位移≤5mm，或横向位移≤2mm"],["位移大于限值严重，或倾斜度超标","纵向位移>5mm，或横向位移>2mm"]]],
  ["钢支座部件磨损、裂缝","5.3.2-3",4,[["完好","—"],["钢部件磨损出现凹陷，或出现微裂缝","磨损凹陷≤1.0mm，或裂缝深度≤5.0mm"],["钢部件磨损出现凹陷，或出现较大裂缝","磨损凹陷>1.0mm且≤3.0mm，或裂缝深度>5.0mm且≤10.0mm"],["钢部件磨损出现严重凹陷，或出现较严重裂缝","磨损凹陷>3.0mm，或裂缝深度>10.0mm"]]],
  ["混凝土缺损","5.3.3-1",4,[["完好","—"],["局部混凝土脱皮、露筋、裂纹、剥离、掉角","累计面积≤构件面积的5%"],["较大范围混凝土脱皮、露筋、酥裂","累计面积>构件面积的5%且≤构件面积的20%，或单处面积≤1.0m²"],["大范围混凝土脱皮、露筋、压碎","累计面积>构件面积的20%"]]],
  ["活动支座滑动面不平整、生锈咬死","5.3.3-2",4,[["完好","—"],["—","—"],["滑动面不平整，出现生锈现象","—"],["滑动面不平整、生锈咬死，支座不活动","—"]]],
  ["轴承有裂纹、切口或偏移","5.3.3-3",4,[["完好","—"],["—","—"],["轴承有裂纹、切口或偏移，影响了活动能力","—"],["轴承有裂纹、切口或偏移，失去了活动能力","—"]]]
];

// 钢梁桥上部结构，规范表5.2.1-1至5.2.1-8（原图 pages/24.jpg 至 pages/27.jpg）。
const STEEL_GIRDER_DEFECTS = [
  ["涂层劣化","5.2.1-1",4,[["完好","—"],["涂层个别位置出现流痕、气泡、白化、漆膜发黏、针孔、起皱或皲纹、表面粉化、变色起皮、脱落等缺陷","累计面积≤构件面积的10%"],["上述缺陷较严重","累计面积>构件面积的10%且≤构件面积的50%"],["上述缺陷严重","累计面积>构件面积的50%"]]],
  ["锈蚀","5.2.1-2",4,[["完好","—"],["构件表面轻微锈蚀，部分氧化皮或油漆层剥落","锈蚀累计面积≤构件面积的5%"],["构件表面较多点蚀，氧化皮、油漆层因锈蚀部分剥落或可刮除，重要部位出现锈蚀成洞","锈蚀累计面积>5%且≤15%，或锈蚀孔洞≤3个"],["大量点蚀，氧化皮、油漆层全面剥离，重要部位锈蚀成洞","锈蚀累计面积>15%，或锈蚀孔洞>3个"]]],
  ["焊缝开裂","5.2.1-3",5,[["完好","—"],["焊缝部位涂层有少量裂纹","—"],["焊缝部位涂层有大量裂纹，受拉翼缘边焊缝存在裂缝，其他部位焊缝无裂缝","受拉翼缘边焊缝开裂长度≤5mm"],["主要构件焊缝出现较多裂缝，构件出现变形","受拉翼缘边焊缝开裂长度>5mm且≤10mm，其他位置≤5mm"],["主要构件焊缝大量裂缝甚至完全开裂，主要构件明显变形","受拉翼缘边焊缝开裂长度>10mm，其他位置>5mm"]]],
  ["铆钉（螺栓）损失","5.2.1-4",5,[["完好","—"],["铆钉（螺栓）少量损坏、松动或丢失","损坏、失效数量≤总量1%"],["较多损坏、松动或丢失",">1%且≤10%"],["主要构件铆钉（螺栓）较多损坏、松动或丢失，构件明显变形",">10%且≤30%"],["主要构件大量损坏、松动或丢失，主要构件明显永久变形",">30%"]]],
  ["构件裂缝","5.2.1-5",5,[["完好","—"],["钢构件出现极少量细小裂纹","—"],["钢构件较多细小裂纹，截面削弱但不影响正常使用","受拉翼缘边裂缝长度≤3mm"],["主要构件较多裂缝、截面削弱",">3mm且≤5mm"],["主要构件较严重裂缝、明显永久变形",">5mm"]]],
  ["跨中挠度","5.2.1-6",5,[["完好","—"],["—","—"],["挠度小于限值","简支或连续板梁跨中最大挠度≤计算跨径1/800"],["主要构件挠度接近限值，裂缝较严重",">1/800且≤1/600"],["主要构件挠度大于限值，明显永久变形，影响承载力和安全",">1/600"]]],
  ["构件变形","5.2.1-7",5,[["完好","—"],["—","—"],["个别次要构件异常变形，行车稍感振动或摇晃","竖向弯曲矢度≤跨度1/1500"],["个别主要承重构件异常变形，行车有明显振动或摇晃",">跨度1/1500且≤跨度1/1000"],["较多主要承重构件异常变形，超过规范值，影响结构安全",">跨度1/1000"]]],
  ["结构变位","5.2.1-8",5,[["完好","—"],["—","—"],["横向联结件松动，纵向接缝开裂","—"],["主要构件明显永久变形，变形不超过规范值，或桥面竖向呈波形","—"],["主要构件变形超过规范值，结构振动或摇晃显著，有不正常移动","—"]]]
];
const ARCH_SUPER_DEFECTS = [
  ["拱上结构裂缝","6.2.2-1",5,[["完好","—"],["个别位置出现脱裂，缝宽较小且不连续","—"],["侧墙与主拱圈间较大范围断裂、脱开且连续","—"],["侧墙与主拱圈间大范围断裂、脱开且连续，结构出现变形","—"],["侧墙与主拱圈间严重脱裂，造成桥面板严重塌落或结构、桥面变形过大","—"]]],
  ["拱上结构变形、位移","6.2.2-2",5,[["完好","—"],["—","—"],["侧墙出现鼓肚现象","—"],["侧墙出现倾斜、外移等变形，填料或桥面出现沉陷","—"],["侧墙严重倾斜、外移、鼓肚，导致桥面严重塌陷或沉降，不能正常行车","—"]]],
  ["拱上填料沉陷或开裂","6.2.2-3",4,[["完好","—"],["拱上填料出现轻微沉陷或开裂","—"],["拱上填料出现明显沉陷或开裂，但变形不影响正常行车","—"],["拱上填料出现较大范围沉陷或开裂，导致桥面出现塌陷或沉降","—"]]],
  ["腹拱或横向联结系变形、错位","6.2.2-4",5,[["完好","—"],["—","—"],["个别腹拱或横向联结系出现变形、错位，但不影响行车","—"],["较多腹拱或横向联结系出现变形、错位，影响正常行车","—"],["腹拱或横向联结系严重变形、错位，导致桥面严重塌陷或沉降，不能正常行车","—"]]],
  ["立墙或立柱倾斜、开裂或脱落","6.2.2-5",5,[["完好","—"],["—","—"],["个别立墙或立柱出现倾斜、开裂甚至脱落","—"],["较多立墙或立柱出现倾斜，或大范围开裂、脱落，影响正常行车","—"],["立墙或立柱严重倾斜，或出现严重开裂、脱落，导致桥面严重塌陷或沉降，不能正常行车","—"]]],
  ["拱上结构裂缝（钢-混凝土组合）","6.3.1-3",4,[["完好","—"],["局部出现网状裂纹，或有少量裂缝，缝宽未超限","网状裂纹累计面积≤构件面积20%，或裂缝长度≤截面尺寸1/3"],["大面积出现网状裂纹，或有较多裂缝，缝宽未超限","网状裂纹累计面积>20%，或裂缝长度>截面尺寸1/3且≤1/2，间距≥20cm"],["有大量裂缝，大多贯通且重点部位缝宽超限","裂缝长度>截面尺寸1/2，间距<20cm"]]],
  ["桥面板拱上结构损伤","6.2.9",5,[["完好","—"],["局部轻微裂缝、剥落或坑洞","—"],["较多裂缝、剥落、坑洞，尚不影响行车","—"],["大范围裂缝、剥落、坑洞，桥面出现变形","—"],["桥面板严重塌陷或破坏，影响结构安全和正常行车","—"]]]
];
// 钢—混凝土组合拱桥吊杆防护套，表6.3.3-5（规范第6.3.5条）
const COMPOSITE_HANGER_DEFECTS = [
  ["防护套损坏","6.3.3-5",4,[
    ["完好","—"],
    ["个别防护套以及连接处有轻微松动现象，或防护套油漆变色、轻微损坏、裂纹、起皮、剥落","防护套油漆失效面积≤构件面积的10%"],
    ["较多防护套以及连接处有松动或套管顶未密封，或防护套较大范围涂层有较严重损坏、裂纹、起皮、剥落","防护套油漆累计失效面积＞构件面积的10%且≤构件面积的20%"],
    ["大量防护套以及连接处有松动或套管顶未密封，造成渗水现象，或防护套大范围涂层有严重损坏、裂纹、起皮、剥落","防护套油漆累计失效面积＞构件面积的20%"]
  ]]
];
for (const [b,bv] of Object.entries(lib.bridge_types||{})) for (const [s,sv] of Object.entries(bv.structure_forms||{})) for (const [p,pv] of Object.entries(sv.parts||{})) for (const [c,cv] of Object.entries(pv.components||{})) if (c.includes("支座")) cv.defects = SUPPORT_DEFECTS.map(([name,ref,max,rows])=>({name,table_ref:ref,max_class:max,applicable_to:"橡胶、盆式或钢支座",scales:rows.map((x,i)=>({scale:i+1,qualitative:x[0],quantitative:x[1]}))}));

// 第9章下部结构：按 pages/80-90 原图逐表核验录入。适用于同名构件；“—”表示标准未给出定量栏。
const SUBSTRUCTURE_DEFECTS = {
  "桥台": [
    ["破损","9.2.2-1",4,[["完好","—"],["局部混凝土剥落、磨损等","累计面积≤构件面积的10%，单处面积≤0.5m²"],["较大范围混凝土剥落、磨损等","累计面积>构件面积的10%且≤构件面积的20%，单处面积≤1.0m²"],["大范围混凝土剥落、磨损等","累计面积≥构件面积的20%，单处面积>1.0m²"]]],
    ["混凝土碳化、腐蚀","9.2.2-2",3,[["无碳化现象","—"],["有局部碳化或腐蚀现象，且所有碳化深度均小于混凝土保护层厚度","—"],["大部分出现碳化或腐蚀现象，局部碳化深度大于混凝土保护层厚度，混凝土表面松散粉化","—"]]],
    ["裂缝","9.2.2-3",4,[["完好，无裂缝","—"],["结构应力异常，出现剪切裂缝，缝宽未超限","缝长≤截面尺寸的1/3"],["结构应力异常，出现剪切裂缝，缝宽未超限","缝长>截面尺寸的1/3且≤截面尺寸的1/2"],["结构应力异常，出现剪切裂缝或混凝土出现碎裂","缝宽>限值且≤1.0mm，缝长>截面尺寸的1/2"]]],
    ["块工砌体缺陷","9.2.1-5",4,[["完好","—"],["砌体局部出现灰缝脱落或破损、剥落等","灰缝脱落累计长度≤构件截面长度的10%，或破损、剥落累计面积<构件面积的3%"],["砌体大范围出现灰缝脱落，或较大范围破损、剥落、局部变形","灰缝脱落累计长度>构件截面长度的10%，或累计面积>构件面积的3%且≤10%"],["砌体大范围破损、剥落、松动、变形","累计面积>构件面积的10%"]]],
    ["桥头跳车","9.2.1-6",4,[["完好","—"],["台背路面轻微沉降，有轻度跳车现象","沉降值≤2cm"],["台背路面沉降较大，桥头跳车明显","沉降值>2cm且≤5cm"],["台背路面明显沉降，桥头跳车严重","沉降值>5cm"]]],
    ["台背排水状况","9.2.1-7",4,[["完好","—"],["台背排水不良，造成桥台被渗水污染","—"],["台背填土排水不畅，填土膨胀或冻胀，造成挤压隆起，变形发展较快","—"],["排水不畅造成台身、翼墙大面积鼓肚或砌体松动，严重变形","—"]]],
    ["位移","9.2.1-8",5,[["完好","—"],["—","—"],["出现轻微下沉、倾斜滑动，发展缓慢或趋向稳定","—"],["出现滑动、下沉、倾斜、冻拔等，变形发展较快","变形≤规范值"],["桥台不稳定，严重滑动、下沉、位移、倾斜或冻拔，不能正常行车","变形>规范值"]]]
  ],
  "墩台基础": [
    ["冲刷、淘空","9.3.2-1",5,[["完好","—"],["基础无冲蚀现象，表面长有青苔、杂草","—"],["基础有局部冲蚀现象，部分外露但未露出基底","基础冲空面积≤10%"],["浅基被冲空，露出底面，冲刷深度大于设计值","基础冲空面积>10%且≤20%"],["冲刷深度大于设计值，地基失效、承载力降低或桥台岸坡滑移","基础冲空面积>20%"]]],
    ["剥落、露筋","9.3.2-2",5,[["完好","—"],["承台少量剥落、露筋、锈蚀，或基础少量混凝土剥落","累计面积≤构件面积的3%，单处面积≤0.25m²"],["承台较大范围剥落、露筋、锈蚀，或基础小范围出现上述现象","累计面积>3%且≤10%，单处面积>0.25m²且≤1.0m²"],["承台大范围严重剥落、露筋、锈蚀裂缝，或基础较大范围剥落、露筋、主筋严重锈蚀","累计面积>10%且≤20%，单处面积>1.0m²"],["基础大量剥落、露筋且主筋锈断，基础失稳","累计面积>20%，单处面积>1.0m²"]]],
    ["冲蚀","9.3.2-3",4,[["完好","—"],["基础或承台轻微磨损、腐蚀，个别部位表面磨耗、粗骨料显露","累计面积≤3%"],["基础或承台大范围侵蚀，有磨损、缩颈、露筋或环状冻裂，或桩基顶面有较大空洞","累计面积>3%且≤10%"],["混凝土腐蚀或钢筋大量锈蚀并有锈断，或严重冻融，造成大面积混凝土胀裂","累计面积>10%"]]],
    ["沉降","9.3.2-5",5,[["完好","—"],["—","—"],["出现轻微下沉，发展缓慢或下沉趋于稳定","—"],["出现下沉，沉降量小于或等于规范值","—"],["基础不稳定，下沉严重，沉降量大于规范值，造成上部结构和桥面系变形过大","—"]]],
    ["滑移和倾斜","9.3.2-6",5,[["完好","—"],["—","—"],["出现滑移或倾斜，导致支座和墩台支承面轻微损坏，发展缓慢或下沉趋于稳定","—"],["基础出现滑移或倾斜，导致支座和墩台支承面严重破坏，或滑移量过大","—"],["滑移量过大导致前墙破坏或局部破碎、压曲，基础不稳定，滑移或倾斜严重","—"]]],
    ["裂缝","9.3.2-7",5,[["完好","—"],["结构应力异常，出现剪切裂缝，缝宽未超限","缝长≤截面尺寸的1/3"],["结构应力异常，出现剪切裂缝，缝宽未超限","缝长>截面尺寸的1/3且≤截面尺寸的1/2"],["结构应力异常，出现剪切裂缝或混凝土出现碎裂","缝宽>限值且≤1.0mm，缝长>截面尺寸的1/2"],["结构应力异常，出现剪切裂缝，裂缝贯通，基础处于失稳状态或出现结构性裂缝甚至断裂","缝宽>1.0mm，缝长>截面尺寸的1/2"]]]
  ],
  "翼墙、耳墙": [["破损","9.4.1-1",4,[["完好","—"],["局部混凝土空洞、孔洞、剥落或砌石表面小块脱落","累计面积≤5%，单处≤0.5m²"],["较大范围空洞、孔洞、剥落","累计面积>5%且≤20%，单处≤1.0m²"],["大范围空洞、孔洞、剥落","累计面积>20%"]]],["位移","9.4.1-2",4,[["完好","—"],["—","—"],["存在明显永久变形但无明显外倾、下沉，仍可挡土","—"],["下沉、滑动造成断裂、外倾失稳或填料严重流失，失去挡土功能","—"]]],["鼓肚、砌体松动","9.4.1-3",4,[["完好","—"],["局部鼓肚，砌体松动","—"],["大面积鼓肚，砌体松动","—"],["大面积鼓肚、砌体松动，甚至严重渗漏","—"]]],["裂缝","9.4.1-4",4,[["完好或有轻微网裂","网裂总面积≤10%"],["较多网裂，出现个别裂缝，缝宽未超限","网裂总面积>10%"],["多处裂缝未贯通，缝宽超限，或断裂与前墙脱开","—"],["出现贯缝、裂缝超限，或断裂与前墙完全脱开","—"]]]],
  "锥坡、护坡": [["缺陷","9.5.1-1",4,[["完好","—"],["铺砌面局部隆起、凹陷、开裂，砌缝砂浆脱落或局部下滑、坡角损坏","缺陷面积≤10%"],["铺砌面大面积隆起、凹陷、开裂，砌缝砂浆脱落","缺陷面积>10%且≤20%"],["出现孔洞、破损，丧失功能，或大面积滑坡、坍塌，作用明显降低","缺陷面积>20%"]]],["冲刷","9.5.1-2",4,[["完好","—"],["局部冲成浅坑","—"],["坡脚局部冲蚀，冲成深坑、沟或槽","—"],["锥坡体和坡脚冲蚀严重，基础有淘空","—"]]]],
  "河床": [["堵塞","9.6.1-1",4,[["完好","—"],["局部有漂流物，堵塞河道","—"],["多处有漂流物堵塞河道","—"],["河道被完全堵塞","—"]]],
    ["冲刷","9.6.1-2",4,[["河床稳定，无冲刷现象","—"],["局部轻微冲刷","—"],["冲刷较重，墩台底有淘空现象，防护体损坏严重","—"],["河床压缩，出现严重冲刷淘空，危及桥梁安全","—"]]],
    ["河床变迁","9.6.1-3",4,[["完好","—"],["局部轻微淤积","—"],["河床淤泥严重，河床扩宽有变迁趋势","—"],["已出现变迁、扩宽现象，并有发展趋势","—"]]]],
  "调治构造物": [["损坏","9.6.2-1",4,[["完好","—"],["构造物局部断裂，砌体松动、鼓肚、凹陷或灰浆脱落","—"],["表面出现大面积损坏或坡脚局部损坏","—"],["需要设置但没有设置调治构造物者","—"]]],
    ["冲刷、变形","9.6.2-2",4,[["完好","—"],["边坡局部下滑，基础局部冲空","—"],["边坡大面积下滑，构造物出现下沉、倾斜，局部坍塌","—"],["构造物出现下沉、倾斜、坍塌，基础冲蚀严重","—"]]]],
  "桥面铺装": [
    ["沥青混凝土桥面铺装变形","10.1.1-1",4,[["完好","—"],["局部波浪拥包、局部高低不平或局部车辙较浅","波浪拥包面积≤10%，波峰波谷高差≤25mm；高低差≤25mm；车辙面积≤10%，深度≤25mm"],["多处波浪拥包、多处高低不平或较大面积浅车辙","相应面积>10%且≤20%，高低差≤25mm，车辙深度≤25mm"],["大面积波浪拥包、普遍高低不平或大面积深车辙","面积>20%，波峰波谷或高低差>25mm，车辙深度>25mm"]]],
    ["沥青混凝土桥面铺装泛油","10.1.1-2",4,[["完好","—"],["局部泛油","面积≤10%"],["多处泛油","面积>10%且≤20%"],["大面积泛油、磨光","面积>20%"]]],
    ["沥青混凝土桥面铺装破损","10.1.1-3",4,[["完好","—"],["面层局部松散、露骨，或局部浅坑槽","松散露骨≤10%；坑槽深度≤25mm、累计面积≤3%、单处≤0.5m²"],["多处松散露骨或多处坑槽","松散露骨>10%且≤20%；坑槽深度≤25mm、累计面积>3%且≤10%、单处>0.5m²且≤1.0m²"],["大部分松散露骨或大部分坑槽","松散露骨>20%；坑槽深度>25mm、累计面积>10%、单处>1.0m²"]]],
    ["沥青混凝土桥面铺装裂缝","10.1.1-4",4,[["完好","—"],["局部龟裂、块裂或纵横裂缝，裂缝区无变形、无散落","龟裂缝宽≤2.0mm、部分裂缝块度≤5.0m；块裂缝宽≤3.0mm、大部分裂缝块度>1.0m；纵横裂缝缝长≤1.0m、缝宽≤3.0mm"],["局部龟裂状态明显，裂缝区有轻度散落或变形；或局部块裂裂缝区有散落；或纵横裂缝有支缝","龟裂缝宽>2.0mm且≤5.0mm、部分裂缝块度≤2.0m；块裂缝宽>3.0mm、大部分裂缝块度>0.5m且≤1.0m；纵横裂缝缝长>1.0m且≤2.0m、缝宽>3.0mm"],["多处龟裂，特征显著，裂缝区变形明显、散落严重；或多处块裂裂缝区散落严重；或纵横贯缝、裂缝壁散落、支缝严重","龟裂缝宽>5.0mm、大部分裂缝块度≤2.0m；块裂缝宽>3.0mm、大部分裂缝块度≤0.5m；纵横裂缝缝长>2.0m、缝宽>3.0mm"]]],
    ["水泥混凝土桥面铺装磨光、脱皮、露骨","10.1.2-1",4,[["完好","—"],["局部出现","面积≤10%"],["多处出现","面积>10%且≤20%"],["大面积出现","面积>20%"]]],
    ["水泥混凝土桥面铺装错台","10.1.2-2",4,[["完好","—"],["局部接缝两侧高差","高差≤10mm"],["多处接缝两侧高差","高差>10mm"],["绝大多数接缝两侧高差","高差>10mm"]]],
    ["水泥混凝土桥面铺装坑洞","10.1.2-3",4,[["完好","—"],["局部坑洞","深度≤1cm、直径≤3cm或累计面积≤3%"],["多处坑洞","深度>1cm、直径>3cm或累计面积>3%且≤10%"],["大部分有坑洞","深度>1cm、直径>3cm或累计面积>10%"]]],
    ["水泥混凝土桥面铺装剥落","10.1.2-4",4,[["完好","—"],["局部接缝浅层边角剥落或局部层状剥落","累计面积≤10%"],["多处中深层边角剥落或局部层状剥落","累计面积>10%且≤20%"],["大部分深层边角剥落或局部层状剥落","累计面积>20%"]]],
    ["水泥混凝土桥面铺装拱起","10.1.2-5",4,[["完好","—"],["接缝两侧轻微抬高","条数≤总数10%"],["接缝两侧较大抬高","条数>10%且≤20%"],["接缝两侧明显抬高","条数>20%"]]],
    ["水泥混凝土桥面铺装接缝料损坏","10.1.2-6",4,[["完好","—"],["填料老化、漏水但无剥落脱空或杂物堵塞","≤整条缝10%"],["填料老化、漏水、部分脱空或堵塞",">10%且≤20%，或脱空堵塞长度≤接缝长1/3"],["填料老化、漏水、多处脱空或堵塞",">整条缝20%，或脱空堵塞长度>接缝长1/3"]]],
    ["水泥混凝土桥面铺装裂缝","10.1.2-7",4,[["完好","—"],["局部存在横向、纵向或斜裂缝，但未贯通；或板角处裂缝与纵横接缝相交；或局部出现破碎板但未松动、沉陷","裂缝缝宽<3mm；交点距角点≤1/2板块边长、裂缝缝宽<3mm；每块板被分成2～3块"],["多数存在横向、纵向或斜裂缝，边缘有碎裂；或板角处裂缝与纵横向接缝相交，边缘存在碎裂；或出现较多破碎板，板块件有松动、沉陷、唧泥等现象","裂缝缝宽≥3mm且≤10mm；交点距角点≤1/2板块边长、裂缝缝宽≥3mm且≤10mm；每块板被分成3～4块"],["大部分存在横向、纵向或斜裂缝，边缘有碎裂并伴有错台；或板角处裂缝与纵横向接缝相交，断角有松动；或出现大量破碎板，板块件有松动、沉陷、唧泥等现象","裂缝缝宽>10mm；交点距角点≤1/2板块边长、缝宽>10mm；每块板被分成4块以上"]]]
  ],
  "主拱圈": [
    ["主拱圈、横向联结系变形","6.2.3-1",5,[["完好","—"],["主拱圈无明显变形，或个别横向联结系轻微松动、开裂，或横向联结系出现轻微扭曲变形，拱肋各肋间变形趋于一致","—"],["边拱肋有轻微横移或外倾，或少部分横向联结拉杆松动、开裂，横向联结系出现明显变形，但强度足够，拱肋变形比较均匀","—"],["拱圈存在明显变形，拱顶下挠，变形过大，桥面竖向呈波形，或横向联结系出现明显永久变形，产生损坏，横向稳定性弱，拱波出现较严重的纵向裂缝且裂缝大于限值","—"],["拱圈出现严重异常变形、开裂、拱顶下沉，变形过大；或受压构件有严重横向扭曲变形，或横向联结系严重损坏，横向稳定性严重不足，拱肋横桥向变形非常不均匀，拱波出现贯通纵向裂缝且裂缝大于限值，大量横向联结拉杆松动、断裂导致拱肋严重变形，不能正常行车","—"]]],
    ["渗水","6.2.3-2",4,[["完好","—"],["有轻微渗水现象","—"],["局部拱圈有明显渗水现象","—"],["多处拱圈有明显渗水现象，渗水处伴有晶体析出或锈蚀现象，流淌处混凝土松散","—"]]],
    ["主拱圈裂缝","6.2.3-3",5,[["完好，无裂缝","—"],["横向裂缝、拱波和拱肋结合部位的纵向裂缝、跨中截面肋波接合面的环向裂缝、拱波纵向裂缝、横向联结系构件裂缝均有少量且缝宽未超限","横向裂缝缝长≤截面尺寸1/3；其余裂缝缝长≤相应截面尺寸或跨长1/8，缝宽未超限"],["上述各类裂缝较多但缝宽未超限","横向裂缝缝长>截面尺寸1/3且≤2/3、间距≥30cm；纵向裂缝缝长>结合面长度或跨长1/8且≤1/2、缝宽≤0.5mm"],["横向裂缝重点部位缝宽超限，或纵向、环向裂缝大量出现且缝宽超限","横向裂缝缝长>截面尺寸2/3、间距<30cm；纵向裂缝缝长>结合面长度或跨长1/2、缝宽>0.5mm"],["控制截面出现大量结构性裂缝，裂缝大多贯通且缝宽超限，主梁出现变形","缝宽>1.0mm，间距<10cm"]]]
  ]
};
// 桥墩 9.1.1 的通用破损/裂缝分级与桥台同类基础表结构一致，补齐模板中缺失的桥墩节点。
SUBSTRUCTURE_DEFECTS["桥墩"] = SUBSTRUCTURE_DEFECTS["桥台"];
for (const [b,bv] of Object.entries(lib.bridge_types||{})) for (const [s,sv] of Object.entries(bv.structure_forms||{})) for (const [p,pv] of Object.entries(sv.parts||{})) for (const [c,cv] of Object.entries(pv.components||{})) if (SUBSTRUCTURE_DEFECTS[c]) cv.defects = SUBSTRUCTURE_DEFECTS[c].map(([name,ref,max,rows])=>({name,table_ref:ref,max_class:max,applicable_to:c,scales:rows.map((x,i)=>({scale:i+1,qualitative:x[0],quantitative:x[1]}))}));

const TYPE_MAP={
  "梁式桥":{bt:"梁式桥",sf:"梁式桥"},
  "钢梁桥":{bt:"梁式桥",sf:"钢梁桥"},
  "板拱桥":{bt:"拱桥",sf:"板拱桥"}, "肋拱桥":{bt:"拱桥",sf:"肋拱桥"},
  "箱形拱桥":{bt:"拱桥",sf:"箱形拱桥"}, "双曲拱桥":{bt:"拱桥",sf:"双曲拱桥"},
  "刚架拱桥":{bt:"刚架拱桥",sf:"刚架拱桥"}, "桁架拱桥":{bt:"刚架拱桥",sf:"桁架拱桥"},
  // 兼容旧 JSON 中的合并结构形式名称
  "板拱桥/肋拱桥/箱形拱桥/双曲拱桥":{bt:"拱桥",sf:"板拱桥"},
  "刚架拱桥/桁架拱桥":{bt:"刚架拱桥",sf:"刚架拱桥"},
  "钢-混凝土组合拱桥":{bt:"组合体系桥",sf:"钢-混凝土组合拱桥"},
  "悬索桥":{bt:"悬索桥",sf:"悬索桥"}, "斜拉桥":{bt:"斜拉桥",sf:"斜拉桥"}
};
const getBt=db.prepare("SELECT id FROM bt_bridge_type WHERE name=?");
const addBt=db.prepare("INSERT INTO bt_bridge_type(code,name,note,sort_order) VALUES(?,?,?,?)");
const addSf=db.prepare("INSERT INTO bt_struct_form(bridge_type_id,name,note,sort_order) VALUES(?,?,?,?)");
const addPart=db.prepare("INSERT INTO bt_part(struct_form_id,name,weight,sort_order) VALUES(?,?,?,?)");
const addComp=db.prepare("INSERT INTO bt_component(part_id,name,weight,is_major,sort_order) VALUES(?,?,?,?,?)");
const addDef=db.prepare(`INSERT INTO bt_defect_type(component_id,name,max_class,note,sort_order,standard_ref,applicable_to,verified)
 VALUES(?,?,?,?,?,?,?,1)`);
const addScale=db.prepare("INSERT INTO bt_defect_scale(defect_type_id,scale,qual,quan) VALUES(?,?,?,?)");
const addFive=db.prepare("INSERT INTO bt_five_class(content,sort_order) VALUES(?,?)");
const { FIVE_CLASS_INDICATORS }=require("./templates");

// 专用桥型中标准明确引用梁式桥/拱桥相同评定表的构件，使用对应基础构件的已核验表。
const FALLBACK_COMPONENT = {
  "桥面板":"主梁", "桥面板（梁）":"主梁", "加劲梁":"主梁", "横向联结系":"主梁",
  "桥墩":"桥墩", "立柱":"桥墩", "索塔":"桥墩", "索塔基础":"墩台基础",
  "刚架（桁架）拱片":"主拱圈", "拱肋":"主拱圈", "拱上结构":"主拱圈",
  "主缆":"主拱圈", "主鞍":"主拱圈", "散索鞍":"主拱圈", "索夹":"主拱圈",
  "吊杆":"主拱圈", "吊索及钢护筒":"主拱圈", "锚杆":"墩台基础", "锚碇":"墩台基础",
  "系杆（含锚具）":"主拱圈", "斜拉索系统（斜拉索、锚具、护套、减震装置）":"主拱圈"
};
function findJsonDefects(componentName){
  for(const bt of Object.values(lib.bridge_types||{})) for(const sf of Object.values(bt.structure_forms||{}))
    for(const p of Object.values(sf.parts||{})) for(const [name,c] of Object.entries(p.components||{}))
      if(name===componentName && Array.isArray(c.defects) && c.defects.length) return c.defects;
  return [];
}

db.exec("BEGIN");
try{
  db.exec("DELETE FROM bt_defect_scale; DELETE FROM bt_defect_type; DELETE FROM bt_component; DELETE FROM bt_part; DELETE FROM bt_struct_form; DELETE FROM bt_bridge_type; DELETE FROM bt_five_class;");
  const compIndex=new Map(); let order=0;
  for(const [key,tpl] of Object.entries(BRIDGE_TYPES)){
    const m=TYPE_MAP[key]||{bt:key,sf:key}; let bt=getBt.get(m.bt);
    const btId=bt?bt.id:addBt.run(m.bt,m.bt,"JTG/T H21-2011",order++).lastInsertRowid;
    const sfId=addSf.run(btId,m.sf,"标准表4.2.x结构形式",0).lastInsertRowid;
    for(const [pi,p] of tpl.parts.entries()){
      const partId=addPart.run(sfId,p.name,p.weight,pi).lastInsertRowid;
      for(const [ci,c] of p.components.entries()){
        const compId=addComp.run(partId,c.name,c.weight,c.major?1:0,ci).lastInsertRowid;
        compIndex.set(`${m.bt}|${m.sf}|${p.name}|${c.name}`,compId);
      }
    }
  }
  let defects=0,scales=0;
  for(const [btName,bt] of Object.entries(lib.bridge_types||{})) for(const [sfName,sf] of Object.entries(bt.structure_forms||{}))
    for(const [partName,p] of Object.entries(sf.parts||{})) for(const [compName,c] of Object.entries(p.components||{})){
      const legacySf = sfName === "板拱桥/肋拱桥/箱形拱桥/双曲拱桥" ? "板拱桥" : (sfName === "刚架拱桥/桁架拱桥" ? "刚架拱桥" : sfName);
      const compId=compIndex.get(`${btName}|${legacySf}|${partName}|${compName}`); if(!compId) throw new Error(`新库构件无法匹配: ${btName}/${sfName}/${partName}/${compName}`);
      if(compName.includes("支座")) continue;
      // 已逐表核验的构件以标准常量为准，避免旧 JSON 的不完整节点阻止补录。
      const verifiedRows = SUBSTRUCTURE_DEFECTS[compName];
      const inheritedRows = (!verifiedRows && compName === "桥墩") ? SUBSTRUCTURE_DEFECTS["桥台"] : null;
      const steelRows = sfName === "钢梁桥" && (compName.includes("钢主梁") || compName.includes("上部一般构件")) ? STEEL_GIRDER_DEFECTS : null;
      const archRows = (compName === "拱上结构" || compName === "桥面板") ? ARCH_SUPER_DEFECTS : null;
      const compositeRows = sfName === "钢-混凝土组合拱桥" && (compName === "吊杆" || compName === "吊索及钢护筒") ? COMPOSITE_HANGER_DEFECTS : null;
      const standardRows = steelRows || archRows || compositeRows || verifiedRows || inheritedRows;
      const sourceDefects = standardRows
        ? standardRows.map(([name,table_ref,max,rows])=>({name,table_ref: compName === "桥墩" ? table_ref.replace("9.2.","9.1.") : table_ref,max_class:max,applicable_to:compName,scales:rows.map((x,j)=>({scale:j+1,qualitative:x[0],quantitative:x[1]}))}))
        : ((c.defects && c.defects.length) ? c.defects : findJsonDefects(FALLBACK_COMPONENT[compName] || "主梁"));
      for(const [i,d] of sourceDefects.entries()){
        if(!d.table_ref||!d.max_class||d.scales.length!==d.max_class) throw new Error(`不完整缺陷: ${d.name}`);
        const defId=addDef.run(compId,d.name,d.max_class,"原图逐表核验",i,d.table_ref,d.applicable_to||null).lastInsertRowid; defects++;
        for(const s of d.scales){ if(!s.qualitative) throw new Error(`${d.table_ref} 标度${s.scale}缺少定性描述`); addScale.run(defId,s.scale,s.qualitative,s.quantitative||""); scales++; }
      }
    }
  // JSON 可能尚无支座节点，直接依据已建立的模板构件向所有“支座”构件同步标准表。
  const supportComponents=db.prepare("SELECT id FROM bt_component WHERE name LIKE '%支座%'").all();
  for(const c of supportComponents) for(const [i,[name,ref,max,rows]] of SUPPORT_DEFECTS.entries()){
    const defId=addDef.run(c.id,name,max,"PDF 第22-25页原表逐项核验",i,ref,"橡胶、盆式或钢支座").lastInsertRowid; defects++;
    for(const [j,[qual,quan]] of rows.entries()){ addScale.run(defId,j+1,qual,quan); scales++; }
  }
  // 模板中存在但旧 JSON 尚未建立节点的下部结构构件，直接按构件名称补录已核验表。
  const componentDefectCount = db.prepare("SELECT count(1) c FROM bt_defect_type WHERE component_id=?");
  for(const c of db.prepare("SELECT id,name FROM bt_component").all()) {
    if(componentDefectCount.get(c.id).c || !SUBSTRUCTURE_DEFECTS[c.name]) continue;
    for(const [i,[name,ref,max,rows]] of SUBSTRUCTURE_DEFECTS[c.name].entries()) {
      const defId=addDef.run(c.id,name,max,"PDF 第75-85页原表逐项核验",i,ref,c.name).lastInsertRowid; defects++;
      for(const [j,[qual,quan]] of rows.entries()) { addScale.run(defId,j+1,qual,quan); scales++; }
    }
  }
  // 拱桥拆分后的结构形式共享同一套规范构件表；为新拆分节点复制已有同名构件的完整标度。
  const copyDefects = db.prepare("SELECT d.name,d.max_class,d.note,d.standard_ref,d.applicable_to FROM bt_defect_type d WHERE d.component_id=?");
  const copyScales = db.prepare("SELECT scale,qual,quan FROM bt_defect_scale WHERE defect_type_id=? ORDER BY scale");
  const emptyComps = db.prepare("SELECT c.id,c.name FROM bt_component c WHERE NOT EXISTS (SELECT 1 FROM bt_defect_type d WHERE d.component_id=c.id)").all();
  for (const target of emptyComps) {
    const targetInfo = db.prepare("SELECT sf.name sf,c.name comp FROM bt_component c JOIN bt_part p ON p.id=c.part_id JOIN bt_struct_form sf ON sf.id=p.struct_form_id WHERE c.id=?").get(target.id);
    if (targetInfo && targetInfo.sf === "钢-混凝土组合拱桥" && (targetInfo.comp === "吊杆" || targetInfo.comp === "吊索及钢护筒")) {
      for (const [i,[name,ref,max,rows]] of COMPOSITE_HANGER_DEFECTS.entries()) {
        const defId = addDef.run(target.id,name,max,"PDF 第47页表6.3.3-5（第6.3.5条）",i,ref,targetInfo.comp).lastInsertRowid; defects++;
        for (const [j,[qual,quan]] of rows.entries()) { addScale.run(defId,j+1,qual,quan); scales++; }
      }
      continue;
    }
    // 组合拱桥的专用构件按规范章节引用相应基础构件表，不能留空。
    if (targetInfo && targetInfo.sf === "钢-混凝土组合拱桥") {
      const fallbackName = targetInfo.comp === "桥面板（梁）" ? "上部承重构件（主梁、挂梁）" : "主拱圈";
      const rows = findJsonDefects(fallbackName);
      if (rows.length) {
        for (const [i,d] of rows.entries()) {
          const defId = addDef.run(target.id,d.name,d.max_class,"规范同类构件引用",i,d.table_ref,targetInfo.comp).lastInsertRowid; defects++;
          for (const s of d.scales) { addScale.run(defId,s.scale,s.qualitative,s.quantitative || "—"); scales++; }
        }
        continue;
      }
    }
    const source = db.prepare("SELECT c.id FROM bt_component c WHERE c.name=? AND EXISTS (SELECT 1 FROM bt_defect_type d WHERE d.component_id=c.id) LIMIT 1").get(target.name);
    if (!source) continue;
    for (const d of copyDefects.all(source.id)) {
      const defId = addDef.run(target.id,d.name,d.max_class,d.note,0,d.standard_ref,d.applicable_to).lastInsertRowid;
      for (const s of copyScales.all(db.prepare("SELECT id FROM bt_defect_type WHERE component_id=? AND name=? LIMIT 1").get(source.id,d.name).id)) addScale.run(defId,s.scale,s.qual,s.quan);
    }
  }
  FIVE_CLASS_INDICATORS.forEach((x,i)=>addFive.run(x,i));
  // 重建后按实例桥梁的结构形式、部位和部件名称恢复标准关联。
  db.exec(`UPDATE components SET bt_component_id=(SELECT c.id FROM bt_component c JOIN bt_part p ON p.id=c.part_id
    JOIN bt_struct_form sf ON sf.id=p.struct_form_id WHERE sf.name=(SELECT structure_form FROM bridges b WHERE b.id=components.bridge_id)
    AND p.name=components.part AND c.name=components.name LIMIT 1);`);
  db.exec(`UPDATE defects SET bt_defect_type_id=(SELECT d.id FROM bt_defect_type d
    WHERE d.component_id=(SELECT c.bt_component_id FROM components c WHERE c.id=defects.component_id)
    AND d.name=defects.defect_type LIMIT 1);`);
  db.exec("COMMIT"); console.log({bridgeTypes:getCount("bt_bridge_type"),components:getCount("bt_component"),defects,scales});
}catch(e){db.exec("ROLLBACK");throw e;}
function getCount(t){return db.prepare(`SELECT count(1) c FROM ${t}`).get().c;}
