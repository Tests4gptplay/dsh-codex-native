window.__ModuleLoader__.load({
	id: "dsh-codex-native",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/usage.ts
		function sumUsage(days) {
			return days.reduce((sum, day) => sum + BigInt(day.tokens), 0n).toString();
		}
		/** Assign whole official date buckets, not fabricated hourly fractions, to reference periods. */
		function groupUsage(days, resets) {
			const boundaries = [...resets].sort((a, b) => a.date.localeCompare(b.date));
			const groups = /* @__PURE__ */ new Map();
			for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
				const start = boundaries.filter((boundary) => boundary.date <= day.date).at(-1)?.date ?? null;
				const id = start ?? "unassigned";
				let period = groups.get(id);
				if (!period) {
					period = {
						id,
						startDate: start,
						endDate: day.date,
						days: [],
						tokens: "0"
					};
					groups.set(id, period);
				}
				period.days.push(day);
				period.endDate = day.date;
				period.tokens = (BigInt(period.tokens) + BigInt(day.tokens)).toString();
			}
			return [...groups.values()].reverse().map((period) => ({
				...period,
				days: [...period.days].reverse()
			}));
		}
		//#endregion
		//#region src/client/ui-style.ts
		/** Layout only. Every visual color/radius comes from the DSH theme; controls are official primitives. */
		const ui = {
			section: {
				display: "flex",
				flexDirection: "column",
				gap: 16,
				minWidth: 0,
				color: "var(--dsw-alias-label-primary)"
			},
			card: {
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "var(--dsw-radius-lg)",
				padding: 16,
				minWidth: 0
			},
			toolbar: {
				display: "flex",
				alignItems: "center",
				flexWrap: "wrap",
				gap: 8
			},
			secondary: {
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 12,
				lineHeight: 1.6
			},
			note: {
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: 1.65
			},
			count: {
				fontVariantNumeric: "tabular-nums",
				fontWeight: 600,
				whiteSpace: "nowrap"
			},
			heading: {
				margin: 0,
				fontSize: 14,
				lineHeight: 1.5,
				fontWeight: 600
			},
			link: {
				color: "inherit",
				textDecoration: "underline",
				textUnderlineOffset: 2
			}
		};
		//#endregion
		//#region src/client/UsagePanel.tsx
		/** Pure view, also used by offline rendering tests. Never starts a query. */
		function UsageView({ snapshot, busy, enabled, error, open, onQuery, onClear, onToggle, t }) {
			const periods = groupUsage(snapshot?.days ?? [], snapshot?.resets ?? []);
			const total = snapshot?.days == null ? snapshot?.lifetimeTokens ?? null : sumUsage(snapshot.days);
			const format = (tokens) => tokens === null ? "—" : new Intl.NumberFormat(t("locale")).format(BigInt(tokens));
			const dateTime = (value) => new Intl.DateTimeFormat(t("locale"), {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			}).format(new Date(value));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: ui.card,
				"aria-label": t("usageTitle"),
				"data-codex-usage": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: {
							...ui.heading,
							marginBottom: 12
						},
						children: t("usageTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: ui.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: busy || snapshot === null,
								onClick: onClear,
								"data-usage-clear": true,
								children: t("clearUsage")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: busy || !enabled,
								onClick: onQuery,
								"data-usage-query": true,
								children: busy ? t("queryingUsage") : t("queryUsage")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									marginInlineStart: "auto",
									display: "flex",
									alignItems: "baseline",
									gap: 8
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: ui.secondary,
										children: snapshot?.days == null && snapshot?.lifetimeTokens ? t("lifetimeUsage") : t("totalUsage")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											...ui.count,
											fontSize: 18
										},
										"data-usage-total": true,
										"aria-live": "polite",
										children: format(total)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: ui.secondary,
										children: "tokens"
									})
								]
							})
						]
					}),
					snapshot && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: {
							...ui.note,
							margin: "8px 0 0"
						},
						children: [
							t("updatedAt"),
							" ",
							dateTime(snapshot.queriedAt),
							snapshot.days !== null && snapshot.lifetimeTokens !== null ? ` · ${t("lifetimeUsage")} ${format(snapshot.lifetimeTokens)} tokens` : ""
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "alert",
						style: {
							...ui.secondary,
							margin: "12px 0 0"
						},
						children: [
							t("error"),
							": ",
							error
						]
					}),
					!snapshot && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...ui.secondary,
							margin: "18px 0"
						},
						children: enabled ? t("usageEmpty") : t("usageNeedsLogin")
					}),
					snapshot && snapshot.days === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...ui.secondary,
							margin: "18px 0"
						},
						children: t("dailyUnavailable")
					}),
					snapshot?.days?.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...ui.secondary,
							margin: "18px 0"
						},
						children: t("noDailyRows")
					}),
					periods.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { marginTop: 14 },
						children: periods.map((period) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								borderTop: "0.5px solid var(--dsw-alias-border-l2)",
								padding: "10px 0"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}),
								title: period.startDate ? `${period.startDate} — ${period.endDate}` : t("ungroupedPeriod"),
								open: open.has(period.id),
								expandable: true,
								expandOnRowClick: true,
								previewChevron: false,
								onToggle: () => onToggle(period.id),
								headerAccessory: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										...ui.count,
										marginInlineStart: "auto",
										fontSize: 13,
										paddingInlineStart: 12
									},
									"data-period-total": true,
									children: [
										format(period.tokens),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: ui.secondary,
											children: "tokens"
										})
									]
								}),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
									style: {
										width: "100%",
										borderCollapse: "collapse",
										fontSize: 13,
										marginTop: 8
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
										style: ui.note,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
											scope: "col",
											style: {
												textAlign: "start",
												padding: "4px 0 6px 24px",
												fontWeight: 400
											},
											children: t("usageDate")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
											scope: "col",
											style: {
												textAlign: "end",
												padding: "4px 0 6px",
												fontWeight: 400
											},
											children: "Tokens"
										})]
									}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: period.days.map((day) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										style: {
											padding: "5px 0 5px 24px",
											color: "var(--dsw-alias-label-secondary)"
										},
										children: day.date
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										style: {
											padding: "5px 0",
											textAlign: "end",
											fontVariantNumeric: "tabular-nums"
										},
										children: format(day.tokens)
									})] }, day.date)) })]
								})
							})
						}, period.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
						style: {
							...ui.note,
							marginTop: 16,
							paddingTop: 12,
							borderTop: "0.5px solid var(--dsw-alias-border-l2)"
						},
						"data-usage-sources": true,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
								t("usageSource"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									style: ui.link,
									href: "https://developers.openai.com/codex/app-server/",
									target: "_blank",
									rel: "noopener noreferrer",
									children: "OpenAI Codex · account/usage/read"
								}),
								t("accountScope")
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
								t("resetSource"),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									style: ui.link,
									href: "https://codex-reset.com/",
									target: "_blank",
									rel: "noopener noreferrer",
									children: "codex-reset.com"
								}),
								t("resetSourceSuffix"),
								snapshot?.resetSource === "unavailable" ? ` · ${t("resetUnavailable")}` : ""
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("referenceNote") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("clearNote") }),
							snapshot?.incomplete && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("partialUsage") }),
							snapshot && snapshot.windows.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: { marginTop: 8 },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("officialWindowSource") }), snapshot.windows.map((window, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									window.name,
									" · ",
									t("used"),
									" ",
									window.usedPercent === null ? "—" : `${window.usedPercent}%`,
									window.resetsAt !== null ? ` · ${t("nextReset")} ${dateTime(window.resetsAt * 1e3)}` : ""
								] }, `${window.name}:${index}`))]
							})
						]
					})
				]
			});
		}
		/** Query and clear are manual actions; expanding, mounting and clearing never call the backend. */
		function UsagePanel({ rpc, t, enabled }) {
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [open, setOpen] = (0, react.useState)(/* @__PURE__ */ new Set());
			const alive = (0, react.useRef)(true);
			const requesting = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			const query = async () => {
				if (requesting.current || !enabled) return;
				requesting.current = true;
				setBusy(true);
				setError("");
				try {
					const result = await rpc.call("usage");
					if (!alive.current) return;
					setSnapshot(result);
					const first = groupUsage(result.days ?? [], result.resets)[0];
					setOpen(new Set(first ? [first.id] : []));
				} catch (err) {
					if (alive.current) setError(err instanceof Error ? err.message : String(err));
				} finally {
					requesting.current = false;
					if (alive.current) setBusy(false);
				}
			};
			const clear = () => {
				setSnapshot(null);
				setError("");
				setOpen(/* @__PURE__ */ new Set());
			};
			const toggle = (id) => setOpen((previous) => {
				const next = new Set(previous);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageView, {
				snapshot,
				busy,
				enabled,
				error,
				open,
				onQuery: () => {
					query();
				},
				onClear: clear,
				onToggle: toggle,
				t
			});
		}
		//#endregion
		//#region src/client/CodexNativeSection.tsx
		/** DSH-native account controls plus a manually queried usage view. */
		function CodexNativeSection({ rpc, t }) {
			const [account, setAccount] = (0, react.useState)(null);
			const [flow, setFlow] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const refresh = (0, react.useCallback)(async () => {
				setAccount(await rpc.call("status"));
			}, [rpc]);
			(0, react.useEffect)(() => {
				let active = true;
				rpc.call("status").then((value) => {
					if (active) setAccount(value);
				}).catch((err) => {
					if (active) setError(String(err));
				});
				return () => {
					active = false;
				};
			}, [rpc]);
			(0, react.useEffect)(() => {
				if (!flow || flow.phase !== "pending") return;
				let active = true, pending = false;
				const timer = setInterval(() => {
					if (pending) return;
					pending = true;
					rpc.call("login/status", { id: flow.id }).then(async (next) => {
						if (!active) return;
						setFlow(next);
						if (next.phase === "authenticated") {
							const status = await rpc.call("status");
							if (active) setAccount(status);
						}
					}).catch((err) => {
						if (active) setError(String(err));
					}).finally(() => {
						pending = false;
					});
				}, 1500);
				return () => {
					active = false;
					clearInterval(timer);
				};
			}, [
				flow?.id,
				flow?.phase,
				rpc
			]);
			const run = async (operation) => {
				setBusy(true);
				setError("");
				try {
					await operation();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			};
			const start = (mode) => {
				run(async () => setFlow(await rpc.call("login/start", { mode })));
			};
			const cancel = () => {
				if (flow) run(async () => setFlow(await rpc.call("login/cancel", { id: flow.id })));
			};
			const logout = () => {
				run(async () => {
					await rpc.call("logout");
					setFlow(null);
					await refresh();
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: ui.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: {
							margin: 0,
							fontSize: 22,
							lineHeight: 1.4
						},
						children: t("title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...ui.secondary,
							margin: "8px 0 0"
						},
						children: t("description")
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						style: ui.card,
						"aria-label": t("accountTitle"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									...ui.toolbar,
									marginBottom: 12
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: ui.heading,
									children: t("accountTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										...ui.secondary,
										marginInlineStart: "auto"
									},
									children: account?.authenticated ? t("connected") : t("disconnected")
								})]
							}),
							account?.authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								style: {
									...ui.secondary,
									margin: "0 0 12px",
									overflowWrap: "anywhere"
								},
								children: [account.email ?? "", account.planType ? ` · ${t("plan")}: ${account.planType}` : ""]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: ui.toolbar,
								children: account?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: busy,
									onClick: () => {
										run(refresh);
									},
									children: t("refresh")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: busy,
									onClick: logout,
									children: t("logout")
								})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: busy || flow?.phase === "pending",
									onClick: () => start("browser"),
									children: t("signIn")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: busy || flow?.phase === "pending",
									onClick: () => start("device"),
									children: t("deviceCode")
								})] })
							}),
							flow?.phase === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									...ui.secondary,
									marginTop: 14
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("waiting") }),
									flow.authUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										style: ui.link,
										href: flow.authUrl,
										target: "_blank",
										rel: "noopener noreferrer",
										children: t("openPage")
									}),
									flow.verificationUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										style: ui.link,
										href: flow.verificationUrl,
										target: "_blank",
										rel: "noopener noreferrer",
										children: t("openPage")
									}),
									flow.userCode && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
										t("code"),
										": ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: flow.userCode })
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("instructions") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled: busy,
										onClick: cancel,
										children: t("cancel")
									})
								]
							}),
							flow?.phase === "authenticated" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: ui.secondary,
								children: t("loginSuccess")
							}),
							flow?.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								style: ui.secondary,
								children: flow.error
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								role: "alert",
								style: ui.secondary,
								children: [
									t("error"),
									": ",
									error
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsagePanel, {
						rpc,
						t,
						enabled: account?.authenticated === true
					}, account?.authenticated ? account.email ?? "connected" : "logged-out")
				]
			});
		}
		//#endregion
		//#region src/client/native-rpc.ts
		function makeNativeCodexRpc(connection) {
			return { async call(endpoint, payload = {}) {
				const response = await connection.rpc.call("/api", "codex-native/" + endpoint, payload);
				if (!response?.ok) throw new Error(response?.error?.message || "Codex account request failed");
				return response.value;
			} };
		}
		//#endregion
		//#region src/client/native-locales.ts
		const NS = "codex-native";
		const zh = {
			locale: "zh-CN",
			nav: "Codex 官方登录",
			title: "Codex",
			description: "连接 ChatGPT 账号，使用 Codex 模型与工具。",
			signIn: "使用 ChatGPT 登录",
			deviceCode: "使用设备码登录",
			connected: "已连接",
			disconnected: "未登录",
			working: "正在处理…",
			waiting: "正在等待 OpenAI 完成授权",
			openPage: "打开 OpenAI 授权页面",
			code: "设备码",
			refresh: "刷新账户状态",
			logout: "退出登录",
			cancel: "取消登录",
			quota: "订阅额度",
			quotaUnknown: "额度信息待更新",
			error: "操作失败",
			loginSuccess: "登录已完成",
			plan: "套餐",
			used: "已使用",
			instructions: "在官方授权页完成登录后，账户状态会自动更新。",
			accountTitle: "账户连接",
			usageTitle: "历史用量",
			clearUsage: "清除",
			queryUsage: "查询",
			queryingUsage: "查询中…",
			totalUsage: "列表总用量",
			lifetimeUsage: "官方累计",
			usageDate: "日期",
			updatedAt: "查询于",
			usageEmpty: "点击「查询」获取官方 Token 历史用量。",
			usageNeedsLogin: "连接 ChatGPT 账号后可查询 Token 历史。",
			dailyUnavailable: "每日明细：当前暂无记录。",
			noDailyRows: "每日记录：暂无。",
			ungroupedPeriod: "其他日期记录",
			usageSource: "Token 来源：",
			accountScope: "（ChatGPT 账号总用量）",
			resetSource: "历史周期来源：",
			resetSourceSuffix: " 公共重置公告",
			resetUnavailable: "当前按日期展示",
			referenceNote: "历史周期参考公开重置公告，按 UTC 日期分组；重置当天的统计归入新周期。",
			clearNote: "清除当前表格；点击「查询」重新加载官方历史。列表总计按返回的每日记录计算。",
			partialUsage: "列表汇总本次成功读取的每日记录。",
			officialWindowSource: "当前额度窗口与下次重置：Codex 官方 account/rateLimits/read",
			nextReset: "下次重置"
		};
		const en = {
			locale: "en-US",
			nav: "Codex official login",
			title: "Codex",
			description: "Connect your ChatGPT account to use Codex models and tools.",
			signIn: "Sign in with ChatGPT",
			deviceCode: "Use device code",
			connected: "Connected",
			disconnected: "Not signed in",
			working: "Working…",
			waiting: "Waiting for OpenAI authorization",
			openPage: "Open OpenAI sign-in",
			code: "Device code",
			refresh: "Refresh account",
			logout: "Sign out",
			cancel: "Cancel login",
			quota: "Plan usage",
			quotaUnknown: "Plan details pending",
			error: "Operation failed",
			loginSuccess: "Sign-in complete",
			plan: "Plan",
			used: "Used",
			instructions: "Complete authorization on the official page. Account status updates automatically.",
			accountTitle: "Account",
			usageTitle: "Usage history",
			clearUsage: "Clear",
			queryUsage: "Query",
			queryingUsage: "Querying…",
			totalUsage: "Listed usage",
			lifetimeUsage: "Official lifetime",
			usageDate: "Date",
			updatedAt: "Queried",
			usageEmpty: "Select Query to load official Token usage history.",
			usageNeedsLogin: "Connect ChatGPT to view your Token history.",
			dailyUnavailable: "Daily details: awaiting records.",
			noDailyRows: "Daily records: empty.",
			ungroupedPeriod: "Other date records",
			usageSource: "Token source: ",
			accountScope: " (ChatGPT account total)",
			resetSource: "Historical periods: ",
			resetSourceSuffix: " public reset announcements",
			resetUnavailable: "grouped by date",
			referenceNote: "Reference periods follow public reset announcements by UTC date; reset-day totals appear in the new period.",
			clearNote: "Clear resets this table; Query reloads official history. Listed total sums returned daily rows.",
			partialUsage: "Listed usage sums the daily records available for this query.",
			officialWindowSource: "Current quota windows and next reset: official Codex account/rateLimits/read",
			nextReset: "Next reset"
		};
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-codex-native: language");
			const rpc = makeNativeCodexRpc(ctx.connection);
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-codex-native-login",
				order: 15,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({
					rpc,
					t
				})
			}, CodexNativeSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
