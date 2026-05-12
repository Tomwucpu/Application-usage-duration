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

### 应用名称映射
- 内置 30+ 常见应用的中英文名称映射（Chrome、VS Code、微信、Office 等）
- `getDisplayName()` 大小写不敏感匹配，未匹配则显示原始名称

### 已修复问题
- Tauri 2.x 权限系统：添加 `capabilities/default.json` 授权 `core:event:allow-listen` 和 `core:event:allow-emit`
- Windows API 兼容：`GetWindowThreadProcessId` 在 `WindowsAndMessaging`、`LASTINPUTINFO` 在 `KeyboardAndMouse`
- `QueryFullProcessImageNameW` 参数类型匹配（`HANDLE` 直接传递、`PWSTR` 包装）
- GDI 函数返回值处理：`CreateCompatibleDC`/`CreateCompatibleBitmap` 返回原始句柄非 Result

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
