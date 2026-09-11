import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  assess,
  parseNum,
  fmt,
  toMgDl,
  lookupTenYearRisk,
  cholesterolColumn,
  nonHdlValue,
  type PatientState,
  type RiskCategory,
  type Sex,
} from './lib/guideline';

const GITHUB_URL = 'https://github.com/lijiaxiang63/ascvd-lipid-tool';

const initialState: PatientState = {
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

const RISK_STYLE: Record<string, { bg: string; fg: string; grad: string }> = {
  low: { bg: '#e8f7ee', fg: '#15803d', grad: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  moderate: { bg: '#e8f1fe', fg: '#1d4ed8', grad: 'linear-gradient(135deg,#3b82f6,#2563eb)' },
  high: { bg: '#fef3e2', fg: '#b45309', grad: 'linear-gradient(135deg,#f59e0b,#ea580c)' },
  veryHigh: { bg: '#fdeaea', fg: '#b91c1c', grad: 'linear-gradient(135deg,#ef4444,#dc2626)' },
  ultraHigh: { bg: '#f3e8ff', fg: '#7e22ce', grad: 'linear-gradient(135deg,#a855f7,#7c3aed)' },
};

const STEP_META: Record<number, { title: string; short: string; hint: string }> = {
  1: { title: '基本信息与危险因素', short: '基本信息', hint: '数值均为干预前水平；勾选后自动带入风险分层' },
  2: { title: '基线血脂水平', short: '基线血脂', hint: '用于风险分层、目标值换算与降幅计算（mmol/L）' },
  3: { title: 'ASCVD 状态与风险分层', short: '风险分层', hint: '按《中国血脂管理指南（2023年）》图1 流程' },
};

interface Ctx {
  age: number | null;
  ldlc: number | null;
  tc: number | null;
  hdlc: number | null;
  nonHdl: number | null;
  lowHDL: boolean;
  ageRisk: boolean;
  rfCount: number;
  col: 0 | 1 | 2 | null;
  tableRisk: RiskCategory | null;
  directHigh: boolean;
}

function buildCtx(s: PatientState): Ctx {
  const age = parseNum(s.age);
  const ldlc = parseNum(s.lipids.ldlc);
  const tc = parseNum(s.lipids.tc);
  const hdlc = parseNum(s.lipids.hdlc);
  const lowHDL = hdlc !== null ? hdlc < 1.0 : s.lowHDLManual;
  const ageRisk =
    age !== null && (s.sex === 'male' ? age >= 45 : s.sex === 'female' ? age >= 55 : false);
  const rfCount = (s.smoking ? 1 : 0) + (lowHDL ? 1 : 0) + (ageRisk ? 1 : 0);
  const col = cholesterolColumn(ldlc, tc);
  const directHigh =
    (ldlc !== null && ldlc >= 4.9) ||
    (tc !== null && tc >= 7.2) ||
    (s.diabetes && age !== null && age >= 40) ||
    s.ckd34;
  const tableRisk = !s.ascvd && !directHigh && col !== null ? lookupTenYearRisk(s.hypertension, rfCount, col) : null;
  return { age, ldlc, tc, hdlc, nonHdl: nonHdlValue(s), lowHDL, ageRisk, rfCount, col, tableRisk, directHigh };
}

function CheckRow(props: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: React.ReactNode;
  sub?: React.ReactNode;
  auto?: boolean;
  autoText?: string;
}) {
  const { checked, onChange, label, sub, auto, autoText } = props;
  return (
    <label className={`check-row${auto ? ' auto' : ''}${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} disabled={auto} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="check-text">
        <span className="check-label">{label}</span>
        {sub ? <span className="check-sub">{sub}</span> : null}
      </span>
      {auto ? <span className="chip chip-auto">{autoText ?? '自动带入'}</span> : null}
    </label>
  );
}

function NumField(props: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="num-field">
      <span className="field-label">{props.label}</span>
      <span className="input-wrap">
        <input
          type="text"
          inputMode="decimal"
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value.replace(/[^\d.\-]/g, ''))}
        />
        {props.unit ? <span className="unit">{props.unit}</span> : null}
      </span>
      {props.hint ? <span className="field-hint">{props.hint}</span> : null}
    </label>
  );
}

function Seg<T extends string>(props: {
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={props.value === o.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StepBasics({ s, set }: { s: PatientState; set: (p: Partial<PatientState>) => void }) {
  const age = parseNum(s.age);
  return (
    <div className="step-stack">
      <div className="grid-2">
        <NumField label="年龄" value={s.age} onChange={(v) => set({ age: v })} unit="岁" placeholder="如 58" />
        <div className="seg-field">
          <span className="field-label">性别</span>
          <Seg<Sex>
            value={s.sex}
            options={[
              { value: 'male', label: '男' },
              { value: 'female', label: '女' },
            ]}
            onChange={(v) => set({ sex: v })}
          />
          <span className="field-hint">
            危险因素：{s.sex === 'male' ? '男性≥45岁' : s.sex === 'female' ? '女性≥55岁' : '男≥45 / 女≥55岁'}
          </span>
        </div>
      </div>

      <div className="check-list">
        <CheckRow checked={s.smoking} onChange={(v) => set({ smoking: v })} label="吸烟" />
        <CheckRow checked={s.hypertension} onChange={(v) => set({ hypertension: v })} label="高血压" />
        <CheckRow
          checked={s.ckd34}
          onChange={(v) => set({ ckd34: v })}
          label="慢性肾脏病（CKD）3~4 期"
          sub="一级预防中直接列为高危条件之一"
        />
      </div>

      <div className="sub-block">
        <CheckRow
          checked={s.diabetes}
          onChange={(v) => set({ diabetes: v })}
          label="糖尿病"
          sub="≥40岁直接为高危；20~39岁需评估危险因素与靶器官损害"
        />
        {s.diabetes ? (
          <div className="nested">
            <div className="inline-fields">
              <span className="field-label">类型</span>
              <Seg<'t1' | 't2'>
                value={s.diabetesType}
                options={[
                  { value: 't1', label: '1 型' },
                  { value: 't2', label: '2 型' },
                ]}
                onChange={(v) => set({ diabetesType: v })}
              />
            </div>
            {s.diabetesType === 't1' ? (
              <CheckRow checked={s.t1Duration20} onChange={(v) => set({ t1Duration20: v })} label="1型糖尿病病程 ≥20 年" />
            ) : null}
            {age !== null && age < 40 ? (
              <>
                <p className="mini-title">20~39岁糖尿病主要危险因素（高血压、吸烟已自动计入）</p>
                <div className="check-list">
                  <CheckRow
                    checked={s.dmRiskFactors.dyslipidemia}
                    onChange={(v) => set({ dmRiskFactors: { ...s.dmRiskFactors, dyslipidemia: v } })}
                    label="血脂异常"
                  />
                  <CheckRow
                    checked={s.dmRiskFactors.obesity}
                    onChange={(v) => set({ dmRiskFactors: { ...s.dmRiskFactors, obesity: v } })}
                    label="肥胖"
                  />
                  <CheckRow
                    checked={s.dmRiskFactors.familyHistory}
                    onChange={(v) => set({ dmRiskFactors: { ...s.dmRiskFactors, familyHistory: v } })}
                    label="早发冠心病家族史"
                  />
                  <CheckRow
                    checked={s.targetOrganDamage}
                    onChange={(v) => set({ targetOrganDamage: v })}
                    label="合并靶器官损害"
                    sub="蛋白尿、肾功能损害、左心室肥厚或视网膜病变"
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sub-block">
        <CheckRow
          checked={s.fh}
          onChange={(v) => set({ fh: v })}
          label="家族性高胆固醇血症（FH）"
          sub="按表20单独设定目标，最终取更严格者"
        />
        {s.fh ? (
          <div className="nested">
            <div className="inline-fields">
              <span className="field-label">ASCVD 状态</span>
              <Seg<'none' | 'subclinical' | 'clinical'>
                value={s.fhAscvd}
                options={[
                  { value: 'none', label: '不伴 ASCVD' },
                  { value: 'subclinical', label: '伴亚临床 ASCVD' },
                  { value: 'clinical', label: '伴临床 ASCVD' },
                ]}
                onChange={(v) => set({ fhAscvd: v })}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepLipids({ s, set, ctx }: { s: PatientState; set: (p: Partial<PatientState>) => void; ctx: Ctx }) {
  return (
    <div className="step-stack">
      <div className="grid-3">
        <NumField
          label="LDL-C"
          value={s.lipids.ldlc}
          onChange={(v) => set({ lipids: { ...s.lipids, ldlc: v } })}
          unit="mmol/L"
          placeholder="如 3.2"
          hint={ctx.ldlc !== null ? `≈ ${toMgDl(ctx.ldlc)} mg/dL` : undefined}
        />
        <NumField
          label="TC"
          value={s.lipids.tc}
          onChange={(v) => set({ lipids: { ...s.lipids, tc: v } })}
          unit="mmol/L"
          placeholder="如 5.4"
          hint={ctx.tc !== null ? `≈ ${toMgDl(ctx.tc)} mg/dL` : undefined}
        />
        <NumField
          label="HDL-C"
          value={s.lipids.hdlc}
          onChange={(v) => set({ lipids: { ...s.lipids, hdlc: v } })}
          unit="mmol/L"
          placeholder="如 1.1"
          hint={ctx.nonHdl !== null ? `非 HDL-C ≈ ${fmt(ctx.nonHdl)} mmol/L` : undefined}
        />
      </div>

      {ctx.hdlc === null ? (
        <CheckRow
          checked={s.lowHDLManual}
          onChange={(v) => set({ lowHDLManual: v })}
          label="低 HDL-C（<1.0 mmol/L）"
          sub="未检测 HDL-C 时可手动勾选"
        />
      ) : null}

      <div className="info-grid">
        <div className="info-item">
          <span>其他危险因素统计</span>
          <b>{ctx.rfCount} 个</b>
          <small>
            吸烟 {s.smoking ? 1 : 0} · 低HDL-C {ctx.lowHDL ? 1 : 0} · 年龄 {ctx.ageRisk ? 1 : 0}
          </small>
        </div>
        <div className="info-item">
          <span>胆固醇分层（图1）</span>
          <b>{ctx.col !== null ? `第 ${ctx.col + 1} 层` : ctx.ldlc !== null && ctx.ldlc >= 4.9 ? '直接高危' : '待填写'}</b>
          <small>{ctx.col !== null ? ['3.1≤TC<4.1 或 1.8≤LDL-C<2.6', '4.1≤TC<5.2 或 2.6≤LDL-C<3.4', '5.2≤TC<7.2 或 3.4≤LDL-C<4.9'][ctx.col] : ctx.tc !== null && ctx.tc >= 7.2 ? 'TC≥7.2，直接高危' : ''}</small>
        </div>
        <div className="info-item">
          <span>当前非 HDL-C</span>
          <b>{ctx.nonHdl !== null ? `${fmt(ctx.nonHdl)} mmol/L` : '—'}</b>
          <small>TC − HDL-C</small>
        </div>
      </div>
    </div>
  );
}

function StepRisk({ s, set, ctx }: { s: PatientState; set: (p: Partial<PatientState>) => void; ctx: Ctx }) {
  return (
    <div className="step-stack">
      <div className="inline-fields">
        <span className="field-label">是否已确诊 ASCVD（二级预防）</span>
        <Seg<'yes' | 'no'>
          value={s.ascvd ? 'yes' : 'no'}
          options={[
            { value: 'no', label: '否（一级预防）' },
            { value: 'yes', label: '是（二级预防）' },
          ]}
          onChange={(v) => set({ ascvd: v === 'yes' })}
        />
      </div>

      {s.ascvd ? (
        <div className="risk-cards">
          <div className="sub-card">
            <div className="sub-card-head">
              <b>严重 ASCVD 事件</b>
              <span className="count-chip">
                已选 {[s.severe.recentACS, s.severe.priorMI, s.severe.ischemicStroke, s.severe.symptomaticPAD].filter(Boolean).length} 项 / ≥2 项即为超高危
              </span>
            </div>
            <div className="check-list">
              <CheckRow checked={s.severe.recentACS} onChange={(v) => set({ severe: { ...s.severe, recentACS: v } })} label="近期 ACS 病史（<1年）" />
              <CheckRow checked={s.severe.priorMI} onChange={(v) => set({ severe: { ...s.severe, priorMI: v } })} label="既往心肌梗死病史（除上述 ACS 以外）" />
              <CheckRow checked={s.severe.ischemicStroke} onChange={(v) => set({ severe: { ...s.severe, ischemicStroke: v } })} label="缺血性脑卒中史" />
              <CheckRow
                checked={s.severe.symptomaticPAD}
                onChange={(v) => set({ severe: { ...s.severe, symptomaticPAD: v } })}
                label="有症状的周围血管病变（既往接受过血运重建或截肢）"
              />
            </div>
          </div>

          <div className="sub-card">
            <div className="sub-card-head">
              <b>高危险因素</b>
              <span className="count-chip">
                已计{' '}
                {[
                  s.highRisk.ldlUnder18ReEvent,
                  s.highRisk.prematureCHD,
                  s.highRisk.cabgPci,
                  s.fh || (ctx.ldlc !== null && ctx.ldlc >= 4.9),
                  s.diabetes,
                  s.hypertension,
                  s.ckd34,
                  s.smoking,
                ].filter(Boolean).length}{' '}
                项 / 1次事件+≥2项即为超高危
              </span>
            </div>
            <div className="check-list">
              <CheckRow
                checked={s.highRisk.ldlUnder18ReEvent}
                onChange={(v) => set({ highRisk: { ...s.highRisk, ldlUnder18ReEvent: v } })}
                label="LDL-C<1.8 mmol/L、再次发生严重的 ASCVD 事件"
              />
              <CheckRow
                checked={s.highRisk.prematureCHD}
                onChange={(v) => set({ highRisk: { ...s.highRisk, prematureCHD: v } })}
                label="早发冠心病（男<55岁、女<65岁）"
              />
              <CheckRow
                checked={s.highRisk.cabgPci}
                onChange={(v) => set({ highRisk: { ...s.highRisk, cabgPci: v } })}
                label="既往有 CABG 或 PCI 治疗史"
              />
              <CheckRow
                checked={s.fh || (ctx.ldlc !== null && ctx.ldlc >= 4.9)}
                label="家族性高胆固醇血症或基线 LDL-C≥4.9 mmol/L"
                auto
                autoText={s.fh ? 'FH 自动带入' : ctx.ldlc !== null && ctx.ldlc >= 4.9 ? 'LDL-C 自动带入' : '未满足'}
              />
              <CheckRow checked={s.diabetes} label="糖尿病" auto autoText={s.diabetes ? '自动带入' : '未满足'} />
              <CheckRow checked={s.hypertension} label="高血压" auto autoText={s.hypertension ? '自动带入' : '未满足'} />
              <CheckRow checked={s.ckd34} label="CKD 3~4 期" auto autoText={s.ckd34 ? '自动带入' : '未满足'} />
              <CheckRow checked={s.smoking} label="吸烟" auto autoText={s.smoking ? '自动带入' : '未满足'} />
            </div>
          </div>
        </div>
      ) : (
        <div className="risk-cards">
          <div className="sub-card">
            <div className="sub-card-head">
              <b>直接列为高危的条件（无需10年风险评估）</b>
            </div>
            <ul className="cond-list">
              <li className={ctx.ldlc !== null && ctx.ldlc >= 4.9 ? 'ok' : ctx.tc !== null && ctx.tc >= 7.2 ? 'ok' : 'no'}>
                <span className="dot" />
                LDL-C ≥4.9 mmol/L 或 TC ≥7.2 mmol/L
                <span className="cond-val">
                  {ctx.ldlc !== null ? `LDL-C ${fmt(ctx.ldlc)}` : 'LDL-C 未填'}
                  {ctx.tc !== null ? `、TC ${fmt(ctx.tc)}` : ''} mmol/L
                </span>
              </li>
              <li className={s.diabetes && ctx.age !== null && ctx.age >= 40 ? 'ok' : 'no'}>
                <span className="dot" />
                糖尿病患者（年龄≥40岁）
                <span className="cond-val">{s.diabetes ? (ctx.age !== null ? `年龄 ${ctx.age} 岁` : '年龄未填') : '无糖尿病'}</span>
              </li>
              <li className={s.ckd34 ? 'ok' : 'no'}>
                <span className="dot" />
                CKD 3~4 期
                <span className="cond-val">{s.ckd34 ? '符合' : '无'}</span>
              </li>
            </ul>
          </div>

          {!ctx.directHigh ? (
            <div className="sub-card">
              <div className="sub-card-head">
                <b>10 年 ASCVD 发病风险（21 组合）</b>
                {ctx.tableRisk ? (
                  <span className="count-chip" style={{ background: RISK_STYLE[ctx.tableRisk].bg, color: RISK_STYLE[ctx.tableRisk].fg }}>
                    10年风险：{ctx.tableRisk === 'low' ? '低危（<5%）' : ctx.tableRisk === 'moderate' ? '中危（5%~9%）' : '高危（≥10%）'}
                  </span>
                ) : (
                  <span className="count-chip">请在“基线血脂”填写 LDL-C 或 TC</span>
                )}
              </div>
              <p className="hint">按血清胆固醇水平分层 + 有无高血压 + 其他危险因素（吸烟、低 HDL-C、年龄男≥45/女≥55岁）个数组合判定。</p>
            </div>
          ) : (
            <div className="sub-card alert">
              <b>已符合直接高危条件</b>
              <p className="hint">无需进行10年风险评估，按高危人群管理（合并糖尿病者目标值见特殊人群）。</p>
            </div>
          )}

          {ctx.tableRisk === 'moderate' ? (
            <div className="sub-card">
              <div className="sub-card-head">
                <b>余生风险（10年风险中危且年龄 &lt;55 岁）</b>
                <span className="count-chip">≥2 项 → 高危</span>
              </div>
              <div className="check-list">
                <CheckRow
                  checked={s.lifetime.bpHigh}
                  onChange={(v) => set({ lifetime: { ...s.lifetime, bpHigh: v } })}
                  label="收缩压 ≥160 mmHg 或舒张压 ≥100 mmHg"
                />
                <CheckRow
                  checked={ctx.nonHdl !== null ? ctx.nonHdl >= 5.2 : s.lifetime.nonHdlHigh}
                  onChange={(v) => set({ lifetime: { ...s.lifetime, nonHdlHigh: v } })}
                  label="非 HDL-C ≥5.2 mmol/L"
                  auto={ctx.nonHdl !== null}
                  autoText={ctx.nonHdl !== null ? `TC-HDL-C=${fmt(ctx.nonHdl)}` : undefined}
                />
                <CheckRow
                  checked={ctx.lowHDL}
                  label="HDL-C <1.0 mmol/L"
                  auto
                  autoText={ctx.hdlc !== null ? '血脂自动带入' : s.lowHDLManual ? '已手动勾选' : '未勾选'}
                />
                <CheckRow
                  checked={s.lifetime.bmi28}
                  onChange={(v) => set({ lifetime: { ...s.lifetime, bmi28: v } })}
                  label="BMI ≥28 kg/m²"
                />
                <CheckRow checked={s.smoking} label="吸烟" auto autoText="基本信息自动带入" />
              </div>
            </div>
          ) : null}

          {ctx.tableRisk === 'moderate' ? (
            <div className="sub-card">
              <div className="sub-card-head">
                <b>风险增强因素（表2）</b>
              </div>
              <p className="hint">
                靶器官损害（冠脉钙化≥100 AU、颈动脉斑块、踝/臂血压指数&lt;0.9、左心室肥厚）、血清生物标志物（非 HDL-C≥4.9、ApoB≥1.3 g/L、Lp(a)≥500 mg/L、TG≥2.3、hs-CRP≥2.0 mg/L）、肥胖、早发心血管病家族史等。
              </p>
              <CheckRow
                checked={s.riskEnhancerUpgrade}
                onChange={(v) => set({ riskEnhancerUpgrade: v })}
                label="合并多个风险增强因素，临床判断按高危处理"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  const openGithub = () => {
    openUrl(GITHUB_URL).catch(() => {
      window.open(GITHUB_URL, '_blank');
    });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
        <div className="about-head">
          <div className="about-logo" aria-hidden>
            <svg viewBox="0 0 48 48" width="40" height="40">
              <defs>
                <linearGradient id="g-about" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#0ea5e9" />
                  <stop offset="1" stopColor="#0e7490" />
                </linearGradient>
              </defs>
              <path
                d="M24 42S6 30.6 6 18.8C6 11.7 11.4 6.5 18 6.5c3.2 0 6.1 1.4 8 3.8 1.9-2.4 4.8-3.8 8-3.8 6.6 0 12 5.2 12 12.3C46 30.6 24 42 24 42Z"
                fill="url(#g-about)"
                transform="translate(-3 0)"
              />
              <path
                d="M8 24h8l3-6 4 12 3.5-8 2.5 4h11"
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2>个体化血脂控制目标计算器</h2>
            <p className="about-ver">版本 v{__APP_VERSION__}</p>
          </div>
        </div>

        <dl className="about-list">
          <div>
            <dt>作者</dt>
            <dd>lijiaxiang</dd>
          </div>
          <div>
            <dt>单位</dt>
            <dd>Department of General Practice and International Medicine</dd>
          </div>
          <div>
            <dt>技术栈</dt>
            <dd>Tauri 2 · React 19 · TypeScript · Vite</dd>
          </div>
          <div>
            <dt>指南依据</dt>
            <dd>
              《中国血脂管理指南（2023年）》（中华心血管病杂志，2023，51(3)：221-255）
              及《中国血脂管理指南（基层版2024年）》
            </dd>
          </div>
          <div>
            <dt>开源地址</dt>
            <dd>
              <button type="button" className="link" onClick={openGithub}>
                {GITHUB_URL}
              </button>
            </dd>
          </div>
        </dl>

        <p className="about-disclaimer">
          本工具仅供临床参考与学习使用，不作为诊疗依据；具体治疗决策请结合患者个体情况并由专业医师判断。
        </p>

        <div className="modal-foot">
          <button type="button" className="btn primary-dark" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [s, setS] = useState<PatientState>(initialState);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [resultTab, setResultTab] = useState<'basis' | 'advice' | 'monitor'>('basis');

  const set = (patch: Partial<PatientState>) => setS((prev) => ({ ...prev, ...patch }));
  const ctx = useMemo(() => buildCtx(s), [s]);
  const result = useMemo(() => assess(s), [s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAboutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 各步骤待补充信息提示
  const missingSteps = useMemo(() => {
    const steps = new Set<number>();
    for (const m of result.missing) {
      if (/LDL-C|TC|HDL-C/.test(m)) steps.add(2);
      else steps.add(1);
    }
    return steps;
  }, [result.missing]);

  const style = result.category ? RISK_STYLE[result.category] : RISK_STYLE.moderate;

  // 结合基线 LDL-C 的“实际需达到值”
  let effective: { value: number; fromBaseline: boolean } | null = null;
  if (result.target?.ldl != null && ctx.ldlc != null) {
    if (result.target.reduction50) {
      const half = ctx.ldlc / 2;
      if (ctx.ldlc <= result.target.ldl) {
        effective = null; // 基线已达标，无需强制降幅
      } else if (half < result.target.ldl) {
        effective = { value: Math.round(half * 100) / 100, fromBaseline: true };
      } else {
        effective = { value: result.target.ldl, fromBaseline: false };
      }
    } else {
      effective = { value: result.target.ldl, fromBaseline: false };
    }
  }

  const copySummary = () => {
    const lines: string[] = [];
    lines.push('【个体化血脂控制目标】');
    lines.push(`危险分层：${result.categoryLabel}${result.chips.length ? `（${result.chips.join('、')}）` : ''}`);
    if (result.target?.ldl != null) {
      lines.push(`首要目标 LDL-C：${result.target.display}`);
      lines.push(`非 HDL-C 目标：<${fmt(result.target.ldl + 0.8)} mmol/L`);
      if (effective?.fromBaseline) {
        lines.push(`结合基线 LDL-C ${ctx.ldlc} mmol/L，实际需 <${fmt(effective.value)} mmol/L（绝对目标与降幅>50%取更严格者）`);
      }
    }
    if (result.reasons.length) {
      lines.push('分层依据：');
      result.reasons.forEach((r) => lines.push(`  · ${r}`));
    }
    if (result.missing.length) lines.push(`待补充信息：${result.missing.join('；')}`);
    lines.push('（依据《中国血脂管理指南（2023年）》）');
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = lines.join('\n');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="app-shell">
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <div className="brand-icon" aria-hidden>
              <svg viewBox="0 0 48 48" width="34" height="34">
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#0ea5e9" />
                    <stop offset="1" stopColor="#0e7490" />
                  </linearGradient>
                </defs>
                <path
                  d="M24 42S6 30.6 6 18.8C6 11.7 11.4 6.5 18 6.5c3.2 0 6.1 1.4 8 3.8 1.9-2.4 4.8-3.8 8-3.8 6.6 0 12 5.2 12 12.3C46 30.6 24 42 24 42Z"
                  fill="url(#g1)"
                  transform="translate(-3 0)"
                />
                <path
                  d="M8 24h8l3-6 4 12 3.5-8 2.5 4h11"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1>个体化血脂控制目标计算器</h1>
              <p>依据《中国血脂管理指南（2023年）》危险分层</p>
            </div>
          </div>
          <div className="top-actions">
            <button type="button" className="btn ghost" onClick={() => setAboutOpen(true)}>
              关于
            </button>
            <button type="button" className="btn ghost" onClick={() => setS(initialState)}>
              重置
            </button>
            <button type="button" className="btn primary" onClick={copySummary}>
              {copied ? '已复制 ✓' : '复制结果'}
            </button>
          </div>
        </div>
      </header>

      <div className="workspace">
        <nav className="side-nav">
          <p className="nav-title">评估步骤</p>
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" className={`nav-item${step === n ? ' on' : ''}`} onClick={() => setStep(n)}>
              <span className="nav-num">{n}</span>
              <span className="nav-label">{STEP_META[n].short}</span>
              {missingSteps.has(n) ? <span className="nav-dot" title="有信息待补充">!</span> : null}
            </button>
          ))}
          <div className="nav-spacer" />
          <div className="nav-status">
            <span>当前危险分层</span>
            <b style={{ color: result.category ? style.fg : '#94a3b8' }}>{result.category ? result.categoryLabel : '待评估'}</b>
          </div>
        </nav>

        <main className="content-pane">
          <div className="pane-head">
            <h2>
              <span className="step-badge">{step}</span>
              {STEP_META[step].title}
            </h2>
            <p className="hint">{STEP_META[step].hint}</p>
          </div>
          <div className="pane-body scroll-hidden">
            {step === 1 ? <StepBasics s={s} set={set} /> : null}
            {step === 2 ? <StepLipids s={s} set={set} ctx={ctx} /> : null}
            {step === 3 ? <StepRisk s={s} set={set} ctx={ctx} /> : null}
          </div>
          <div className="pane-foot">
            <button type="button" className="btn ghost-dark" disabled={step === 1} onClick={() => setStep(step - 1)}>
              ← 上一步
            </button>
            <span className="step-indicator">
              {step} / 3
            </span>
            <button type="button" className="btn primary-dark" disabled={step === 3} onClick={() => setStep(step + 1)}>
              下一步 →
            </button>
          </div>
        </main>

        <aside className="result-pane">
          <div className="risk-head" style={{ background: result.category ? style.grad : 'linear-gradient(135deg,#94a3b8,#64748b)' }}>
            <span className="risk-caption">ASCVD 危险分层</span>
            <span className="risk-name">{result.category ? result.categoryLabel : '待评估'}</span>
            {result.chips.length ? (
              <span className="risk-chips">
                {result.chips.map((c) => (
                  <em key={c}>{c}</em>
                ))}
              </span>
            ) : null}
          </div>

          <div className="result-body">
            {result.missing.length ? (
              <div className="missing-box">
                <b>待补充信息</b>
                <ul>
                  {result.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="target-box">
              <div className="target-label">首要目标 LDL-C</div>
              {result.target?.ldl != null ? (
                <>
                  <div className="target-value">
                    <span className="lt">&lt;</span>
                    <span className="num">{fmt(result.target.ldl)}</span>
                    <span className="u">mmol/L</span>
                  </div>
                  <div className="target-sub">
                    ≈ {toMgDl(result.target.ldl)} mg/dL
                    {result.target.reduction50 ? ' · 且较基线降低幅度 >50%' : ''}
                  </div>
                  {effective?.fromBaseline ? (
                    <div className="target-effective">
                      结合基线（{ctx.ldlc} mmol/L）：实际需 <b>&lt;{fmt(effective.value)} mmol/L</b>
                      <span className="hint-inline">（绝对目标与降幅 &gt;50% 取更严格者）</span>
                    </div>
                  ) : null}
                  <div className="target-meta">
                    <span className="meta-chip">推荐 {result.target.recClass}</span>
                    <span className="meta-chip">证据 {result.target.evidence}</span>
                    <span className="meta-chip source">{result.target.source}</span>
                  </div>
                </>
              ) : (
                <div className="target-value placeholder">待评估</div>
              )}
              {result.nonHdl != null ? (
                <div className="secondary-target">
                  次要目标 非 HDL-C：<b>&lt;{fmt(result.nonHdl)} mmol/L</b>
                  <span className="hint-inline">（LDL-C 目标 + 0.8）</span>
                </div>
              ) : null}
              {ctx.nonHdl !== null ? (
                <div className="secondary-target muted">当前非 HDL-C（TC−HDL-C）：{fmt(ctx.nonHdl)} mmol/L</div>
              ) : null}
            </div>

            <div className="result-tabs">
              <button type="button" className={resultTab === 'basis' ? 'on' : ''} onClick={() => setResultTab('basis')}>
                分层依据
              </button>
              <button type="button" className={resultTab === 'advice' ? 'on' : ''} onClick={() => setResultTab('advice')}>
                治疗建议
              </button>
              <button type="button" className={resultTab === 'monitor' ? 'on' : ''} onClick={() => setResultTab('monitor')}>
                监测随访
              </button>
            </div>

            <div className="result-tabbody scroll-hidden">
              {resultTab === 'basis' ? (
                <>
                  {result.diabetesNote ? (
                    <div className="note-box">
                      <b>糖尿病</b>
                      <span>{result.diabetesNote}</span>
                    </div>
                  ) : null}
                  {result.reasons.length ? (
                    <ul className="reason-list">
                      {result.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-hint">填写左侧信息后，这里将展示分层依据。</p>
                  )}
                  {result.notes.length ? (
                    <div className="notes">
                      {result.notes.map((n, i) => (
                        <p key={i}>※ {n}</p>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              {resultTab === 'advice' ? (
                <ul className="advice-list">
                  {result.advice.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : null}

              {resultTab === 'monitor' ? (
                <ul className="advice-list monitoring">
                  {result.monitoring.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="result-foot">仅供临床参考 · 依据《中国血脂管理指南（2023年）》</div>
        </aside>
      </div>

      {aboutOpen ? <AboutModal onClose={() => setAboutOpen(false)} /> : null}
    </div>
  );
}
