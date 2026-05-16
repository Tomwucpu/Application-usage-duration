 # Performance + Release Implementation Plan

 > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 减少前端重复取数与重渲染，接入 GitHub Releases 自动更新，并为后续签名留出流水线接口。

**Architecture:** 在前端尽可能通过 `useMemo` 与精细化 Zustand 订阅减少重算；必要时把聚合查询上移到 Rust (SQLite) 侧。自动更新通过 Tauri updater 指向 GitHub Releases，并用 GitHub Actions 生成 release 产物与更新元数据。

**Tech Stack:** React + Vite + TypeScript, Zustand, Recharts, Tauri 2.x, Rust (rusqlite), GitHub Actions

---

### Task 1: 收集性能基线 (当前进行中)

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/StackedBarChart.tsx`
- Modify: `src/components/AppRanking.tsx`
- Modify: `src/stores/useStore.ts`

- [ ] **Step 1: 在 dev 模式复现关键路径并运行基线构建**

Run:
```powershell
npm install
npm run build
npm run tauri build --if-present
```

Expected: 构建成功；记录首屏构建时间与 `npm run build` 输出用时。

- [ ] **Step 2: 使用 React DevTools/Profiler 采集渲染次数**

Commands: 在 `npm run dev` 下打开页面，使用浏览器 React Profiler 测量：
- 首次加载 Dashboard
- 切换日期
- 切换日/周视图

Record: 每次操作的渲染次数与耗时截图/记录。

- [ ] **Step 3: 记录 IPC 响应大小与频率**

Modify: 在 `src/stores/useStore.ts` 的 `api` 层临时添加日志（只用于基线采集），记录 `get_daily_summary`, `get_hourly_app_breakdown`, `get_daily_app_breakdown` 的响应大小与耗时。

---

### Task 2: 优化前端渲染

**Files:**
- Modify: `src/stores/useStore.ts`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/StackedBarChart.tsx`
- Modify: `src/components/AppRanking.tsx`

- [ ] **Step 1: 精细化 Zustand 订阅**
  - Change `useStore` exposures so组件只订阅所需字段（示例：`useStore(s => s.tracker.today_total_seconds)`），避免整树重渲染。
  - Commit after change and run `npm run build`.

- [ ] **Step 2: 把图表数据透视逻辑用 `useMemo` 缓存**
  - In `StackedBarChart.tsx` wrap `buildDailyChartData`/`buildWeeklyChartData` with `useMemo` keyed by raw input arrays + `viewMode`.

- [ ] **Step 3: 减少不必要的前端数据请求**
  - 在 `Dashboard.tsx` 中合并/防抖 `loadHourlyBreakdown` 调用，避免 mount+effect+date-change 三次相同请求。

---

### Task 3: 缓存图表与图标数据

**Files:**
- Modify: `src/stores/useStore.ts`
- Modify: `src/components/AppRanking.tsx`
- Modify: `src-tauri/src/lib.rs` (暴露 `get_all_app_icons` — 已存在)

- [ ] **Step 1: 本地内存缓存图标映射**
  - 在 `useStore` 增加 `appIcons: Record<string,string>` 缓存，并在初始化时调用 `api.getAllAppIcons()`。

- [ ] **Step 2: 如果 payload 仍大则在 Rust 侧增加分页/聚合查询**
  - Modify: `src-tauri/src/db.rs` 增加 `get_daily_summary_paginated` 或在 IPC 层做 limit/offset。

---

### Task 4: 配置自动更新 (GitHub Releases)

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs` (暴露版本信息给前端)
- Modify: `src/components/SettingsPage.tsx` (添加更新检查 UI)

- [ ] **Step 1: 在 `tauri.conf.json` 中加入 updater 配置**
  - Example snippet to add `updater` pointing to GitHub Releases per Tauri docs.

- [ ] **Step 2: 在 `src-tauri/Cargo.toml` 确保 `tauri` features 包含 updater 支持**

- [ ] **Step 3: 前端实现手动检查与自动检查逻辑**
  - 在 `SettingsPage` 添加“检查更新”按钮，展示状态（有/无/下载中/安装中/失败）。

---

### Task 5: 搭建 GitHub Actions 发布流水线

**Files:**
- Add: `.github/workflows/release.yml`

- [ ] **Step 1: workflow 构建与打包**
  - Lint/Typecheck → `npm install` → `npm run build` → `cargo build --release` → `tauri build`

- [ ] **Step 2: 生成 Release 产物并创建 GitHub Release**
  - 使用 `actions/upload-release-asset` 上传打包产物，并生成 `latest.json` 或相应更新元数据（Tauri updater 需要的格式）。

---

### Task 6: 签名预留配置（后续单独接入）

**Files:**
- Modify: `.github/workflows/release.yml` (增加签名步骤的占位)
- Modify: `src-tauri/tauri.conf.json` (保留证书相关字段位置)

- [ ] **Step 1: 在 workflow 中添加注释化签名占位**
  - 不在当前轮实际签名，但留出注入证书的环境变量点（`$SIGN_CERT_PFX`, `$SIGN_PASSWORD`）。

---

### Task 7: 验证、回归与文档

**Files:**
- Modify: `docs/dev-log.md`
- Add: `CHANGELOG.md`

- [ ] **Step 1: 运行完整端到端演练**
  - 本地构建 → 触发 release workflow (测试 tag) → 在测试机器安装并验证自动更新。

- [ ] **Step 2: 写发布说明与操作步骤**
  - 把验证步骤写入 `docs/release-guide.md`，包含如何接入证书签名的后续步骤。

---

## 验证命令（常用）

```powershell
npm ci
npm run build
npx tsc --noEmit
cargo build --release
npm run tauri build
```

## 交付与选择
- 计划已分解为 7 个可核查任务，当前第 1 项（收集性能基线）为进行中。
- 下一步：我将开始执行第1项的基线收集（运行构建、采集 React Profiler 数据及 IPC 响应大小）。
