# 个体化血脂控制目标计算器

基于《中国血脂管理指南（2023年）》（中华心血管病杂志，2023，51(3)：221-255）与《中国血脂管理指南（基层版2024年）》
危险分层流程图开发的桌面工具，用于**快速计算个体化 LDL-C / 非 HDL-C 控制目标值**。

技术栈：**Tauri 2 + React 19 + TypeScript + Vite**，界面为单窗口中文应用。

---

## 功能

- **ASCVD 风险分层**（指南图1 完整实现）
  - 二级预防：严重 ASCVD 事件（4项）× 高危险因素（8项）→ 超高危 / 极高危
  - 一级预防：直接高危三条件（LDL-C≥4.9 / TC≥7.2、年龄≥40岁糖尿病、CKD 3~4期）
  - 一级预防：21 组合 10 年发病风险评估表（胆固醇分层 × 有无高血压 × 危险因素个数）
  - 中危且年龄<55岁：余生风险 5 项因素评估
  - 中危：风险增强因素（表2）提示与"按高危处理"临床判断开关
- **目标值输出**（表7 / 表15 / 表20）
  - 低危 <3.4；中/高危 <2.6；极高危 <1.8 且较基线降幅>50%；超高危 <1.4 且降幅>50%
  - 糖尿病特殊人群：合并 ASCVD <1.4；高危 <1.8；低/中危 <2.6
  - FH 特殊人群（表20）与风险分层目标取更严格者
  - 次要目标：非 HDL-C = LDL-C 目标 + 0.8 mmol/L
  - 自动换算 mg/dL；结合基线 LDL-C 计算"绝对目标与 >50% 降幅取更严格者"的实际达标值
- **治疗与监测建议**：中等强度他汀起始、联合依折麦布/PCSK9 抑制剂时机、4~6 周复查方案等
- 分层依据逐条展示，可一键复制结果文本

## 项目结构

```
ascvd-lipid-tool/
├─ src/
│  ├─ lib/guideline.ts      # 核心医学逻辑（纯函数，可单独测试）
│  ├─ App.tsx               # 界面
│  └─ App.css               # 样式
├─ scripts/logic-test.ts    # 逻辑自检（25 个指南场景用例）
└─ src-tauri/               # Tauri（Rust）端
```

## 本地开发

前置依赖：Node.js 18+、Rust（本文档使用 `stable-x86_64-pc-windows-gnu` 工具链 + MinGW-w64）、WebView2 运行时。

```bash
npm install
npm run tauri dev      # 开发模式
npm run test:logic     # 逻辑自检
```

也可直接运行 `build.ps1`（已配置好 GNU 工具链 PATH 与代理绕过）一键打包。

## 构建

```bash
npm run tauri build                 # 生成 NSIS 安装包
npm run tauri build -- --no-bundle  # 仅生成可执行文件
```

GNU 工具链下产物位于 `src-tauri/target/release/`：
`ascvd-lipid-tool.exe` 与 `WebView2Loader.dll`（需与 exe 同目录，安装包模式会自动处理）。

> 说明：Tauri CLI 在 Windows GNU 工具链下不会自动把 `WebView2Loader.dll` 打进安装包
> （CLI 发行版以 MSVC 编译，平台判断存在偏差），因此本项目在 `tauri.conf.json` 中
> 通过 `bundle.resources` 显式声明该 DLL，并将其副本存放于 `src-tauri/resources/`。

## 下载与发布

- GitHub Releases 提供 **Windows 安装包**与 **macOS (Apple Silicon / Intel) 应用**
- 自动化流程：
  - `.github/workflows/ci.yml`：推送到 `main` / PR 时执行类型检查、前端构建与 25 项指南逻辑测试
  - `.github/workflows/release.yml`：推送 `v*` 标签（或在 Actions 页手动触发）自动构建 Windows/macOS 并发布 Release

### 发布新版本

1. 同步更新版本号：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
2. 提交并推送标签：`git tag v0.2.0 && git push origin v0.2.0`
3. GitHub Actions 自动完成构建与 Release 发布

## 免责声明

本工具仅供临床参考与学习使用，**不作为诊疗依据**；具体治疗决策请结合患者个体情况并由专业医师判断。
