# Application Usage Duration

基于 Tauri 2 + React + TypeScript 的 Windows 桌面应用，追踪前台应用使用时长，通过仪表盘展示统计结果。

## 功能特性

- **实时追踪**：基于 WinEvent 事件驱动追踪前台窗口（毫秒级精度），自动检测 AFK 空闲状态（可配置空闲阈值）
- **仪表盘**：当日总时长、活跃应用数、应用排行榜（图标/时长/占比）、按小时堆叠柱状图
- **多视图模式**：日视图 / 周视图 / 月视图 / 自定义日期范围
- **分组统计**：按应用（app）或按分类（category）切换统计维度，支持分类级排行榜与堆叠图
- **应用分类**：7 个内置分类（uncategorized、office、study、video、entertainment、social、system），支持自定义分类及图标
- **分类过滤**：仪表盘可按应用名或分类筛选图表与排行数据
- **应用图标**：从 exe 自动提取图标（SHGetFileInfoW + GDI），缓存 200 个 base64 PNG，图标缺失时回退为首字母占位
- **系统托盘**：暂停/恢复追踪、显示/隐藏窗口、退出；关闭窗口隐藏至托盘
- **应用管理**：
  - 管理已追踪应用（搜索、分页、排序）
  - 自定义应用显示别名（全局生效，排行榜/分布图/仪表盘同步更新）
  - 自定义图标路径（支持 .png/.ico）
  - 行内编辑名称与图标，支持独立重置为默认值
  - 彻底删除应用所有记录及元数据
- **分类管理**：
  - 管理分类（搜索、分页、排序、拖拽排序）
  - 自定义分类名称与图标（内置图标库 + 文件选择）
  - 将应用分配到指定分类
  - 删除分类时自动将应用移至 uncategorized
- **设置页**：
  - 主题切换（浅色 / 深色）
  - 语言切换（简体中文 / English）
  - 开机自启
  - 数据导出（CSV / JSON）
  - 数据导入（CSV / JSON，含预览、去重、进度三步向导）
  - 数据保留策略（永久或自定义天数，启动时自动清理）
  - 空闲阈值配置（5/10/15/30 分钟预设或自定义）
  - 忽略应用列表（支持显示图标）
  - 检查更新（Tauri updater 插件）
- **本地 SQLite**：便携目录模式，数据库文件位于 exe 同级目录

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x |
| 前端 | React 18 + TypeScript + Vite |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS 3 |
| 图表 | Recharts 3 |
| 日期 | date-fns 4 |
| 后端 | Rust |
| 数据库 | SQLite (rusqlite) |
| 平台 API | windows-rs 0.57 |
| 插件 | autostart, updater, shell, dialog |

## 目录结构

```text
├── src/                          # 前端源码
│   ├── App.tsx                   # 根组件，路由切换（dashboard / settings / appManagement / categoryManagement）
│   ├── main.tsx                  # React 入口
│   ├── index.css                 # Tailwind 指令 + 自定义滚动条
│   ├── components/
│   │   ├── Dashboard.tsx         # 仪表盘页（懒加载）
│   │   ├── StackedBarChart.tsx   # 堆叠柱状图页（懒加载）
│   │   ├── SettingsPage.tsx      # 设置页（懒加载）
│   │   ├── AppNames.ts           # 应用显示名解析（全局别名）
│   │   ├── CategoryIcons.tsx     # 分类图标路径解析
│   │   ├── appManagement/
│   │   │   ├── AppManagement.tsx # 应用管理页（懒加载）
│   │   │   └── AppTable.tsx      # 应用管理表格（搜索/分页/排序/行内编辑）
│   │   ├── categoryManagement/
│   │   │   ├── CategoryManagement.tsx   # 分类管理页（懒加载）
│   │   │   ├── CategoryTable.tsx        # 分类管理表格
│   │   │   ├── CreateCategoryDialog.tsx # 创建分类弹窗
│   │   │   └── CategoryIconPicker.tsx   # 分类图标选择器
│   │   ├── dashboard/
│   │   │   ├── AppRanking.tsx          # 应用排行榜
│   │   │   ├── DatePicker.tsx          # 日期选择器
│   │   │   ├── DateNavigator.tsx       # 日期导航
│   │   │   └── filterDashboardItems.ts # 仪表盘筛选逻辑
│   │   ├── breakdown/
│   │   │   └── DateRangePicker.tsx     # 自定义日期范围选择
│   │   ├── settings/
│   │   │   ├── DataIO.tsx            # 数据导出/导入
│   │   │   ├── IdleThreshold.tsx     # 空闲阈值配置
│   │   │   ├── IgnoredApps.tsx       # 忽略应用列表
│   │   │   ├── ImportDialog.tsx      # 数据导入向导
│   │   │   ├── LanguageSelect.tsx    # 语言切换
│   │   │   ├── Retention.tsx         # 数据保留策略
│   │   │   └── UpdateChecker.tsx     # 检查更新
│   │   └── shared/
│   │       ├── ConfirmDialog.tsx     # 通用确认弹窗
│   │       ├── DataTable.tsx         # 通用分页表格
│   │       ├── DropdownMenu.tsx      # 通用下拉菜单（含多选筛选）
│   │       ├── EditableCell.tsx      # 行内可编辑单元格
│   │       ├── InfoTooltip.tsx       # 信息提示
│   │       ├── Switch.tsx            # 开关组件
│   │       └── ToastStack.tsx        # Toast 通知栈
│   ├── i18n/
│   │   ├── index.ts              # useT hook
│   │   ├── context.tsx           # I18nProvider
│   │   ├── zh-CN.json            # 中文文案
│   │   └── en-US.json            # 英文文案
│   ├── stores/
│   │   ├── useStore.ts           # Zustand store + IPC 封装
│   │   └── iconCache.ts          # 图标 LRU 缓存
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义
│   └── utils/
│       ├── chartColors.ts        # 图表颜色工具
│       ├── dates.ts              # 日期工具（fmtLocalDate, parseDate 等）
│       ├── dates.test.ts         # 日期工具测试
│       ├── displayNames.ts       # 显示名称同步
│       ├── exportUtils.ts        # 导出工具
│       ├── exportUtils.test.ts   # 导出单元测试
│       ├── importUtils.ts        # 导入解析/验证
│       └── importUtils.test.ts   # 导入单元测试
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 应用入口，Tauri builder
│   │   ├── lib.rs                # IPC 命令（追踪控制、数据库查询、设置、导入）
│   │   ├── db/
│   │   │   ├── mod.rs            # Database 结构体
│   │   │   ├── schema.rs         # 建表/迁移
│   │   │   ├── usage.rs          # 使用记录查询
│   │   │   ├── app_metadata.rs   # 应用元数据 CRUD
│   │   │   ├── categories.rs     # 分类 CRUD
│   │   │   ├── settings.rs       # 设置读写
│   │   │   └── models.rs         # 数据结构定义
│   │   ├── tracker.rs            # 前台窗口事件追踪、AFK 检测、使用记录写入
│   │   ├── icon.rs               # Windows 图标提取（SHGetFileInfoW → GDI → PNG → base64）
│   │   └── tray.rs               # 系统托盘菜单
│   └── capabilities/
│       └── default.json          # 权限配置
├── public/                       # 静态资源（含 category-icons/ 分类图标）
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## 环境要求

- Node.js 18+
- Rust stable（建议通过 rustup 安装）
- Windows 10/11（追踪与图标提取仅在 Windows 下有效，macOS 为 stub）
- Tauri 2 系统依赖（参阅 [Tauri 文档](https://v2.tauri.app/start/prerequisites/)）

验证工具链：

```powershell
node -v
npm -v
rustc -V
cargo -V
```

## 快速开始

```powershell
# 安装依赖
npm install

# 仅前端开发（Vite，端口 1420）
npm run dev

# 完整桌面应用开发（Tauri + 前后端联调）
npm run tauri dev
```

## 构建与测试

```powershell
# 类型检查 + 前端构建
npm run build

# 前端单元测试（Vitest）
npm run test

# Rust 测试
cargo test        # 在 src-tauri/ 目录下执行

# 桌面应用打包
npm run tauri build
```

## 架构概览

```
前端 (React 18 + TS + Vite)          后端 (Rust via Tauri IPC)
──────────────────────────────       ─────────────────────────────
useStore.ts ←─ listen("tracker-state") ── tracker.rs (事件驱动)
useStore.ts ── invoke("get_*") ──────── lib.rs (命令) → db/*.rs (SQLite)
```

- **IPC 模式**：前端通过 `invoke()` 调用 `#[tauri::command]`；后端通过 `app.emit("tracker-state")` 推送实时状态
- **状态管理**：单一 Zustand store，初始化时启动追踪并订阅实时事件（1 秒节流）
- **数据库**：`<exe_dir>/usage.db`，首次启动自动建表，包含 `usage_records`、`app_metadata`、`categories`、`settings` 四张表
- **追踪循环**：独立线程基于 `EVENT_SYSTEM_FOREGROUND` WinEvent 事件驱动，前端状态推送 1 秒节流
- **图标缓存**：内存中 LRU 上限 200 个（app）+ 60 个（category），超出时清空重建

## 数据模型

### usage_records
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| app_name | TEXT | 应用名称 |
| app_path | TEXT | 可执行文件路径（可空） |
| window_title | TEXT | 窗口标题（可空） |
| start_time | TEXT | 开始时间 (ISO 8601) |
| end_time | TEXT | 结束时间 (ISO 8601) |
| duration_seconds | INTEGER | 持续秒数 |
| date | TEXT | 日期 (YYYY-MM-DD) |
| hour | INTEGER | 小时 (0-23) |

### app_metadata
| 字段 | 类型 | 说明 |
|------|------|------|
| app_name | TEXT | 应用名称（主键） |
| app_path | TEXT | 应用路径（图标提取用） |
| display_name | TEXT | 用户自定义别名（可空） |
| custom_icon_path | TEXT | 自定义图标路径（可空，优先级最高） |
| default_icon_path | TEXT | 默认图标路径（可空，Data/Icons/{app_name}.png） |
| category_id | INTEGER | 分类 ID（外键，默认 uncategorized） |

### categories
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| name | TEXT | 分类名称 |
| icon_source | TEXT | 图标来源 ("builtin" / "file") |
| builtin_icon_key | TEXT | 内置图标键名（可空） |
| custom_icon_path | TEXT | 自定义图标路径（可空） |
| is_default | INTEGER | 是否为默认分类 (uncategorized) |
| is_builtin | INTEGER | 是否为内置分类 |
| sort_order | INTEGER | 排序顺序 |

### settings
键值对存储，已知键：`locale`、`retention_days`、`ignored_apps`、`ignored_apps_enabled`、`afk_threshold_seconds`、`group_by`

## 国际化

支持语言：

- `zh-CN` (简体中文)
- `en-US` (English)

文案文件：`src/i18n/zh-CN.json`、`src/i18n/en-US.json`

## 常见问题

### 为什么某些应用没有图标？
可能原因：应用路径不可访问、系统权限限制、或该进程图标提取失败。界面自动回退为首字母占位。

### 为什么数据没有实时变化？
请确认追踪状态为运行中（检查系统托盘菜单），并确保未进入 AFK 空闲状态。

### 设置了自定义保留天数后何时生效？
保存后配置立即落库；历史数据清理在应用启动阶段自动执行。

### 如何导入历史数据？
在设置页使用"导入数据"功能，支持 CSV / JSON 格式。导入时自动预览、验证并去重。

## 许可证

MIT License — 详见 [LICENSE](LICENSE)
