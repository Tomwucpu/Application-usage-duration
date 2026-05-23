let _names: Record<string, string> = {};

export function setDisplayNames(names: Record<string, string>) {
  _names = names;
}

export function getDisplayName(appName: string): string {
  if (_names[appName]) return _names[appName];
  return appName || "";
}
