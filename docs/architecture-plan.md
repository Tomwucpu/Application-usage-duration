# 桌面屏幕使用时长统计应用 — 技术架构方案

## 核心需求

| 需求 | 技术挑战 |
|------|----------|
| 跨平台 (Windows + macOS) | 需要一套代码双平台运行 |
| 后台常驻运行 | 需系统托盘、低资源占用、开机自启 |
| 检测活跃窗口 / 应用 | 需调用各平台原生 API |
| 空闲时间检测 | 需监听鼠标键盘输入 |
| 数据可视化 | 需丰富的图表库 |
| 按时段统计 | 需本地时序数据库 |

---

## 推荐架构: Tauri 2.x + React + TypeScript + 可视化库

```
┌─────────────────────────────────────────┐
│              Frontend (React)            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 仪表盘   │ │ 应用统计  │ │ 时段分析  │  │
│  │ Recharts│ │ 排行榜   │ │ 热力图   │  │
│  └─────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────┤
│          Tauri Bridge (IPC)              │
├─────────────────────────────────────────┤
│           Rust Backend                   │
│  ┌──────────┐ ┌────────┐ ┌───────────┐  │
│  │ 窗口追踪  │ │ 空闲检测│ │ 数据存储   │  │
│  │ Win: Win32│ │ GetLast│ │ SQLite    │  │
│  │ Mac: NSWorkspace│ │ Input  │ │           │  │
│  └──────────┘ └────────┘ └───────────┘  │
└─────────────────────────────────────────┘
```

---

## 为什么选择 Tauri 而不是 Electron？

| 对比维度 | Tauri | Electron |
|----------|-------|----------|
| 安装包大小 | ~8-15 MB | ~150-200 MB |
| 内存占用 (后台) | ~30-50 MB | ~150-300 MB |
| 系统 API 调用 | Rust 原生调用，零开销 | 需 Node 扩展或原生模块 |
| 适合后台常驻 | 非常适合 | 资源开销过大 |

对于一个需要**全天候后台运行**的监控应用，轻量级是硬性要求。Electron 会导致用户抱怨"统计工具本身成了耗电大户"。

---

## 技术栈明细

### 前端 (UI 层)

| 库 | 用途 |
|----|------|
| React 18 + TypeScript | 组件化开发，类型安全 |
| Tailwind CSS | 快速构建界面样式 |
| Recharts / ECharts | 柱状图、饼图、热力图、时间轴 |
| date-fns | 日期处理与格式化 |
| Zustand | 轻量状态管理 |

### 后端 (Rust 层)

| 库 / Crate | 用途 |
|------------|------|
| Tauri 2.x | 跨平台框架，系统托盘、开机自启、自动更新 |
| rusqlite | SQLite 数据库操作 |
| winapi | Windows 系统 API (GetForegroundWindow, GetWindowText, GetProcessTimes, GetLastInputInfo) |
| cocoa / core-foundation | macOS 系统 API (NSWorkspace, CGEvent, IOKit) |

---

## 数据模型

```sql
-- 按分钟粒度的应用使用记录
CREATE TABLE usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,          -- 应用名称，如 "Google Chrome"
    app_path TEXT,                    -- 应用可执行文件路径
    window_title TEXT,                -- 窗口标题
    start_time DATETIME NOT NULL,     -- 开始时间
    end_time DATETIME NOT NULL,       -- 结束时间
    duration_seconds INTEGER NOT NULL,-- 使用时长 (秒)
    date TEXT NOT NULL,               -- '2026-05-12' 格式，便于快速查询
    hour INTEGER NOT NULL             -- 0-23，按小时聚合
);

CREATE INDEX idx_date ON usage_records(date);
CREATE INDEX idx_hour ON usage_records(date, hour);
CREATE INDEX idx_app ON usage_records(app_name, date);
```

---

## 追踪逻辑

```
每 2 秒轮询一次:
  1. 获取当前活跃窗口 → 应用名称 + 窗口标题
  2. 检测用户是否空闲 (GetLastInputInfo / CGEvent)
  3. 如果空闲超过阈值 (默认 5 分钟)，标记为 AFK 状态
  4. 如果应用切换，结算上一应用的时长并写入 SQLite
  5. 实时推送给前端更新 (Tauri Event System)
```

---

## 功能模块拆分

### Phase 1 — MVP (1-2 周)

- Rust 追踪引擎：窗口检测、空闲检测、数据采集
- SQLite 数据库建表与读写
- 基础 Tauri 窗口显示今日统计数据

### Phase 2 — 可视化 (1 周)

- 仪表盘页面：今日屏幕使用总时长、应用占比饼图
- 柱状图：各应用使用时长排行
- 日期切换：支持查看历史数据

### Phase 3 — 进阶功能 (1 周)

- 时段热力图（类似 GitHub 贡献图）
- 时间轴视图：按天展示每小时使用的应用，色块区分
- 系统托盘：显示今日总时长、暂停/恢复追踪、退出
- 开机自启配置

### Phase 4 — 打磨 (1 周)

- 数据导出：CSV / JSON 格式
- 设置页面：空闲阈值、数据保留天数、忽略应用列表
- 性能优化、打包签名、自动更新

---

## 降级方案

| 方案 | 适用场景 | 代价 |
|------|----------|------|
| Electron + React | 团队不熟悉 Rust | 资源占用大 (~200MB RAM) |
| Python + PySide6 | 快速原型开发 | UI 精致度有限，打包体积较大 |

---

## 总结

**推荐方案：Tauri + React + TypeScript + Recharts + SQLite**

核心优势：
- 轻量后台常驻，不会成为耗电大户
- 一套代码同时覆盖 Windows 和 macOS
- Rust 直接调用系统 API，零中间层开销
- 安装包仅 ~10MB，用户体验好
