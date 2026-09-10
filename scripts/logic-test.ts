// 逻辑自检：覆盖指南各危险分层与目标值场景
import { assess, type PatientState } from '../src/lib/guideline.ts';

const base: PatientState = {
  age: '',
  sex: '',
  smoking: false,
  hypertension: false,
  diabetes: false,
  diabetesType: '',
  t1Duration20: false,
  dmRiskFactors: { dyslipidemia: false, obesity: false, familyHistory: false },
  targetOrganDamage: false,
  ckd34: false,
  fh: false,
  fhAscvd: '',
  ascvd: false,
  severe: { recentACS: false, priorMI: false, ischemicStroke: false, symptomaticPAD: false },
  highRisk: { ldlUnder18ReEvent: false, prematureCHD: false, cabgPci: false },
  lipids: { ldlc: '', tc: '', hdlc: '' },
  lowHDLManual: false,
  lifetime: { bpHigh: false, nonHdlHigh: false, bmi28: false },
  riskEnhancerUpgrade: false,
};

const cases = [
  {
    name: '低危：52岁女性，无高血压，LDL-C 2.5',
    patch: { age: '52', sex: 'female', lipids: { ldlc: '2.5', tc: '4.0', hdlc: '1.3' } },
    expect: { cat: 'low', ldl: 3.4 },
  },
  {
    name: '高危（表）：50岁男性+高血压+吸烟，LDL-C 3.0（有高血压+2因素+中间层 → 高危）',
    patch: {
      age: '50',
      sex: 'male',
      hypertension: true,
      smoking: true,
      lipids: { ldlc: '3.0', tc: '4.8', hdlc: '1.1' },
    },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '高危（直接）：LDL-C 5.2',
    patch: { age: '45', sex: 'male', lipids: { ldlc: '5.2', tc: '7.0', hdlc: '1.2' } },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '高危（直接）：TC 7.5',
    patch: { age: '45', sex: 'male', lipids: { ldlc: '3.0', tc: '7.5', hdlc: '1.2' } },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '高危（表）：50岁男性+高血压+吸烟+低HDL，LDL-C 3.0',
    patch: {
      age: '50',
      sex: 'male',
      hypertension: true,
      smoking: true,
      lipids: { ldlc: '3.0', tc: '5.0', hdlc: '0.9' },
    },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '高危（20-39岁糖尿病≥3危险因素）：35岁糖尿病+高血压+吸烟+肥胖',
    patch: {
      age: '35',
      sex: 'male',
      diabetes: true,
      diabetesType: 't2',
      hypertension: true,
      smoking: true,
      dmRiskFactors: { dyslipidemia: false, obesity: true, familyHistory: false },
      lipids: { ldlc: '2.4', tc: '4.2', hdlc: '1.2' },
    },
    expect: { cat: 'high', ldl: 1.8 },
  },
  {
    name: '糖尿病（低/中危）：30岁糖尿病无危险因素，LDL-C 2.4 → 表15 目标 2.6',
    patch: {
      age: '30',
      sex: 'male',
      diabetes: true,
      diabetesType: 't2',
      lipids: { ldlc: '2.4', tc: '4.0', hdlc: '1.4' },
    },
    expect: { cat: 'low', ldl: 2.6 },
  },
  {
    name: '糖尿病（<40岁，LDL-C≥4.9 直接高危）：30岁糖尿病，LDL-C 5.2 → 表15 高危 1.8',
    patch: {
      age: '30',
      sex: 'male',
      diabetes: true,
      diabetesType: 't2',
      lipids: { ldlc: '5.2', tc: '7.0', hdlc: '1.3' },
    },
    expect: { cat: 'high', ldl: 1.8 },
  },
  {
    name: '糖尿病（≥40岁高危）：55岁糖尿病，LDL-C 3.2',
    patch: {
      age: '55',
      sex: 'female',
      diabetes: true,
      diabetesType: 't2',
      lipids: { ldlc: '3.2', tc: '5.6', hdlc: '1.2' },
    },
    expect: { cat: 'high', ldl: 1.8 },
  },
  {
    name: '极高危：ASCVD，1次严重事件，0高危险因素',
    patch: {
      age: '60',
      sex: 'male',
      ascvd: true,
      severe: { recentACS: true, priorMI: false, ischemicStroke: false, symptomaticPAD: false },
      lipids: { ldlc: '3.5', tc: '5.6', hdlc: '1.1' },
    },
    expect: { cat: 'veryHigh', ldl: 1.8, reduction50: true },
  },
  {
    name: '超高危：ASCVD，2次严重事件',
    patch: {
      age: '60',
      sex: 'male',
      ascvd: true,
      severe: { recentACS: true, priorMI: true, ischemicStroke: false, symptomaticPAD: false },
      lipids: { ldlc: '3.5', tc: '5.6', hdlc: '1.1' },
    },
    expect: { cat: 'ultraHigh', ldl: 1.4, reduction50: true },
  },
  {
    name: '超高危：ASCVD，1次事件 + 糖尿病 + 高血压',
    patch: {
      age: '60',
      sex: 'male',
      ascvd: true,
      diabetes: true,
      diabetesType: 't2',
      hypertension: true,
      severe: { recentACS: true, priorMI: false, ischemicStroke: false, symptomaticPAD: false },
      lipids: { ldlc: '3.5', tc: '5.6', hdlc: '1.1' },
    },
    expect: { cat: 'ultraHigh', ldl: 1.4, reduction50: false }, // 糖尿病合并ASCVD → 表15 1.4
  },
  {
    name: '极高危+糖尿病：ASCVD 1次事件 0 因素 + 糖尿病 → 表15 目标 1.4',
    patch: {
      age: '60',
      sex: 'male',
      ascvd: true,
      diabetes: true,
      diabetesType: 't2',
      severe: { recentACS: true, priorMI: false, ischemicStroke: false, symptomaticPAD: false },
      lipids: { ldlc: '3.5', tc: '5.6', hdlc: '1.1' },
    },
    expect: { cat: 'veryHigh', ldl: 1.4 },
  },
  {
    name: 'FH 不伴ASCVD：目标 2.6',
    patch: {
      age: '30',
      sex: 'male',
      fh: true,
      fhAscvd: 'none',
      lipids: { ldlc: '6.0', tc: '8.5', hdlc: '1.0' },
    },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: 'FH 伴亚临床ASCVD：目标 1.8',
    patch: {
      age: '40',
      sex: 'male',
      fh: true,
      fhAscvd: 'subclinical',
      lipids: { ldlc: '4.5', tc: '6.5', hdlc: '1.0' },
    },
    expect: { ldl: 1.8 },
  },
  {
    name: '余生风险：50岁男性，高血压+2危险因素(吸烟+低HDL)，LDL-C 3.0 → 中危→余生高危(≥2项)',
    patch: {
      age: '50',
      sex: 'male',
      hypertension: true,
      smoking: true,
      lipids: { ldlc: '3.0', tc: '4.9', hdlc: '0.9' },
      lifetime: { bpHigh: true, nonHdlHigh: false, bmi28: false },
    },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '边界：LDL-C=4.9（恰好）→ 直接高危',
    patch: { age: '50', sex: 'female', lipids: { ldlc: '4.9', tc: '6.8', hdlc: '1.3' } },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '边界：LDL-C=4.8（未达直接高危）→ 按21组合表（无高血压+0因素+第3层）低危',
    patch: { age: '50', sex: 'female', lipids: { ldlc: '4.8', tc: '6.7', hdlc: '1.3' } },
    expect: { cat: 'low', ldl: 3.4 },
  },
  {
    name: '边界：糖尿病恰好40岁 → 直接高危，目标1.8',
    patch: { age: '40', sex: 'male', diabetes: true, diabetesType: 't2', lipids: { ldlc: '2.5', tc: '4.2', hdlc: '1.3' } },
    expect: { cat: 'high', ldl: 1.8 },
  },
  {
    name: '边界：糖尿病39岁无其他因素 → 非直接高危（21组合表低危），目标2.6',
    patch: { age: '39', sex: 'male', diabetes: true, diabetesType: 't2', lipids: { ldlc: '2.5', tc: '4.2', hdlc: '1.3' } },
    expect: { cat: 'low', ldl: 2.6 },
  },
  {
    name: '边界：余生风险非HDL-C恰好5.2（TC6.4-HDL1.2）计为1项，合并收缩压高 → 高危',
    patch: {
      age: '52',
      sex: 'female',
      hypertension: true,
      smoking: true,
      lipids: { ldlc: '3.0', tc: '6.4', hdlc: '1.2' },
      lifetime: { bpHigh: true, nonHdlHigh: false, bmi28: false },
    },
    expect: { cat: 'high', ldl: 2.6 },
  },
  {
    name: '边界：有高血压+0因素+第3层胆固醇（LDL3.8）→ 按图1为低危（不进入余生评估）',
    patch: {
      age: '52',
      sex: 'female',
      hypertension: true,
      lipids: { ldlc: '3.8', tc: '6.4', hdlc: '1.2' },
      lifetime: { bpHigh: true, nonHdlHigh: false, bmi28: false },
    },
    expect: { cat: 'low', ldl: 3.4 },
  },
  {
    name: '【用户病例】40岁男性+高血压，LDL-C 2.58 / TC 4.58 / HDL-C 0.9 → 按 LDL-C 第1层为低危，且提示 LDL/TC 分层不一致',
    patch: {
      age: '40',
      sex: 'male',
      hypertension: true,
      lipids: { ldlc: '2.58', tc: '4.58', hdlc: '0.9' },
    },
    expect: { cat: 'low', ldl: 3.4, expectNote: '分层为第 1 层' },
  },
  {
    name: '【用户病例变体】同上但未提供 LDL-C（按 TC 4.58 第2层）→ 中危，目标2.6',
    patch: {
      age: '40',
      sex: 'male',
      hypertension: true,
      lipids: { ldlc: '', tc: '4.58', hdlc: '0.9' },
    },
    expect: { cat: 'moderate', ldl: 2.6 },
  },
  {
    name: '【用户病例变体】同上+吸烟（危险因素2个→中危，余生风险2项（低HDL-C+吸烟）→高危）',
    patch: {
      age: '40',
      sex: 'male',
      hypertension: true,
      smoking: true,
      lipids: { ldlc: '2.58', tc: '4.58', hdlc: '0.9' },
    },
    expect: { cat: 'high', ldl: 2.6 },
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const s: PatientState = { ...base, ...c.patch, severe: { ...base.severe, ...(c.patch.severe ?? {}) }, highRisk: { ...base.highRisk, ...(c.patch.highRisk ?? {}) }, dmRiskFactors: { ...base.dmRiskFactors, ...(c.patch.dmRiskFactors ?? {}) }, lifetime: { ...base.lifetime, ...(c.patch.lifetime ?? {}) }, lipids: { ...base.lipids, ...(c.patch.lipids ?? {}) } };
  const r = assess(s);
  const catOk = c.expect.cat === undefined || r.category === c.expect.cat;
  const ldlOk = c.expect.ldl === undefined || r.target?.ldl === c.expect.ldl;
  const redOk = c.expect.reduction50 === undefined || r.target?.reduction50 === c.expect.reduction50;
  const noteOk = c.expect.expectNote === undefined || r.notes.some((n: string) => n.includes(c.expect.expectNote));
  const ok = catOk && ldlOk && redOk && noteOk;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} | ${c.name}\n      → 分层=${r.categoryLabel}(${r.category}) 目标=${r.target?.ldl ?? '—'} 降幅50%=${r.target?.reduction50 ?? '—'} 非HDL=${r.nonHdl ?? '—'}`,
  );
  if (!ok) {
    console.log(`      !! 期望 cat=${c.expect.cat} ldl=${c.expect.ldl} reduction50=${c.expect.reduction50} note~=${c.expect.expectNote}`);
    console.log(`      !! reasons: ${r.reasons.join(' | ')}`);
    console.log(`      !! notes: ${r.notes.join(' | ')}`);
    console.log(`      !! missing: ${r.missing.join(' | ')}`);
  }
}
console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
