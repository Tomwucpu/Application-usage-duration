# 开发日志

## 2026-05-12 — 项目初始化与 Phase 1 MVP

### 项目搭建
- 使用 Tauri 2.x + React 18 + TypeScript + Vite 初始化项目
- 配置 Tailwind CSS、Recharts、Zustand、date-fns
- 生成应用图标（`npx tauri icon`）

### Rust 后端
- **数据库** (`db.rs`): SQLite 存储，`usage_records` 表按分钟粒度记录应用使用，含 `date`/`hour` 索引
- **追踪引擎** (`tracker.rs`): 每 2 秒轮询
  - Windows: `GetForegroundWindow` → 进程名 + 窗口标题
  - Windows: `GetLastInputInfo` → 空闲检测（5 分钟阈值自动标记 AFK）
  - 应用切换时结算上一应用时长并写入 SQLite
  - 通过 Tauri Event 实时推送状态到前端
- **IPC 命令** (`lib.rs`): `start_tracking`、`get_daily_summary`

### React 前端
- **Dashboard**: 实时状态指示、日期选择器、今日总时长/活跃应用数卡片
- **AppRanking**: 应用使用排行列表（图标 + 名称 + 百分比进度条）
- **状态管理**: Zustand store，通过 `listen("tracker-state")` 接收实时更新

### 国际化 (i18n)
- 轻量 Context 方案，支持 zh-CN / en-US 切换
- 语言偏好持久化到 localStorage
- Header 右上角语言切换按钮
- 所有 UI 文案双语言覆盖

### 应用图标提取
- **Windows** (`icon.rs`): `SHGetFileInfoW` → HICON → GDI 渲染 → GetDIBits 获取像素 → PNG 编码 → Base64
- 按可执行文件路径缓存，避免重复提取
- 前端展示：状态栏当前应用图标 + 排行榜各应用图标
- 无图标时显示首字母头像作为降级

### 应用名称显示
- 移除前端硬编码应用名翻译表（`APP_NAME_MAP`），`getDisplayName()` 简化为直接返回原始名称
- **Windows 版本信息读取**：通过 `GetFileVersionInfoSizeW` / `GetFileVersionInfoW` / `VerQueryValueW` 读取可执行文件的 `FileDescription` 字段，获得类似任务管理器的友好名称（如 `Google Chrome`、`Microsoft Edge`）
- **NameCache**：按可执行文件路径缓存查询结果，首次读取后命中缓存无需重复 I/O
- 降级策略：版本信息不可用时回退到 `file_stem()` 提取文件名

### 已修复问题
- Tauri 2.x 权限系统：添加 `capabilities/default.json` 授权 `core:event:allow-listen` 和 `core:event:allow-emit`
- Windows API 兼容：`GetWindowThreadProcessId` 在 `WindowsAndMessaging`、`LASTINPUTINFO` 在 `KeyboardAndMouse`
- `QueryFullProcessImageNameW` 参数类型匹配（`HANDLE` 直接传递、`PWSTR` 包装）
- GDI 函数返回值处理：`CreateCompatibleDC`/`CreateCompatibleBitmap` 返回原始句柄非 Result

### Phase 2 — 可视化 (2026-05-12)

- **UsageCharts 组件** (`UsageCharts.tsx`): 新增 Recharts 可视化图表组件
  - **应用占比饼图** (PieChart): 使用 donut 样式（innerRadius=60），展示 Top 7 应用 + "其他"分类，自定义 Tooltip 显示时长和百分比，右侧 Legend 图例
  - **分时使用柱状图** (BarChart): 填充 0-23 完整 24 小时，每格显示 `分钟` 数，自定义 Tooltip 显示具体时间点和时长
  - 数据转换：`buildPieData()` 合并 7 名以外的应用为"其他"；`buildHourlyData()` 补齐缺失小时为 0
  - 空数据状态降级显示
  - 图表采用暗色主题适配：`#1e293b` 网格线、`#94a3b8` 坐标轴标签、`#6366f1` 柱状图填充色

- **Dashboard 布局升级**: 在摘要卡片和排行榜之间嵌入 Charts 区块，`lg:grid-cols-2` 响应式双列布局

- **i18n 扩展**: 新增 5 个翻译键 — `chart.distribution`、`chart.hourly`、`chart.hour`、`chart.minutes`、`chart.others`

## 2026-05-13 — 时段热力图重构为堆叠柱状图

### 重构概述

将原有的 HeatmapChart（7×24 色块网格）和 TimelineView（主导应用网格）两个自定义组件替换为**基于 Recharts 的堆叠柱状图**，在单个 Tab 内支持日视图/周视图切换，直观展示每小时/每天内部各应用的时长占比。

### Rust 后端

- **新增结构体** (`db.rs`):
  - `HourlyAppBreakdown`: `hour` + `app_name` + `total_seconds` + `percentage` + `icon_base64`
  - `DailyAppBreakdown`: `date` + `app_name` + `total_seconds` + `percentage` + `icon_base64`
- **新增数据库查询** (`db.rs`):
  - `get_hourly_app_breakdown(date)`: `GROUP BY hour, app_name`，计算每小时内部各应用占比
  - `get_daily_app_breakdown(start, end)`: `GROUP BY date, app_name`，计算每天内部各应用占比
  - `get_app_paths_for_date_range(start, end)`: 获取日期范围内的应用路径用于图标提取
- **新增 IPC 命令** (`lib.rs`):
  - `get_hourly_app_breakdown`: 获取单日分时应用占比，附带图标 Base64
  - `get_daily_app_breakdown`: 获取日期范围分日应用占比，附带图标 Base64
- **删除旧代码**: 移除 `HeatmapCell`、`TimelineCell` 结构体及对应的数据库方法和 IPC 命令

### React 前端

- **StackedBarChart 组件** (`StackedBarChart.tsx`): 新建核心可视化组件
  - **日视图**: 24 根堆叠柱状图（每小时一根），每根柱按照应用堆叠，展示该小时内各应用的使用时长占比
  - **周视图**: 7 根堆叠柱状图（每天一根），展示过去 7 天每天的应用使用构成
  - **分段控制器**: `inline-flex` 双按钮切换日/周视图，选中态 `bg-indigo-600`
  - **数据变换**: `buildDailyChartData()` / `buildWeeklyChartData()` 将扁平数据透视（pivot）为 Recharts 所需格式，Top 10 应用独立着色，其余归入"其他"
  - **颜色方案**: 复用现有 12 色调色板，"其他"固定 `#475569`
  - **自定义 Tooltip**: 深色主题，显示时段内各应用的时长和百分比，按使用量降序排列
  - **图例**: 图表下方 flex-wrap 横排，最大宽度 80px 截断
  - **空状态**: 无数据时居中显示提示文案

- **Dashboard 重构** (`Dashboard.tsx`):
  - Tab 从 3 个简化为 2 个: 仪表盘 / 应用分布
  - 切换到"应用分布"Tab 时懒加载数据
  - 日期变更时自动刷新日视图数据
  - `TabId` 类型更新为 `"dashboard" | "breakdown"`

- **状态管理** (`useStore.ts`):
  - 新增 `hourlyBreakdown`、`dailyBreakdown` 状态字段
  - 新增 `loadHourlyBreakdown(date)`、`loadDailyBreakdown()` 动作
  - 移除 `heatmapData`、`timelineData` 及相关动作

- **类型定义** (`types/index.ts`): 新增 `HourlyAppBreakdown`、`DailyAppBreakdown`；移除 `HeatmapCell`、`TimelineCell`

- **i18n**: 新增 `tab.breakdown`、`breakdown.title`、`breakdown.daily`、`breakdown.weekly`、`breakdown.noData`；移除旧的 `tab.heatmap`、`tab.timeline`、`heatmap.*`、`timeline.*`

- **删除文件**: `HeatmapChart.tsx`、`TimelineView.tsx`

### 后端编译验证
- `cargo build` 通过，无错误
- `npx tsc --noEmit` 通过，无类型错误
- `npm run build` 通过，Vite 构建成功

### 技术栈
| 层 | 技术 |
|----|------|
| 框架 | Tauri 2.x |
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 状态 | Zustand |
| 图表 | Recharts |
| 数据库 | SQLite (rusqlite) |
| Windows API | windows-rs 0.57 |
| 图标处理 | image crate (PNG) + base64 |

## 2026-05-13 — 稳定性、性能与数据结构优化 (Phase 3)

### 数据库层更新 (`db.rs`)
- **应用元数据分离**: 新增 `app_metadata` 表专门存储 `app_name` 与 `app_path` 映射关系，取代此前在 `usage_records` 中基于日期的关联聚合查询，降低数据库性能损耗。
- 全局使用 `get_all_app_metadata` 快速获取应用路径以提取图标，移除原有按时间区间进行分组查询的操作。

### 进程追踪与图标改进 (`tracker.rs`, `icon.rs`)
- **权限兼容性增强**: 在获取进程信息 (`OpenProcess`) 时，增加降级查询策略 (`PROCESS_QUERY_LIMITED_INFORMATION`)，提高对系统级应用及高权限进程的识别成功率。
- **线程死锁及防抖保护**: 在 `start_tracking` 内借助 `AtomicBool` 标识检查，防止 React 前端引发的多次触发导致重复派生系统检测线程。
- **程序挂起及暂停生命周期**: 精确处理应用暂停、恢复（Pause/Resume）阶段的数据落盘，现在在插入记录时会完整附带 `app_path` 与 `window_title` 以补全丢失的部分上下文。
- **图标透明度渲染修复**: 优化了 Windows GDI icon 提取方法，换用 `CreateDIBSection` 取代老的兼容位图方法，精准捕获 Alpha 色彩通道，解决图标解析时常发生的黑色背景问题。

### 前端状态与架构微调 (`lib.rs`, `App.tsx`)
- **便携化（绿色）支持**: 调整后端持久化数据保存路径配置，将其从系统级别的 AppData 文件目录转移至与运行程序同级的所在目录，确保产品能够达到绿色运行的便携目的。
- **Tauri 事件拦截与析构**: 更新前端 `useStore:init` 函数结构，将事件的订阅过程置于命令执行之上，同时将返回的 `unlisten()` 函数暴露给 `useEffect` 的清理周期执行。
- **UI 组件视觉调整**: 缩小 `AppRanking` 的展示图标大小 (`w-8 h-8` -> `w-6 h-6`)，让数据列表呈现更紧凑的外观。
