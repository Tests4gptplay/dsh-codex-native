export const NS = 'codex-native'
export const zh = {
  nav: 'Codex 官方登录',
  title: '欢迎使用 Codex',
  description: '请使用具有 Codex 使用权限的 ChatGPT 账号登录。调用将消耗适用的 Codex 订阅额度，无需单独配置 API Key。',
  signIn: '使用 ChatGPT 登录',
  deviceCode: '使用设备码登录',
  connected: '已连接',
  disconnected: '未登录',
  working: '正在处理…',
  waiting: '正在等待 OpenAI 完成授权',
  openPage: '打开 OpenAI 授权页面',
  code: '设备码',
  refresh: '刷新账户状态',
  logout: '退出 Codex 登录',
  cancel: '取消登录',
  quota: '订阅额度',
  quotaUnknown: '当前未返回订阅额度',
  error: '操作失败',
  loginSuccess: '登录已完成',
  plan: '套餐',
  used: '已使用',
  instructions: '在官方授权页完成登录后，页面会自动更新状态。',
}
export const en: typeof zh = {
  nav: 'Codex official login',
  title: 'Welcome to Codex',
  description: 'Sign in with a ChatGPT account that has Codex access. Requests use your Codex plan allowance; no separate API key is needed.',
  signIn: 'Sign in with ChatGPT',
  deviceCode: 'Use device code',
  connected: 'Connected',
  disconnected: 'Not signed in',
  working: 'Working…',
  waiting: 'Waiting for OpenAI authorization',
  openPage: 'Open OpenAI sign-in',
  code: 'Device code',
  refresh: 'Refresh account',
  logout: 'Sign out',
  cancel: 'Cancel login',
  quota: 'Plan usage',
  quotaUnknown: 'No plan limits returned',
  error: 'Operation failed',
  loginSuccess: 'Sign-in complete',
  plan: 'Plan',
  used: 'Used',
  instructions: 'Complete authorization on the official page. Account status updates automatically.',
}

export type CodexNativeUiKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'codex-native': CodexNativeUiKey
  }
}
