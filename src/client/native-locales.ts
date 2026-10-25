export const NS = 'codex-native'
export const zh = {
  locale: 'zh-CN', nav: 'Codex 官方登录', title: 'Codex',
  description: '连接 ChatGPT 账号，使用 Codex 模型与工具。',
  signIn: '使用 ChatGPT 登录', deviceCode: '使用设备码登录', connected: '已连接', disconnected: '未登录',
  working: '正在处理…', waiting: '正在等待 OpenAI 完成授权', openPage: '打开 OpenAI 授权页面', code: '设备码',
  refresh: '刷新账户状态', logout: '退出登录', cancel: '取消登录', quota: '订阅额度', quotaUnknown: '额度信息待更新',
  error: '操作失败', loginSuccess: '登录已完成', plan: '套餐', used: '已使用',
  instructions: '在官方授权页完成登录后，账户状态会自动更新。',
  accountTitle: '账户连接', usageTitle: '历史用量', clearUsage: '清除', queryUsage: '查询', queryingUsage: '查询中…',
  totalUsage: '列表总用量', lifetimeUsage: '官方累计', usageDate: '日期', updatedAt: '查询于',
  usageEmpty: '点击「查询」获取官方 Token 历史用量。', usageNeedsLogin: '连接 ChatGPT 账号后可查询 Token 历史。',
  dailyUnavailable: '每日明细：当前暂无记录。', noDailyRows: '每日记录：暂无。',
  ungroupedPeriod: '其他日期记录', usageSource: 'Token 来源：', accountScope: '（ChatGPT 账号总用量）',
  resetSource: '历史周期来源：', resetSourceSuffix: ' 公共重置公告', resetUnavailable: '当前按日期展示',
  referenceNote: '历史周期参考公开重置公告，按 UTC 日期分组；重置当天的统计归入新周期。',
  clearNote: '清除当前表格；点击「查询」重新加载官方历史。列表总计按返回的每日记录计算。',
  partialUsage: '列表汇总本次成功读取的每日记录。',
  officialWindowSource: '当前额度窗口与下次重置：Codex 官方 account/rateLimits/read', nextReset: '下次重置',
}
export const en: typeof zh = {
  locale: 'en-US', nav: 'Codex official login', title: 'Codex',
  description: 'Connect your ChatGPT account to use Codex models and tools.',
  signIn: 'Sign in with ChatGPT', deviceCode: 'Use device code', connected: 'Connected', disconnected: 'Not signed in',
  working: 'Working…', waiting: 'Waiting for OpenAI authorization', openPage: 'Open OpenAI sign-in', code: 'Device code',
  refresh: 'Refresh account', logout: 'Sign out', cancel: 'Cancel login', quota: 'Plan usage', quotaUnknown: 'Plan details pending',
  error: 'Operation failed', loginSuccess: 'Sign-in complete', plan: 'Plan', used: 'Used',
  instructions: 'Complete authorization on the official page. Account status updates automatically.',
  accountTitle: 'Account', usageTitle: 'Usage history', clearUsage: 'Clear', queryUsage: 'Query', queryingUsage: 'Querying…',
  totalUsage: 'Listed usage', lifetimeUsage: 'Official lifetime', usageDate: 'Date', updatedAt: 'Queried',
  usageEmpty: 'Select Query to load official Token usage history.', usageNeedsLogin: 'Connect ChatGPT to view your Token history.',
  dailyUnavailable: 'Daily details: awaiting records.', noDailyRows: 'Daily records: empty.',
  ungroupedPeriod: 'Other date records', usageSource: 'Token source: ', accountScope: ' (ChatGPT account total)',
  resetSource: 'Historical periods: ', resetSourceSuffix: ' public reset announcements', resetUnavailable: 'grouped by date',
  referenceNote: 'Reference periods follow public reset announcements by UTC date; reset-day totals appear in the new period.',
  clearNote: 'Clear resets this table; Query reloads official history. Listed total sums returned daily rows.',
  partialUsage: 'Listed usage sums the daily records available for this query.',
  officialWindowSource: 'Current quota windows and next reset: official Codex account/rateLimits/read', nextReset: 'Next reset',
}
export type CodexNativeUiKey = keyof typeof zh
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'codex-native': CodexNativeUiKey }
}
