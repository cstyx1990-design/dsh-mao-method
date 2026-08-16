/**
 * @dsh-external/dsh-mao-method — 毛泽东思想工作方法论（hybrid 形态 host 半边）
 *
 * 三层设计：
 *  1. 提示词注入层：每个 agent 创建时（agent/created）向 agent 作用域注入方法论提示词节
 *     （systemPrompt.section × 5：实践论/矛盾论/论持久战/实事求是/群众路线），
 *     位于官方 persona 之后（PERSONA_ORDER+1..+5），可独立开关、可精简模式。
 *  2. 工具层：mao_reference 原文检索（四卷全文+精选篇目，返回要点与逐字摘录）
 *     + 四个结构化分析框架工具（矛盾分析/实践复盘/持久战规划/调查研究）。
 *  3. 设置层：settings 命名空间 dsh-mao（总开关 + 精简模式 + 五节开关），
 *     保存后对新创建的会话/agent 生效（与官方 preset 语义一致）。
 *
 * 数据：plugin/data/methodology.json（五节 32 条准则 + 160 条卷内索引）
 *      + plugin/data/corpus/（毛选四卷全文 161 篇 + 精选 13 篇，仅本地检索用）。
 * 全部副作用经 disposer 清理，卸载即净。
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "@dsh-external/dsh-mao-method";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    compact: boolean;
    onPractice: boolean;
    onContradiction: boolean;
    protractedWar: boolean;
    shishiqiushi: boolean;
    massLine: boolean;
}
export declare const Config: any;
type SectionLike = {
    name: string;
    order: number;
    text: string;
};
type SystemPromptLike = {
    section(section: SectionLike): () => void;
};
type SettingsScopeLike = {
    get(): Config;
    watch(callback: (value: Config) => void): void;
};
type SettingsLike = {
    register(namespace: string, schema: unknown, options?: {
        base?: Config;
    }): SettingsScopeLike;
};
type ToolRegistryLike = {
    register(definition: unknown): () => void;
};
type WebServerLike = {
    register(route: {
        kind: string;
        path: string;
        handler: (req: unknown, res: unknown) => void;
    }): () => void;
};
type AppContext = Context & {
    settings: SettingsLike;
    systemPrompt: SystemPromptLike;
    tools: ToolRegistryLike;
    webServer: WebServerLike;
    logger?: {
        info?(msg: string): void;
        warn?(msg: string): void;
    };
};
export declare function apply(ctx: AppContext, config: Config): () => void;
export {};
