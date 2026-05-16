# Application Usage Duration

一款基于 Tauri 2 + React + TypeScript 的桌面应用，用于追踪 Windows 前台应用使用时长，并以仪表盘方式展示统计结果。

## 功能特性

- 实时追踪当前应用状态（运行中、停止、AFK）
- 按日统计总使用时长与活跃应用数
- 应用排行榜（图标、时长、占比）
- 应用分布可视化（按小时/按天堆叠柱状图）
- 设置页能力：
  - 主题切换（浅色/深色）
  - 语言切换（简体中文 / English）
  - 开机自启
  - 数据导出（CSV / JSON）
  - 数据保留策略（永久或自定义天数）
  - 忽略应用列表（支持显示应用图标）
- 本地 SQLite 持久化存储（便携目录模式）

## 技术栈

- 桌面框架: Tauri 2.x
- 前端: React 18 + TypeScript + Vite
- 状态管理: Zustand
- 样式: Tailwind CSS
- 图表: Recharts
- 后端: Rust
- 数据库: SQLite (rusqlite)
- 平台 API: windows-rs

## 目录结构

```text
.
|- src/                    # 前端源码
|  |- components/          # 视图组件
|  |- stores/              # Zustand 状态与前后端 API 封装
|  |- i18n/                # 国际化文案与上下文
|  |- utils/               # 工具函数（如导出）
|  |- types/               # TypeScript 类型定义
|- src-tauri/              # Tauri + Rust 后端
|  |- src/                 # 命令、追踪、数据库、托盘逻辑
|  |- capabilities/        # Tauri 能力权限
|- docs/                   # 架构与开发日志
|- public/                 # 静态资源
```

## 环境要求

- Node.js 18+
- Rust stable（建议通过 rustup 安装）
- Windows 10/11（当前追踪与图标提取主要面向 Windows）
- Tauri 依赖环境

建议先确认工具链版本：

```powershell
node -v
npm -v
rustc -V
cargo -V
```

## 快速开始

1. 安装依赖

```powershell
npm install
```

2. 前端开发模式（仅 Vite）

```powershell
npm run dev
```

3. 桌面应用开发模式（Tauri + 前后端联调）

```powershell
npm run tauri dev
```

## 构建与测试

- 类型检查 + 前端构建

```powershell
npm run build
```

- 单元测试（Vitest）

```powershell
npm run test
```

- 桌面应用打包

```powershell
npm run tauri build
```

## 核心数据说明

- 使用记录表: `usage_records`
  - 记录字段包括应用名、路径、窗口标题、开始/结束时间、持续秒数、日期、小时
- 应用元数据表: `app_metadata`
  - 存储 `app_name` 与 `app_path` 映射，供图标提取与缓存命中
- 设置表: `settings`
  - 存储主题、保留天数、忽略应用等配置

## 国际化

支持以下语言：

- `zh-CN`
- `en-US`

文案文件位于：

- `src/i18n/zh-CN.json`
- `src/i18n/en-US.json`

## 常见问题

### 1. 为什么某些应用没有图标？

可能原因：应用路径不可访问、系统权限限制、或该进程图标提取失败。界面会自动回退为首字母占位。

### 2. 为什么数据没有实时变化？

请确认应用追踪状态为运行中，并检查系统是否进入空闲（AFK）状态。

### 3. 设置了自定义保留天数后何时生效？

保存后配置立即落库；历史数据清理在应用启动阶段会根据配置执行。

## 开发文档

- 架构说明: `docs/architecture-plan.md`
- 变更日志: `docs/dev-log.md`

## 许可证

当前仓库未包含明确许可证文件。如需开源发布，建议补充 `LICENSE`。
