// @dsh-external/dsh-mao-method 客户端半边：DSH 设置页「毛泽东思想方法论」栏。
// 数据层：经插件自身路由 GET/POST /api/dsh-mao-method/config 读写（不经 apiProxy
// 的 settings 命名空间暴露白名单——插件命名空间默认不对浏览器设置页暴露）。
// 命名空间 dsh-mao：enabled（总开关）/ compact（精简模式）/ 五节独立开关。
// 保存后对「新创建的会话/agent」生效（与官方 preset 语义一致）。
window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-mao-method",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");
		const { Button } = require("@deepseek-ai/dsh-client-ui-primitives");

		const CONFIG_URL = "/api/dsh-mao-method/config";

		const SECTIONS = [
			{ key: "onPractice", label: "实践论：实践—认识—再实践", hint: "先调查后下结论、方案须经实践检验、吃一堑长一智等 6 条" },
			{ key: "onContradiction", label: "矛盾论：矛盾分析法", hint: "抓主要矛盾、一分为二、具体问题具体分析等 6 条" },
			{ key: "protractedWar", label: "论持久战：战略三阶段", hint: "长项目分防御/相持/反攻三阶段、积小胜为大胜等 6 条" },
			{ key: "shishiqiushi", label: "实事求是：调查研究", hint: "没有调查就没有发言权、实事求是、学会弹钢琴等 7 条" },
			{ key: "massLine", label: "群众路线与工作态度", hint: "从需求出发、精益求精、坚持好的改正错的等 7 条" }
		];

		const L = {
			nav: "毛泽东思想方法论",
			navSub: "以《毛泽东选集》方法论全局指导模型工作：五节提示词注入 + 原文检索工具（新会话生效）",
			enabledLabel: "启用方法论注入",
			enabledHint: "关闭后新会话不再注入方法论提示词",
			compactLabel: "精简模式",
			compactHint: "每节只保留准则标题与触发条件（省 token）",
			sectionsLabel: "注入的节（可独立开关）",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			loading: "加载中…",
			loadError: "配置读取失败（请确认插件已注入）",
			saveError: "保存失败",
			note: "说明：设置对新创建的会话/agent 生效；运行中会话保持原提示词（与官方 preset 语义一致）。语料库：毛选四卷 161 篇全文 + 精选 13 篇，模型可随时用 mao_reference 检索原文。"
		};

		function fieldRow(label, hint, input) {
			return jsxs("div", {
				style: { display: "flex", flexDirection: "column", gap: 4 },
				children: [
					jsx("span", { children: label }),
					input,
					hint ? jsx("span", { style: { fontSize: 12, opacity: 0.65 }, children: hint }) : null
				]
			});
		}

		function SettingsBlock() {
			const [status, setStatus] = react.useState("loading");
			const [enabled, setEnabled] = react.useState(false);
			const [compact, setCompact] = react.useState(false);
			const [toggles, setToggles] = react.useState({});
			const [busy, setBusy] = react.useState(false);
			const [saved, setSaved] = react.useState(false);
			const [error, setError] = react.useState("");

			react.useEffect(() => {
				let alive = true;
				fetch(CONFIG_URL)
					.then((r) => r.json())
					.then((data) => {
						if (!alive) return;
						if (!data || data.ok !== true || !data.config) {
							setStatus("error");
							return;
						}
						const cfg = data.config;
						setEnabled(!!cfg.enabled);
						setCompact(!!cfg.compact);
						const next = {};
						for (const s of SECTIONS) next[s.key] = !(cfg[s.key] === false);
						setToggles(next);
						setStatus("ready");
					})
					.catch(() => {
						if (alive) setStatus("error");
					});
				return () => { alive = false; };
			}, []);

			if (status === "loading") {
				return jsx("div", { children: L.loading });
			}
			if (status === "error") {
				return jsx("div", { children: L.loadError });
			}

			const save = async () => {
				setBusy(true);
				setSaved(false);
				setError("");
				const config = { enabled: !!enabled, compact: !!compact };
				for (const s of SECTIONS) config[s.key] = !!toggles[s.key];
				try {
					const resp = await fetch(CONFIG_URL, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(config)
					});
					const data = await resp.json();
					if (!resp.ok || !data || data.ok !== true) {
						setError(L.saveError + (data && data.message ? "：" + data.message : ""));
					} else {
						setSaved(true);
					}
				} catch (e) {
					setError(L.saveError + "：" + String((e && e.message) || e));
				} finally {
					setBusy(false);
				}
			};

			return jsxs("div", {
				style: { display: "flex", flexDirection: "column", gap: 12 },
				children: [
					fieldRow(L.enabledLabel, L.enabledHint, jsx("input", {
						type: "checkbox",
						checked: enabled,
						onChange: (e) => setEnabled(e.target.checked)
					})),
					fieldRow(L.compactLabel, L.compactHint, jsx("input", {
						type: "checkbox",
						checked: compact,
						onChange: (e) => setCompact(e.target.checked)
					})),
					jsx("span", { children: L.sectionsLabel }),
					...SECTIONS.map((s) =>
						fieldRow(s.label, s.hint, jsx("input", {
							type: "checkbox",
							checked: !!toggles[s.key],
							onChange: (e) => setToggles((prev) => ({ ...prev, [s.key]: e.target.checked }))
						}))
					),
					jsxs("div", {
						style: { display: "flex", alignItems: "center", gap: 8 },
						children: [
							jsx(Button, {
								variant: "primary",
								size: "sm",
								disabled: busy,
								onClick: save,
								children: busy ? L.saving : L.save
							}),
							saved ? jsx("span", { children: L.saved }) : null
						]
					}),
					error ? jsx("div", { style: { fontSize: 12, opacity: 0.75, color: "#d97757" }, children: error }) : null,
					jsx("div", { style: { fontSize: 12, opacity: 0.6 }, children: L.note })
				]
			});
		}

		function MaoMethodCard() {
			return jsxs("div", {
				style: { display: "flex", flexDirection: "column", gap: 16, padding: 16, maxWidth: 560 },
				children: [
					jsx("h2", { children: L.navSub }),
					jsx(SettingsBlock, {})
				]
			});
		}

		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-mao-method",
				order: 61,
				label: () => L.nav
			}, MaoMethodCard), "@dsh-external/dsh-mao-method: settings section entry"));
		}

		const inject = ["slots"];
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
