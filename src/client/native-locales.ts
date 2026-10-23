export const NS = 'codex-native'
export const zh = {
  locale: 'zh-CN', nav: 'Codex 官方登录', title: 'Codex',
  description: '使用具有 Codex 使用权限的 ChatGPT 账号登录，无需单独配置 API Key。',
  signIn: '使用 ChatGPT 登录', deviceCode: '使用设备码登录', connected: '已连接', disconnected: '未登录',
  working: '正在处理…', waiting: '正在等待 OpenAI 完成授权', openPage: '打开 OpenAI 授权页面', code: '设备码',
  refresh: '刷新账户状态', logout: '退出登录', cancel: '取消登录', quota: '订阅额度', quotaUnknown: '当前未返回订阅额度',
  error: '操作失败', loginSuccess: '登录已完成', plan: '套餐', used: '已使用',
  instructions: '在官方授权页完成登录后，账户状态会自动更新。',
  accountTitle: '账户连接', usageTitle: '历史用量', clearUsage: '清除', queryUsage: '查询', queryingUsage: '查询中…',
  totalUsage: '列表总用量', lifetimeUsage: '官方累计', usageDate: '日期', updatedAt: '查询于',
  usageEmpty: '点击「查询」读取官方历史用量；不会自动刷新。', usageNeedsLogin: '登录后可手动查询历史用量。',
  dailyUnavailable: '官方暂未提供每日明细；未提供的数据不按零用量计算。', noDailyRows: '官方返回的每日记录为空。',
  ungroupedPeriod: '较早记录 · 周期未知', usageSource: 'Token 来源：', accountScope: '（账户口径，非仅本插件）',
  resetSource: '历史周期来源：', resetSourceSuffix: ' 公共重置公告', resetUnavailable: '暂不可用，按日期展示',
  referenceNote: '重置周期仅供参考：按公告 UTC 日期归组，重置当天整日计入新组，不拆分当天用量。',
  clearNote: '清除仅清空本页结果；再次查询会恢复官方历史。列表总计只包含返回的每日记录。',
  partialUsage: '部分每日记录缺失或无法准确解析，未计入列表总量。',
  officialWindowSource: '当前窗口／下次重置：Codex 官方 account/rateLimits/read（不是历史重置流水）', nextReset: '下次重置',
}
export const en: typeof zh = {
  locale: 'en-US', nav: 'Codex official login', title: 'Codex',
  description: 'Sign in with a ChatGPT account that has Codex access; no separate API key is needed.',
  signIn: 'Sign in with ChatGPT', deviceCode: 'Use device code', connected: 'Connected', disconnected: 'Not signed in',
  working: 'Working…', waiting: 'Waiting for OpenAI authorization', openPage: 'Open OpenAI sign-in', code: 'Device code',
  refresh: 'Refresh account', logout: 'Sign out', cancel: 'Cancel login', quota: 'Plan usage', quotaUnknown: 'No plan limits returned',
  error: 'Operation failed', loginSuccess: 'Sign-in complete', plan: 'Plan', used: 'Used',
  instructions: 'Complete authorization on the official page. Account status updates automatically.',
  accountTitle: 'Account', usageTitle: 'Usage history', clearUsage: 'Clear', queryUsage: 'Query', queryingUsage: 'Querying…',
  totalUsage: 'Listed usage', lifetimeUsage: 'Official lifetime', usageDate: 'Date', updatedAt: 'Queried',
  usageEmpty: 'Click Query to read official history. No automatic refresh.', usageNeedsLogin: 'Sign in to query usage history manually.',
  dailyUnavailable: 'Daily history is unavailable from the service. Missing data is not zero usage.', noDailyRows: 'The service returned no daily records.',
  ungroupedPeriod: 'Earlier records · unknown period', usageSource: 'Token source: ', accountScope: ' (account-wide, not only this plugin)',
  resetSource: 'Historical periods: ', resetSourceSuffix: ' public reset announcements', resetUnavailable: 'unavailable; showing dates only',
  referenceNote: 'Periods are reference only, grouped by announcement UTC date. A reset day stays whole in the new group; no intraday usage is invented.',
  clearNote: 'Clear removes this view only. Query restores official history. Listed totals include only returned daily records.',
  partialUsage: 'Some daily entries were unavailable or could not be parsed precisely and are not included.',
  officialWindowSource: 'Current windows / next reset: official Codex account/rateLimits/read (not a historical reset ledger)', nextReset: 'Next reset',
}
export type CodexNativeUiKey = keyof typeof zh
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'codex-native': CodexNativeUiKey }
}
