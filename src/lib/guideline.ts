/**
 * 核心医学逻辑
 * 依据：《中国血脂管理指南（2023年）》（中华心血管病杂志 2023年3月第51卷第3期）
 *      《中国血脂管理指南（基层版2024年）》
 *
 * 危险分层与目标值均按指南原文（图1、表7、表15、表20）实现。
 */

export type Sex = 'male' | 'female';
export type RiskCategory = 'low' | 'moderate' | 'high' | 'veryHigh' | 'ultraHigh';

export const RISK_LABEL: Record<RiskCategory, string> = {
  low: '低危',
  moderate: '中危',
  high: '高危',
  veryHigh: '极高危',
  ultraHigh: '超高危',
};

/** 严重 ASCVD 事件（指南图1） */
export interface SevereEventInput {
  /** ① 近期 ACS 病史（<1年） */
  recentACS: boolean;
  /** ② 既往心肌梗死病史（除上述 ACS 以外） */
  priorMI: boolean;
  /** ③ 缺血性脑卒中史 */
  ischemicStroke: boolean;
  /** ④ 有症状的周围血管病变，既往接受过血运重建或截肢 */
  symptomaticPAD: boolean;
}

/** 高危险因素（指南图1）：以下 3 项手动勾选，其余由基本信息及血脂自动带入 */
export interface HighRiskFactorInput {
  /** ① LDL-C≤1.8 mmol/L、再次发生严重的 ASCVD 事件 */
  ldlUnder18ReEvent: boolean;
  /** ② 早发冠心病（男<55岁、女<65岁） */
  prematureCHD: boolean;
  /** ④ 既往有 CABG 或 PCI 治疗史 */
  cabgPci: boolean;
}

/** 家族性高胆固醇血症 ASCVD 状态（表20） */
export type FhAscvdState = 'none' | 'subclinical' | 'clinical';

export interface PatientState {
  // ---------- 基本信息 ----------
  age: string;
  sex: Sex | '';
  smoking: boolean;
  hypertension: boolean;
  diabetes: boolean;
  diabetesType: 't1' | 't2' | '';
  /** 1型糖尿病病程≥20年 */
  t1Duration20: boolean;
  /** 20~39岁糖尿病的主要危险因素（高血压、吸烟自动带入） */
  dmRiskFactors: {
    dyslipidemia: boolean;
    obesity: boolean;
    familyHistory: boolean;
  };
  /** 糖尿病靶器官损害（蛋白尿、肾功能损害、左心室肥厚、视网膜病变） */
  targetOrganDamage: boolean;
  /** CKD 3~4 期 */
  ckd34: boolean;

  // ---------- 家族性高胆固醇血症 ----------
  fh: boolean;
  fhAscvd: FhAscvdState | '';

  // ---------- ASCVD 二级预防 ----------
  ascvd: boolean;
  severe: SevereEventInput;
  /** 经病史确认至少两次独立的严重事件，包括同类事件复发；同一次 ACS/MI 不重复计数。 */
  recurrentSevereEvents?: boolean;
  highRisk: HighRiskFactorInput;

  // ---------- 血脂水平（mmol/L） ----------
  lipids: {
    ldlc: string;
    tc: string;
    hdlc: string;
  };
  /** 未检测 HDL-C 时手动勾选“低 HDL-C（<1.0 mmol/L）” */
  lowHDLManual: boolean;

  // ---------- 余生风险（中危且<55岁） ----------
  lifetime: {
    /** 收缩压≥160 mmHg 或舒张压≥100 mmHg */
    bpHigh: boolean;
    /** 非 HDL-C≥5.2 mmol/L（可由 TC-HDL-C 自动判断） */
    nonHdlHigh: boolean;
    /** BMI≥28 kg/m² */
    bmi28: boolean;
  };

  /** 中危合并多个风险增强因素时，临床医师判断按高危处理 */
  riskEnhancerUpgrade: boolean;
}

export interface TargetInfo {
  /** 绝对目标值（mmol/L）；null 表示暂无法确定 */
  ldl: number | null;
  /** 是否同时要求较基线降低幅度 >50% */
  reduction50: boolean;
  /** 目标来源说明 */
  source: string;
  /** 推荐类别 / 证据等级 */
  recClass: string;
  evidence: string;
  /** 表格中原样的目标描述 */
  display: string;
}

export interface Assessment {
  category: RiskCategory | null;
  categoryLabel: string;
  /** 用于展示的补充标签，如“合并糖尿病”“合并 FH” */
  chips: string[];
  target: TargetInfo | null;
  nonHdl: number | null;
  /** 由 TC - HDL-C 计算的非 HDL-C */
  calcNonHdl: number | null;
  reasons: string[];
  missing: string[];
  advice: string[];
  monitoring: string[];
  notes: string[];
  /** 糖尿病相关附加说明 */
  diabetesNote: string | null;
  /** FH 特殊目标（表20） */
  fhTarget: { ldl: number; label: string } | null;
}

export const MMOLL_TO_MGDL = 38.67;

export function toMgDl(mmol: number): number {
  return Math.round(mmol * MMOLL_TO_MGDL);
}

export function parseNum(s: string): number | null {
  if (!s || !s.trim()) return null;
  const v = Number(s.trim());
  return Number.isFinite(v) ? v : null;
}

export function fmt(v: number, digits = 2): string {
  return v.toFixed(digits).replace(/\.?0+$/, '');
}

/** 非 HDL-C = TC - HDL-C */
export function nonHdlValue(ldlState: PatientState): number | null {
  const tc = parseNum(ldlState.lipids.tc);
  const hdlc = parseNum(ldlState.lipids.hdlc);
  if (tc === null || hdlc === null) return null;
  if (tc <= 0 || hdlc <= 0) return null;
  const v = Math.round((tc - hdlc) * 1e10) / 1e10;
  return v > 0 ? v : null;
}

type TableCell = RiskCategory;

/** 10 年风险表的胆固醇分层文案（图1） */
const COL_LABEL = [
  '3.1≤TC<4.1 或 1.8≤LDL-C<2.6',
  '4.1≤TC<5.2 或 2.6≤LDL-C<3.4',
  '5.2≤TC<7.2 或 3.4≤LDL-C<4.9',
];

/** 10 年 ASCVD 发病风险 21 组合表（指南图1，基层版2024 表1 同） */
export function lookupTenYearRisk(
  hypertension: boolean,
  riskFactorCount: number,
  column: 0 | 1 | 2,
): TableCell {
  const rf = Math.min(Math.max(riskFactorCount, 0), 3);
  if (!hypertension) {
    if (rf <= 1) return 'low';
    if (rf === 2) return column === 2 ? 'moderate' : 'low';
    return column === 0 ? 'low' : 'moderate';
  }
  if (rf === 0) return 'low';
  if (rf === 1) return column === 0 ? 'low' : 'moderate';
  if (rf === 2) return column === 0 ? 'moderate' : 'high';
  return 'high';
}

/** 血清胆固醇水平分层列（0: 1.8≤LDL-C<2.6 或 3.1≤TC<4.1；1: 2.6≤LDL-C<3.4 或 4.1≤TC<5.2；2: 3.4≤LDL-C<4.9 或 5.2≤TC<7.2） */
export function cholesterolColumn(ldlc: number | null, tc: number | null): 0 | 1 | 2 | null {
  if (ldlc !== null) {
    if (ldlc >= 4.9) return null; // 直接高危
    if (ldlc >= 3.4) return 2;
    if (ldlc >= 2.6) return 1;
    if (ldlc >= 1.8) return 0;
    return null; // 低于图1覆盖范围，不外推为第一列
  }
  if (tc !== null) {
    if (tc >= 7.2) return null;
    if (tc >= 5.2) return 2;
    if (tc >= 4.1) return 1;
    if (tc >= 3.1) return 0;
    return null;
  }
  return null;
}

export function assess(s: PatientState): Assessment {
  // FH 的“伴临床 ASCVD”与二级预防是同一事实，避免两个入口产生矛盾。
  s = { ...s, ascvd: s.ascvd || (s.fh && s.fhAscvd === 'clinical') };
  const age = parseNum(s.age);
  const ldlc = parseNum(s.lipids.ldlc);
  const tc = parseNum(s.lipids.tc);
  const hdlc = parseNum(s.lipids.hdlc);
  const nonHdlCalc = nonHdlValue(s);
  const lowHDL = hdlc !== null ? hdlc < 1.0 : s.lowHDLManual;

  const reasons: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];
  const chips: string[] = [];

  if (s.age.trim() && (age === null || !Number.isInteger(age) || age < 18 || age > 120)) {
    missing.push('本工具适用于成人，请填写 18~120 岁的整数年龄；儿童青少年需采用专门评估');
  }
  for (const [key, label] of [['ldlc', 'LDL-C'], ['tc', 'TC'], ['hdlc', 'HDL-C']] as const) {
    const value = parseNum(s.lipids[key]);
    if (s.lipids[key].trim() && (value === null || value <= 0)) missing.push(`${label} 必须为有效的正数`);
  }
  if (tc !== null && hdlc !== null && tc <= hdlc) missing.push('TC 必须大于 HDL-C，请核对化验结果');
  if (tc !== null && ldlc !== null && ldlc > tc) missing.push('LDL-C 不应大于 TC，请核对化验结果');
  if (s.fh && age === null) missing.push('请填写年龄，以确认成人 FH 目标的适用范围');

  let category: RiskCategory | null = null;
  let diabetesNote: string | null = null;

  // 危险因素（图1 脚注）：吸烟、低 HDL-C、年龄≥45/55岁（男性/女性）
  const ageRisk = age !== null && (s.sex === 'male' ? age >= 45 : s.sex === 'female' ? age >= 55 : false);
  const riskFactorCount = (s.smoking ? 1 : 0) + (lowHDL ? 1 : 0) + (ageRisk ? 1 : 0);

  // ---------------- 糖尿病高危判定（表15 及特殊人群章节） ----------------
  let diabetesHighRisk = false;
  let diabetesLowModRisk = false;
  if (s.diabetes) {
    if (age !== null && age >= 40) {
      diabetesHighRisk = true;
      diabetesNote = '年龄≥40岁的糖尿病患者直接列为 ASCVD 高危人群。';
    } else if (s.diabetesType === 't1' && s.t1Duration20) {
      diabetesHighRisk = true;
      diabetesNote = '1型糖尿病病程≥20年，可作为 ASCVD 高危。';
    } else if (age !== null && age >= 20 && age < 40) {
      const dmRfCount = [
        s.hypertension,
        s.dmRiskFactors.dyslipidemia,
        s.smoking,
        s.dmRiskFactors.obesity,
        s.dmRiskFactors.familyHistory,
      ].filter(Boolean).length;
      if (dmRfCount >= 3) {
        diabetesHighRisk = true;
        diabetesNote = `20~39岁糖尿病合并 ${dmRfCount} 个主要危险因素（≥3个），视为 ASCVD 高危。`;
      } else if (s.targetOrganDamage) {
        diabetesHighRisk = true;
        diabetesNote = '糖尿病合并靶器官损害（蛋白尿/肾功能损害/左心室肥厚/视网膜病变），视为 ASCVD 高危。';
      } else {
        diabetesLowModRisk = true;
        diabetesNote = '20~39岁糖尿病，未达高危标准，按 ASCVD 中/低危管理。';
      }
    } else {
      missing.push('请填写年龄，以完成糖尿病危险分层');
    }
  }

  // ---------------- FH 特殊目标（表20，成人） ----------------
  let fhTarget: { ldl: number; label: string } | null = null;
  if (s.fh) {
    if (s.fhAscvd === 'clinical') {
      fhTarget = { ldl: 1.4, label: '成人 FH 伴临床 ASCVD' };
    } else if (s.fhAscvd === 'subclinical') {
      fhTarget = { ldl: 1.8, label: '成人 FH 伴亚临床 ASCVD' };
    } else if (s.fhAscvd === 'none') {
      fhTarget = { ldl: 2.6, label: '成人 FH 不伴 ASCVD' };
    } else {
      missing.push('请选择 FH 患者的 ASCVD 状态（表20）');
    }
    chips.push('家族性高胆固醇血症');
    notes.push('FH 患者按表20单独设定目标，最终以更严格的目标为准。');
  }

  // ---------------- 二级预防 ----------------
  if (s.ascvd) {
    const severeTypes = [
      s.severe.recentACS,
      s.severe.priorMI,
      s.severe.ischemicStroke,
      s.severe.symptomaticPAD,
    ].filter(Boolean).length;
    const severeCount = s.recurrentSevereEvents ? Math.max(2, severeTypes) : severeTypes;

    const highRiskCount = [
      s.highRisk.ldlUnder18ReEvent,
      s.highRisk.prematureCHD,
      s.highRisk.cabgPci,
      s.fh || (ldlc !== null && ldlc >= 4.9), // 家族性高胆固醇血症或基线 LDL-C≥4.9
      s.diabetes,
      s.hypertension,
      s.ckd34,
      s.smoking,
    ].filter(Boolean).length;

    if (severeCount >= 2) {
      category = 'ultraHigh';
      reasons.push('已确诊 ASCVD，病史确认发生过至少 2 次独立的严重 ASCVD 事件 → 超高危');
    } else if (severeCount === 1 && highRiskCount >= 2) {
      category = 'ultraHigh';
      reasons.push(`已确诊 ASCVD，发生过 1 次严重 ASCVD 事件，且合并 ${highRiskCount} 个高危险因素（≥2个）→ 超高危`);
    } else {
      category = 'veryHigh';
      reasons.push('已确诊 ASCVD，不符合超高危标准 → 极高危');
      if (severeCount === 1) reasons.push(`严重 ASCVD 事件 1 次、高危险因素 ${highRiskCount} 个（需同时满足 ≥2 个高危险因素方为超高危）`);
      if (severeCount === 0) reasons.push('未勾选严重 ASCVD 事件');
    }
    if (s.diabetes) chips.push('合并糖尿病');
    notes.push('严重 ASCVD 事件与高危险因素水平均为干预前水平。');
  } else {
    // ---------------- 一级预防 ----------------
    const directHigh: string[] = [];
    if (ldlc !== null && ldlc >= 4.9) directHigh.push(`LDL-C ${fmt(ldlc)} mmol/L ≥ 4.9 mmol/L`);
    if (tc !== null && tc >= 7.2) directHigh.push(`TC ${fmt(tc)} mmol/L ≥ 7.2 mmol/L`);
    if (s.diabetes && age !== null && age >= 40) directHigh.push('年龄≥40岁的糖尿病患者');
    if (s.ckd34) directHigh.push('CKD 3~4 期');

    if (directHigh.length > 0) {
      category = 'high';
      reasons.push(`符合直接列为高危的条件：${directHigh.join('；')}（无需进行10年风险评估）`);
      if (s.diabetes && age !== null && age >= 40) chips.push('糖尿病（高危）');
    } else if (s.diabetes && diabetesHighRisk && age !== null && age < 40) {
      category = 'high';
      reasons.push('20~39岁糖尿病患者，符合高危标准（≥3个危险因素或合并靶器官损害/1型病程≥20年）');
      chips.push('糖尿病（高危）');
    } else {
      const col = cholesterolColumn(ldlc, tc);
      if (col === null) {
        missing.push(ldlc !== null || tc !== null
          ? '基线血脂低于图1的分层范围（LDL-C≥1.8 或 TC≥3.1），需临床评估，不自动外推分层'
          : '请填写基线 LDL-C 或 TC，以评估10年 ASCVD 发病风险');
      } else {
        if (age === null || s.sex === '') {
          missing.push('请填写年龄与性别，以准确统计危险因素个数');
        }
        const risk = lookupTenYearRisk(s.hypertension, riskFactorCount, col);
        category = risk;
        const rfParts = [
          s.smoking ? '吸烟' : null,
          lowHDL ? '低 HDL-C' : null,
          ageRisk ? '年龄（男≥45/女≥55岁）' : null,
        ].filter(Boolean) as string[];
        reasons.push(
          `10年 ASCVD 发病风险组合：${s.hypertension ? '有高血压' : '无高血压'}，其他危险因素 ${riskFactorCount} 个${rfParts.length ? `（${rfParts.join('、')}）` : ''}，胆固醇分层：第 ${col + 1} 层（${COL_LABEL[col]}） → ${RISK_LABEL[risk]}`,
        );

        // LDL-C 与 TC 分层不一致提示（指南正文按 LDL-C 分层，TC 为备选）
        if (ldlc !== null && tc !== null) {
          const ldlCol = cholesterolColumn(ldlc, null);
          const tcCol = cholesterolColumn(null, tc);
          if (ldlCol !== null && tcCol !== null && ldlCol !== tcCol) {
            notes.push(
              `注意：以 LDL-C 分层为第 ${ldlCol + 1} 层，以 TC 分层为第 ${tcCol + 1} 层，两者不一致。本工具按指南正文以 LDL-C 为准；建议核对基线化验结果，并结合风险增强因素（表2）与临床情况综合判断。`,
            );
          }
        }

        // 中危且<55岁 → 余生风险
        if (risk === 'moderate' && age !== null && age < 55) {
          const lifeFactors = [
            s.lifetime.bpHigh ? '收缩压≥160 mmHg或舒张压≥100 mmHg' : null,
            nonHdlCalc !== null ? (nonHdlCalc >= 5.2 ? `非 HDL-C ${fmt(nonHdlCalc)} mmol/L（≥5.2）` : null) : s.lifetime.nonHdlHigh ? '非 HDL-C≥5.2 mmol/L' : null,
            lowHDL ? 'HDL-C<1.0 mmol/L' : null,
            s.lifetime.bmi28 ? 'BMI≥28 kg/m²' : null,
            s.smoking ? '吸烟' : null,
          ].filter(Boolean) as string[];
          if (lifeFactors.length >= 2) {
            category = 'high';
            reasons.push(`10年风险中危且年龄<55岁，余生风险危险因素 ${lifeFactors.length} 项（≥2项）→ 余生风险高危：${lifeFactors.join('；')}`);
          } else {
            reasons.push(`10年风险中危且年龄<55岁，余生风险危险因素 ${lifeFactors.length} 项（<2项）`);
          }
        } else if (risk === 'moderate' && age !== null && age >= 55) {
          reasons.push('年龄≥55岁，无需进一步评估余生风险');
        } else if (risk === 'moderate') {
          missing.push('请填写年龄，以判断是否需评估余生风险（<55岁）');
        }

        if (category === 'moderate') {
          if (s.riskEnhancerUpgrade) {
            category = 'high';
            reasons.push('结合 ASCVD 风险增强因素，临床判断按高危处理（指南：合并多个风险增强因素时更倾向按高危处理）');
          } else {
            notes.push('中危人群可结合 ASCVD 风险增强因素（表2）决定干预措施；合并多个风险增强因素时更倾向按高危处理。');
          }
        }
      }
    }
    if (s.diabetes && diabetesHighRisk && !(age !== null && age >= 40)) chips.push('糖尿病（高危）');
    else if (s.diabetes && diabetesLowModRisk) chips.push('糖尿病');
  }

  // ---------------- 目标值（表7 / 表15 / 表20） ----------------
  let target: TargetInfo | null = null;

  const diabetesWithAscvd = s.diabetes && s.ascvd;

  if (diabetesWithAscvd) {
    target = {
      ldl: 1.4,
      reduction50: true,
      source: '表15：糖尿病合并 ASCVD；表7：超（极）高危降幅',
      recClass: 'I',
      evidence: 'A',
      display: 'LDL-C <1.4 mmol/L 且较基线降低幅度 >50%（糖尿病合并 ASCVD）',
    };
    notes.push('糖尿病合并 ASCVD 按表15取绝对目标，同时保留表7超（极）高危的降幅要求；不因特殊人群目标而取消降幅。');
  } else if (s.diabetes && (category === 'high' || diabetesHighRisk)) {
    target = {
      ldl: 1.8,
      reduction50: false,
      source: '表15：ASCVD 风险为高危的糖尿病患者',
      recClass: 'I',
      evidence: 'A',
      display: 'LDL-C <1.8 mmol/L（糖尿病高危）',
    };
  } else if (s.diabetes && (category === 'low' || category === 'moderate')) {
    target = {
      ldl: 2.6,
      reduction50: false,
      source: '表15：ASCVD 风险为低、中危的糖尿病患者',
      recClass: 'IIa',
      evidence: 'C',
      display: 'LDL-C <2.6 mmol/L（糖尿病低/中危）',
    };
  } else if (category === 'ultraHigh') {
    target = {
      ldl: 1.4,
      reduction50: true,
      source: '表7：超高危',
      recClass: 'I',
      evidence: 'A',
      display: 'LDL-C <1.4 mmol/L 且较基线降低幅度 >50%',
    };
  } else if (category === 'veryHigh') {
    target = {
      ldl: 1.8,
      reduction50: true,
      source: '表7：极高危',
      recClass: 'I',
      evidence: 'A',
      display: 'LDL-C <1.8 mmol/L 且较基线降低幅度 >50%',
    };
  } else if (category === 'high') {
    target = {
      ldl: 2.6,
      reduction50: false,
      source: '表7：中、高危',
      recClass: 'I',
      evidence: 'A',
      display: 'LDL-C <2.6 mmol/L',
    };
  } else if (category === 'moderate') {
    target = {
      ldl: 2.6,
      reduction50: false,
      source: '表7：中、高危',
      recClass: 'I',
      evidence: 'A',
      display: 'LDL-C <2.6 mmol/L',
    };
  } else if (category === 'low') {
    target = {
      ldl: 3.4,
      reduction50: false,
      source: '表7：低危',
      recClass: 'IIa',
      evidence: 'B',
      display: 'LDL-C <3.4 mmol/L',
    };
  }

  // FH 目标与流程图目标取更严格者
  if (fhTarget && (!target || target.ldl === null)) {
    target = {
      ldl: fhTarget.ldl,
      reduction50: false,
      source: `表20：${fhTarget.label}`,
      recClass: 'IIa',
      evidence: 'B',
      display: `LDL-C <${fhTarget.ldl} mmol/L（${fhTarget.label}）`,
    };
  } else if (fhTarget && target && target.ldl !== null && fhTarget.ldl < target.ldl) {
    notes.push(`FH 特殊目标（${fhTarget.label}：<${fhTarget.ldl} mmol/L）比风险分层目标更严格，建议按 FH 目标执行。`);
    target = {
      ldl: fhTarget.ldl,
      reduction50: target.reduction50,
      source: `${target.source}；表20：${fhTarget.label}`,
      recClass: 'IIa',
      evidence: 'B',
      display: `LDL-C <${fhTarget.ldl} mmol/L${target.reduction50 ? ' 且较基线降低幅度 >50%' : ''}（${fhTarget.label}）`,
    };
  }

  const nonHdl = target && target.ldl !== null ? Math.round((target.ldl + 0.8) * 10) / 10 : null;

  if (s.diabetes && !s.ascvd) {
    notes.push('糖尿病患者推荐 LDL-C 与非 HDL-C 同时作为降脂目标（非 HDL-C 目标 = LDL-C 目标 + 0.8 mmol/L）。');
  }

  // ---------------- 建议 ----------------
  const advice: string[] = [];
  advice.push('生活方式干预是降脂治疗的基础：合理膳食（限制饱和脂肪酸与反式脂肪，增加蔬菜水果、全谷物、膳食纤维及鱼类摄入）、适度增加身体活动、控制体重、戒烟、限制饮酒。');
  if (category === 'low') {
    advice.push('以生活方式干预为主；若 LDL-C ≥3.4 mmol/L，可考虑中等强度他汀类药物治疗（IIa/B）。');
    advice.push('生活方式干预 3~6 个月后复查血脂，未达标者考虑启动药物治疗。');
  } else if (category === 'moderate') {
    advice.push('在生活方式干预基础上，结合风险增强因素与患者意愿决定是否启动他汀类药物治疗。');
    advice.push('若 10 年风险接近 10% 或合并多个风险增强因素，倾向按高危处理。');
  } else if (category === 'high' || category === 'veryHigh' || category === 'ultraHigh') {
    advice.push('推荐中等强度他汀类药物作为起始治疗（如阿托伐他汀 10~20 mg、瑞舒伐他汀 5~10 mg 等，表12）。');
    advice.push('他汀治疗 LDL-C 不达标者，联合胆固醇吸收抑制剂（依折麦布）。');
    advice.push('他汀联合依折麦布仍不达标者，联合 PCSK9 抑制剂。');
    if (diabetesWithAscvd || category === 'ultraHigh') {
      advice.push('基线 LDL-C 较高（未服用他汀者 LDL-C≥4.9 mmol/L，或服用他汀者 LDL-C≥2.6 mmol/L）时，可直接启动他汀联合 PCSK9 抑制剂治疗。');
    }
    if (category === 'veryHigh' || category === 'ultraHigh' || diabetesWithAscvd) {
      advice.push('降脂目标需同时关注绝对值和较基线降低幅度（>50%）。');
    }
  }
  if (s.diabetes && !s.ascvd && (diabetesHighRisk || category === 'high' || category === 'veryHigh')) {
    advice.push('糖尿病高危患者选择他汀类药物作为基础降脂治疗；LDL-C 不达标时联合胆固醇吸收抑制剂或 PCSK9 抑制剂。LDL-C 达标后如 TG 仍高或非 HDL-C 不达标，可考虑联合高纯度 IPE/ω-3 脂肪酸或贝特类药物。');
  }
  if (s.ckd34) {
    advice.push('CKD 患者是他汀相关肌病的高危人群，避免大剂量他汀；估算肾小球滤过率 <30 ml/（min·1.73m²）时更需谨慎，并注意贝特类联合用药的肌病风险。');
  }

  const monitoring: string[] = [
    '首次服用降脂药物：用药 4~6 周内复查血脂、肝酶和肌酸激酶（CK）；达标且无不良反应后，逐步改为每 3~6 个月复查 1 次。',
    '调整降脂药物种类或剂量后，应在治疗 4~6 周内复查。',
    '单纯生活方式干预者：开始 3~6 个月复查血脂；达标后每 6 个月至 1 年复查 1 次。',
  ];

  return {
    category: missing.length ? null : category,
    categoryLabel: missing.length ? '待评估' : category ? RISK_LABEL[category] : '—',
    chips: [...new Set(chips)],
    target: missing.length ? null : target,
    nonHdl: missing.length ? null : nonHdl,
    calcNonHdl: nonHdlCalc,
    reasons: missing.length ? [] : reasons,
    missing,
    advice: missing.length ? [] : advice,
    monitoring,
    notes,
    diabetesNote,
    fhTarget,
  };
}
