# Native 7：新增修复与验证

版本 `0.2.1-alpha.9-http.11-candidate.7`。安装包 93,957 字节，SHA-256 `28ba1e9cfe142fba3fd59a31a7b5e4356bcb9a433b63d2b8ed8fb52da5131d94`。

| 新问题及依据 | 本次处理与新增证据 |
|---|---|
| 源码默认窗口已移除，但随包 patch 仍填七个无来源值 | 删除这七行；官方配置组合证明未配置时 unknown，真正用户 override 保留。 |
| Host 已提供 skill 字符串参数，connector 又按目录隐藏工具、添加 enum、提前拒绝名字 | 保留工具名映射，原 schema/description 透传；真实 Host skill 组件自行返回成功或 unknown。 |
| assistant/system 图片无 Native replay 被本地拒绝；可选 source 被直接解引用 | 保持角色、次序与附件；三角色在 source 有/无两种情形都经真实 adapter、runner 和 JSON-RPC 注入，图片数据完整，未伪造 source。 |
| warning 被转换成模型正文，官方压缩器会把它持久保存为摘要 | 改到现有 Host logger；实际压缩组件的摘要只有正文，诊断仍保留，会话去重和 finish/replay 语义不变。 |
| Host approval unavailable 被返回为用户 decline | unavailable 使用既有 RPC error，无 decision；真实 Host rejected/cancelled 映射不变。合成管道验证仅一次 error、无 result，随后正常允许可恢复。 |

最终源测试 370 通过，两个真实二进制探针跳过；类型、构建、renderer 16、包专项 28 通过。源、包与测试精确身份见 freeze-lock.json。实际 Codex 未运行；RPC error 在真实上游的完整处理尚非本轮实测。

真实Host已完成三轮warning增量，其余分层与未执行尾项见[验收状态](ACCEPTANCE.md)。

临时 cwd 对接、压缩工具策略与旧重试默认属于仍保留的设计边界，本次没有扩大调整。
