import type { Locale } from "../i18n";

const APP_NAME_MAP: Record<string, Record<Locale, string>> = {
  "chrome": { "zh-CN": "谷歌浏览器", "en-US": "Google Chrome" },
  "msedge": { "zh-CN": "Edge 浏览器", "en-US": "Microsoft Edge" },
  "firefox": { "zh-CN": "火狐浏览器", "en-US": "Firefox" },
  "Code": { "zh-CN": "VS Code", "en-US": "VS Code" },
  "devenv": { "zh-CN": "Visual Studio", "en-US": "Visual Studio" },
  "notepad++": { "zh-CN": "记事本++", "en-US": "Notepad++" },
  "notepad": { "zh-CN": "记事本", "en-US": "Notepad" },
  "explorer": { "zh-CN": "文件资源管理器", "en-US": "File Explorer" },
  "WeChat": { "zh-CN": "微信", "en-US": "WeChat" },
  "wechatweb": { "zh-CN": "微信网页版", "en-US": "WeChat Web" },
  "DingTalk": { "zh-CN": "钉钉", "en-US": "DingTalk" },
  "Feishu": { "zh-CN": "飞书", "en-US": "Feishu" },
  "ApplicationFrameHost": { "zh-CN": "系统设置", "en-US": "Settings" },
  "Taskmgr": { "zh-CN": "任务管理器", "en-US": "Task Manager" },
  "cmd": { "zh-CN": "命令提示符", "en-US": "Command Prompt" },
  "WindowsTerminal": { "zh-CN": "终端", "en-US": "Terminal" },
  "powershell": { "zh-CN": "PowerShell", "en-US": "PowerShell" },
  "WINWORD": { "zh-CN": "Microsoft Word", "en-US": "Microsoft Word" },
  "EXCEL": { "zh-CN": "Microsoft Excel", "en-US": "Microsoft Excel" },
  "POWERPNT": { "zh-CN": "Microsoft PowerPoint", "en-US": "Microsoft PowerPoint" },
  "OUTLOOK": { "zh-CN": "Microsoft Outlook", "en-US": "Microsoft Outlook" },
  "idea64": { "zh-CN": "IntelliJ IDEA", "en-US": "IntelliJ IDEA" },
  "pycharm64": { "zh-CN": "PyCharm", "en-US": "PyCharm" },
  "webstorm64": { "zh-CN": "WebStorm", "en-US": "WebStorm" },
  "spotify": { "zh-CN": "Spotify", "en-US": "Spotify" },
  "vlc": { "zh-CN": "VLC 播放器", "en-US": "VLC Player" },
  "obs64": { "zh-CN": "OBS Studio", "en-US": "OBS Studio" },
  "slack": { "zh-CN": "Slack", "en-US": "Slack" },
  "teams": { "zh-CN": "Microsoft Teams", "en-US": "Microsoft Teams" },
  "zoom": { "zh-CN": "Zoom", "en-US": "Zoom" },
  "GitHubDesktop": { "zh-CN": "GitHub Desktop", "en-US": "GitHub Desktop" },
  "AFK": { "zh-CN": "空闲", "en-US": "AFK" },
};

export function getDisplayName(appName: string, locale: Locale): string {
  if (!appName) return "";
  const entry = APP_NAME_MAP[appName];
  if (entry) return entry[locale];
  // Try case-insensitive match
  const lower = appName.toLowerCase();
  for (const [key, value] of Object.entries(APP_NAME_MAP)) {
    if (key.toLowerCase() === lower) return value[locale];
  }
  return appName;
}
