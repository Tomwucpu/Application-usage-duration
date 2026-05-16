# 发布指南

## 范围
本指南涵盖基于 GitHub Releases + Tauri updater 产物的自动化发布流程。
Windows 代码签名当前刻意延期处理。

## 必需 Secrets
在创建发布标签前，请先在仓库中配置以下 Secrets：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

可选（为后续 Windows 代码签名预留）：

- `WINDOWS_CERT_BASE64`
- `WINDOWS_CERT_PASSWORD`

## 发布步骤
1. 更新 `package.json` 与 `src-tauri/tauri.conf.json` 中的版本号。
2. 在 `CHANGELOG.md` 中补充本次版本发布说明。
3. 创建并推送类似 `v0.2.0` 的 Git 标签。
4. GitHub Actions 的 `release` 工作流会自动触发。
5. 在 GitHub Releases 中校验草稿发布的产物与 updater 元数据。
6. 校验通过后，发布该草稿版本。

## 验证清单
- 本地 `npm run build` 通过。
- 在 `src-tauri` 目录执行 `cargo check` 通过。
- 标签对应提交的发布工作流执行成功。
- 生成的 Release 包含安装包/打包产物。
- 应用可在 设置 -> 检查更新 中检测到更新。

## 说明
- 当前仓库已配置 updater endpoint：
	- `https://github.com/Tomwucpu/Application-usage-duration/releases/latest/download/latest.json`
- 请确保在运行/构建环境中提供 `TAURI_UPDATER_PUBKEY`。
