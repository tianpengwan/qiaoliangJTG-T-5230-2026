const assert = require("node:assert/strict");
const { assess, tValue, gradeOf, memberScore } = require("./assess");
const { dpValue } = require("./templates");

assert.equal(tValue(1), Infinity);
assert.equal(tValue(2), 10);
assert.equal(tValue(35), 5.15);
assert.equal(tValue(200), 2.3);
assert.equal(gradeOf(95), 1);
assert.equal(gradeOf(80), 2);
assert.equal(gradeOf(60), 3);
assert.equal(gradeOf(40), 4);
assert.equal(gradeOf(39.99), 5);
assert.equal(memberScore([100]), 0);
assert.equal(dpValue(5, null), null);
assert.equal(dpValue(5, ""), null);

const baseParts = [
  { part: "下部结构", name: "桥墩", weight: 1, member_count: 1, defects: [] },
  { part: "桥面系", name: "桥面铺装", weight: 1, member_count: 1, defects: [] },
];
const sameIndicator = assess({ components: [
  { id: 1, part: "上部结构", name: "主梁", weight: 1, is_major: true, member_count: 1, defects: [
    { member_label: "1", defect_type: "裂缝", scale: 2, dp: 35 },
    { member_label: "1", defect_type: "裂缝", scale: 3, dp: 45 },
  ] }, ...baseParts
] });
assert.deepEqual(sameIndicator.componentScores[0].memberScores, [55]);

// 主要部件最差构件控制的判定对象是初算 P_ci，而不是 P_mci,min。
const lowMemberButPciAbove40 = assess({ components: [
  { id: 2, part: "上部结构", name: "主梁", weight: 1, is_major: true, member_count: 10, defects: [
    { member_label: "1", defect_type: "裂缝", scale: 5, dp: 100 },
  ] }, ...baseParts,
] });
const above40Comp = lowMemberButPciAbove40.componentScores[0];
assert.equal(above40Comp.min, 0);
assert.ok(above40Comp.raw >= 40);
assert.equal(above40Comp.controlled, false);
assert.equal(above40Comp.score, above40Comp.raw);

const pciBelow40 = assess({ components: [
  { id: 3, part: "上部结构", name: "主梁", weight: 1, is_major: true, member_count: 2, defects: [
    { member_label: "1", defect_type: "裂缝", scale: 5, dp: 100 },
    { member_label: "2", defect_type: "破损", scale: 4, dp: 50 },
  ] }, ...baseParts,
] });
const below40Comp = pciBelow40.componentScores[0];
assert.ok(below40Comp.raw < 40);
assert.equal(below40Comp.controlled, true);
assert.equal(below40Comp.score, below40Comp.min);

const fiveClass = assess({ five_class: [{ id: 1, hit: true }], components: [] });
assert.equal(fiveClass.grade, 5);
assert.equal(fiveClass.fiveClassHit, true);

const empty = assess({ components: [] });
assert.equal(empty.validation.valid, false);

console.log("JTG/T H21-2011 assessment tests passed");
