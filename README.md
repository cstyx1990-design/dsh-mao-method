# dsh-mao-method

以《毛泽东选集》方法论（实践论 / 矛盾论 / 论持久战 / 实事求是 / 群众路线）**全局指导 AI 模型工作方式**的 DeepSeek Harness 插件（hybrid：host 提示词注入 + 检索/分析工具 + 浏览器设置页）。

## 它做什么

插件不改变模型能力，而是改变模型**每一步**的输入与可用的工具：

1. **提示词注入层**：每个 agent 创建时（`agent/created`）向 system prompt 追加 5 个方法论节（紧随官方 persona 之后，order 1–5），共 32 条可执行准则。每条准则为「触发条件 + 做法 + 禁忌 + 原文出处」格式，模型每轮生成前都会读到。
2. **工具层**（注册 5 个工具，所有 agent 可见）：
   - `mao_reference` —— 检索语料库（160 篇索引：要点 + 对应准则 + 逐字原文摘录 + 出处）
   - `mao_contradiction_analysis` —— 矛盾分析法框架（《矛盾论》）
   - `mao_practice_review` —— 实践论复盘框架（《实践论》）
   - `mao_protracted_plan` —— 持久战三阶段规划框架（《论持久战》）
   - `mao_investigation` —— 调查研究清单框架（《反对本本主义》）
3. **设置层**：浏览器设置页「毛泽东思想方法论」卡片 —— 总开关 / 精简模式 / 五节独立开关（经插件自身路由 `GET|POST /api/dsh-mao-method/config` 读写，保存后新会话生效）。

## 快速开始

```bash
# 1. 拉取语料全文（可选但推荐，供 mao_reference 原文摘录；不拉则只用内置索引+短引文）
bash scripts/fetch-corpus.sh

# 2. 注入 DSH（超级模组注入器，注入即完整生效 host+client）
#    dev_inject_plugin <本目录>
```

注入后**新建会话**生效；设置页可随时开关，`dev_uninject_plugin dsh-mao-method` 卸载即净。

## 数据

| 文件 | 内容 | 随包分发 |
|---|---|---|
| `data/methodology.json` | 五节 32 条核心准则 + 160 篇卷内索引（要点/覆盖映射/新增准则/逐字短引文与出处） | ✅ |
| `data/corpus/` | 毛选四卷 161 篇全文 + 精选 13 篇（本地检索用） | ❌ 见版权声明，运行 `scripts/fetch-corpus.sh` 获取 |

## 版权声明（重要）

- `data/methodology.json` 中的引文均为**逐字短引（30–90 字）并标注出处**，属著作权法意义上的适当引用，可随包分发。
- `data/corpus/` 为《毛泽东选集》全文（人民出版社整理版本），**尚未进入公有领域**（中国境内自作者逝世后第 50 年、即 2027-01-01 起届满），**不随本仓库/包分发**。全文仅限本地个人检索使用，请自行运行 `scripts/fetch-corpus.sh` 获取；如需引用，请遵守相关法律并标注出处。
- 语料文本来源：https://github.com/lansepeach/maoxuan（毛选 1-7 合集，据人民出版社选集整理）。

## 构建说明

本仓库已提交 `lib/` 构建产物（clone 即用）。重新构建需要 DSH 的 TypeScript 环境：`@deepseek-ai/*` 类型从已部署 DSH 的 `node_modules` 通过 junction 链接到 `node_modules/` 后执行 tsc（详见 `scripts/build.sh`）；client 半边为手写 ModuleLoader bundle（`lib/client.js`），无需额外构建。

## License

BSD-3-Clause（见 LICENSE）。
