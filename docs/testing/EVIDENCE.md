# 可查验用例与结果

对应源版本：[固定候选提交](https://github.com/Tests4gptplay/dsh-codex-native/commit/2debe255139ccf65a4dc0d2508d53aa6cfd480c6)。下列记录来自既有执行，不是再次测试。

已宣称的370/16/28为各测试层汇总；不能把组件层结果读成所有实机入口都已执行。审批错误恢复的实现/用例见固定提交 [审批适配源码](../../src/native-approvals.ts) 与 [审批错误回归用例](../../tests/approval-unavailable-proposal.spec.ts)。

| 范围 | 操作步骤 | 预期 | 实际结果与环境 |
|---|---|---|---|
| 诊断与续接 | 同会话发warning A两轮，再发B一轮 | 正文不含诊断；A去重，B独立保留；会话完成 | 实际Host三轮完成，logger A/B各一次；正文由已有现场观察确认。 |
| provider与预算 | 正常模型请求进入真实插件 | process/thread provider一致，显式10001保留 | 三次provider输入记录一致，实际spawn含10001；未增加plugin拒绝层。 |
| 技能与图片 | Host技能组件执行成功/unknown；三角色图片经adapter/runner注入 | schema原样、Host判断；角色/顺序/附件保留 | 真实组件+合成service管道通过；skills21/read1001及discovery10001在源组件层通过。 |
| 摘要诊断 | 官方压缩组件消费带warning的模型块 | 摘要只有正文，诊断仍经独立通道 | 新版摘要无warning，finish/replay保留；这是组件证据。 |

## 公开证据

[净化用例结果 JSON](evidence/verified-cases.json)，SHA256 `f76490a6e4697f06478fc7c2087694b55c14a01e6d7f066f9411e25b856e94d9`。文件保留测试环境、实际时间/状态/计数及原证据文件SHA；删除账号内容、机器目录、会话标识、原始日志和截图。

原证据SHA用于标识摘录来源；原件不在本仓时，不把SHA冒充可公开下载的原件。历史组件总数仅按现有摘要记录，未凭空补出逐用例执行记录；具体实现与测试可从固定提交继续查验。已有结果与[实机验证要求](ACCEPTANCE.md)分开。
