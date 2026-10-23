window.__ModuleLoader__.load({
	id: "dsh-codex-native",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/CodexNativeSection.tsx
		/** Primary DSH settings surface for native Codex OAuth and account usage. */
		function CodexNativeSection({ rpc, t }) {
			const [account, setAccount] = (0, react.useState)(null);
			const [flow, setFlow] = (0, react.useState)(null);
			const [quota, setQuota] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const refresh = (0, react.useCallback)(async () => {
				const next = await rpc.call("status");
				setAccount(next);
				if (next.authenticated) try {
					setQuota(await rpc.call("quota"));
				} catch {
					setQuota(null);
				}
				else setQuota(null);
			}, [rpc]);
			(0, react.useEffect)(() => {
				let active = true;
				refresh().catch((err) => {
					if (active) setError(String(err));
				});
				return () => {
					active = false;
				};
			}, [refresh]);
			(0, react.useEffect)(() => {
				if (!flow || flow.phase !== "pending") return;
				let active = true;
				const timer = setInterval(() => {
					rpc.call("login/status", { id: flow.id }).then(async (next) => {
						if (!active) return;
						setFlow(next);
						if (next.phase === "authenticated") try {
							await refresh();
						} catch (err) {
							if (active) setError(String(err));
						}
					}).catch((err) => {
						if (active) setError(String(err));
					});
				}, 1500);
				return () => {
					active = false;
					clearInterval(timer);
				};
			}, [
				flow?.id,
				flow?.phase,
				rpc,
				refresh
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
				run(async () => {
					const next = await rpc.call("login/start", { mode });
					setFlow(next);
				});
			};
			const cancel = () => {
				if (!flow) return;
				run(async () => {
					setFlow(await rpc.call("login/cancel", { id: flow.id }));
				});
			};
			const logout = () => {
				run(async () => {
					await rpc.call("logout");
					setFlow(null);
					await refresh();
				});
			};
			const rows = [quota?.primary, quota?.secondary].filter((r) => !!r);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: {
					padding: "16px",
					maxWidth: "640px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("title") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("description") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: account?.authenticated ? t("connected") : t("disconnected") }),
						account?.email ? " · " + account.email : "",
						account?.planType ? " · " + t("plan") + ": " + account.planType : ""
					] }),
					account?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy,
							onClick: () => {
								run(refresh);
							},
							children: t("refresh")
						}),
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy,
							onClick: logout,
							children: t("logout")
						})
					] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy || flow?.phase === "pending",
							onClick: () => start("browser"),
							children: t("signIn")
						}),
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy || flow?.phase === "pending",
							onClick: () => start("device"),
							children: t("deviceCode")
						})
					] }),
					flow?.phase === "pending" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("waiting") }),
						flow.authUrl ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: flow.authUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							children: t("openPage")
						}) : null,
						flow.verificationUrl ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							href: flow.verificationUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							children: t("openPage")
						}) }) : null,
						flow.userCode ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							t("code"),
							": ",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								style: { letterSpacing: ".08em" },
								children: flow.userCode
							})
						] }) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("instructions") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy,
							onClick: cancel,
							children: t("cancel")
						})
					] }) : null,
					flow?.phase === "authenticated" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("loginSuccess") }) : null,
					flow?.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: flow.error
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "alert",
						children: [
							t("error"),
							": ",
							error
						]
					}) : null,
					busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						"aria-live": "polite",
						children: t("working")
					}) : null,
					account?.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("quota") }), rows.length ? rows.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
						index === 0 ? "Primary" : "Secondary",
						": ",
						t("used"),
						" ",
						row.usedPercent ?? "—",
						"%"
					] }, index)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("quotaUnknown") })] }) : null
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
			nav: "Codex 官方登录",
			title: "欢迎使用 Codex",
			description: "请使用具有 Codex 使用权限的 ChatGPT 账号登录。调用将消耗适用的 Codex 订阅额度，无需单独配置 API Key。",
			signIn: "使用 ChatGPT 登录",
			deviceCode: "使用设备码登录",
			connected: "已连接",
			disconnected: "未登录",
			working: "正在处理…",
			waiting: "正在等待 OpenAI 完成授权",
			openPage: "打开 OpenAI 授权页面",
			code: "设备码",
			refresh: "刷新账户状态",
			logout: "退出 Codex 登录",
			cancel: "取消登录",
			quota: "订阅额度",
			quotaUnknown: "当前未返回订阅额度",
			error: "操作失败",
			loginSuccess: "登录已完成",
			plan: "套餐",
			used: "已使用",
			instructions: "在官方授权页完成登录后，页面会自动更新状态。"
		};
		const en = {
			nav: "Codex official login",
			title: "Welcome to Codex",
			description: "Sign in with a ChatGPT account that has Codex access. Requests use your Codex plan allowance; no separate API key is needed.",
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
			quotaUnknown: "No plan limits returned",
			error: "Operation failed",
			loginSuccess: "Sign-in complete",
			plan: "Plan",
			used: "Used",
			instructions: "Complete authorization on the official page. Account status updates automatically."
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
