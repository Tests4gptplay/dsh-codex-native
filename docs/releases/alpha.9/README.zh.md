# DSH Codex Native 0.2.1-alpha.9

通过 OpenAI 官方 Codex app-server 将 Codex 接入 DeepSeek Harness，支持 ChatGPT 登录、原生模型设置、DSH 工具和手动 Token 历史统计。

## 版本改进

- 连接稳定性与账号登录处理，延续 alpha.6、alpha.7 的传输修复。
- Token 累计消耗与最近一次上下文窗口分别计量，数据更准确。
- Codex 原生上下文管理与结构化溢出恢复。
- 手动查询 Token 历史、按日期查看用量、参考周期分组及清除表格。
- 调整了中英文界面说明，突出操作和数据来源。

## 安装

```text
github:Tests4gptplay/dsh-codex-native#v0.2.1-alpha.9
```

发行文件提供预编译插件及 DSH rc.2 宿主集成材料。详见[安装指南](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/INSTALL_PATCHED_HOST.md)。

## Token 历史统计实机截图

![DSH Desktop Token 历史统计脱敏实测图](https://raw.githubusercontent.com/Tests4gptplay/dsh-codex-native/main/docs/screenshots/codex-usage-desktop-anonymized.png)

用户确认过的 DSH Desktop 真实页面，账号行已脱敏并获授权公开。[浅色界面](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-light.png) · [深色界面](https://github.com/Tests4gptplay/dsh-codex-native/blob/main/docs/screenshots/codex-usage-dark.png)。

## 数据与许可

Token 历史来自 Codex `account/usage/read`；历史周期分组参考 [codex-reset.com](https://codex-reset.com/developers/) 的公开公告。MIT 许可及上游署名见 [LICENSE](LICENSE)。
