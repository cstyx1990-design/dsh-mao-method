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
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { PERSONA_ORDER } from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const name = '@dsh-external/dsh-mao-method'

export const inject = ['settings', 'systemPrompt', 'tools', 'webServer']

export interface Config {
  enabled: boolean
  compact: boolean
  onPractice: boolean
  onContradiction: boolean
  protractedWar: boolean
  shishiqiushi: boolean
  massLine: boolean
}

export const Config = z.object({
  enabled: z.boolean().default(true),
  compact: z.boolean().default(false),
  onPractice: z.boolean().default(true),
  onContradiction: z.boolean().default(true),
  protractedWar: z.boolean().default(true),
  shishiqiushi: z.boolean().default(true),
  massLine: z.boolean().default(true),
})

// ---------------------------------------------------------------------------
// 数据装载
// ---------------------------------------------------------------------------
const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url))
const METHODOLOGY_FILE = join(DATA_DIR, 'methodology.json')

interface MaoSource { work: string; part: string; quote: string }
interface MaoPrinciple { title: string; trigger: string; action: string[]; counter: string; source: MaoSource }
interface MaoSection { section: string; section_title: string; principles: MaoPrinciple[]; key_terms: string[] }
interface MaoEntry { vol: string; file: string; work: string; date: string | null; summary: string; covered: string[]; new_principles: MaoPrinciple[]; key_terms: string[] }
interface MaoData { meta: Record<string, unknown>; sections: MaoSection[]; volume_index: MaoEntry[] }

let maoData: MaoData | null | undefined
function loadMaoData(): MaoData | null {
  if (maoData !== undefined) return maoData
  try {
    maoData = JSON.parse(readFileSync(METHODOLOGY_FILE, 'utf8')) as MaoData
    if (!Array.isArray(maoData.sections) || !Array.isArray(maoData.volume_index)) throw new Error('structure')
  } catch (error) {
    console.warn('[' + name + '] methodology.json 加载失败: ' + String((error && (error as Error).message) || error))
    maoData = null
  }
  return maoData
}

const SECTION_TOGGLES: Record<string, keyof Config> = {
  'on-practice': 'onPractice',
  'on-contradiction': 'onContradiction',
  'protracted-war': 'protractedWar',
  'shishiqiushi': 'shishiqiushi',
  'mass-line': 'massLine',
}

const SECTION_NAMES: Record<string, string> = {
  'on-practice': '实践论',
  'on-contradiction': '矛盾论',
  'protracted-war': '论持久战',
  'shishiqiushi': '实事求是',
  'mass-line': '群众路线',
}

function renderSection(s: MaoSection, compact: boolean): string {
  const lines: string[] = ['## ' + s.section_title, '']
  if (compact) {
    s.principles.forEach((p, i) => {
      lines.push((i + 1) + '. 【' + p.title + '】' + p.trigger)
    })
  } else {
    s.principles.forEach((p, i) => {
      lines.push((i + 1) + '. 【' + p.title + '】触发：' + p.trigger + '。做法：' + p.action.join('；') + '。禁忌：' + p.counter + '。')
      lines.push('　（出处：' + p.source.work + '·' + p.source.part + '）')
      lines.push('')
    })
  }
  lines.push('如需引用原文或查证其他篇目，调用 mao_reference 检索工具。')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 检索工具内部实现
// ---------------------------------------------------------------------------
function corpusPath(e: MaoEntry): string {
  return e.vol === 'core' ? join(DATA_DIR, 'corpus', e.file) : join(DATA_DIR, 'corpus', e.vol, e.file)
}

function volLabel(vol: string): string {
  if (vol === 'core') return '选集外'
  const n = Number(vol.slice(1))
  return Number.isFinite(n) ? '第' + '一二三四'[n - 1] + '卷' : vol
}

/** 在篇目全文里定位第一个命中词，返回带上下文的摘录（去空白，≤140 字）。 */
function extractExcerpt(e: MaoEntry, terms: string[]): { text: string } | null {
  try {
    const p = corpusPath(e)
    if (!existsSync(p)) return null
    const text = readFileSync(p, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (terms.some((t) => lines[i].includes(t))) {
        const start = Math.max(0, i - 1)
        const end = Math.min(lines.length - 1, i + 1)
        let ctx = lines.slice(start, end + 1).join('').replace(/\s+/g, '')
        if (ctx.length > 140) ctx = ctx.slice(0, 140) + '……'
        return { text: ctx }
      }
    }
    return null
  } catch {
    return null
  }
}

function buildReferenceReport(query: string, limit: number): string {
  const data = loadMaoData()
  if (!data) return '语料库未加载（methodology.json 读取失败）。'
  const q = String(query || '').trim()
  if (!q) return '请提供检索词。'
  const terms = q.split(/[\s,，、;；]+/).filter(Boolean)
  const scored: { e: MaoEntry; score: number }[] = []
  for (const e of data.volume_index) {
    const hay = [e.work, e.summary, (e.key_terms || []).join(' '), (e.new_principles || []).map((p) => p.title).join(' ')].join(' ')
    let score = 0
    for (const t of terms) {
      if (hay.includes(t)) score += t.length > 2 ? 2 : 1
    }
    if (score > 0) scored.push({ e, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit)
  if (top.length === 0) {
    return '语料库中未找到与「' + q + '」相关的篇目，可尝试更常见的方法论词汇（如：主要矛盾、调查研究、持久战、实事求是、群众）。'
  }
  const parts: string[] = []
  for (const { e } of top) {
    parts.push('【' + e.work + '】（' + volLabel(e.vol) + (e.date ? '，' + e.date : '') + '）')
    parts.push('要点：' + e.summary)
    if (e.covered && e.covered.length > 0) parts.push('对应核心准则：' + e.covered.join('、'))
    const excerpt = extractExcerpt(e, terms)
    if (excerpt) parts.push('原文摘录：' + excerpt.text)
    parts.push('')
  }
  parts.push('（出处按《毛泽东选集》四卷本标注；引用时请标注篇名，勿扩大出处范围。）')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// 工具注册
// ---------------------------------------------------------------------------
function registerTools(ctx: AppContext, disposers: Array<() => void>): void {
  disposers.push(ctx.tools.register(defineTool({
    name: 'mao_reference',
    description: '检索《毛泽东选集》语料库（四卷全文+精选篇目，160 篇索引）：按主题词找到相关篇目，返回要点、对应准则与原文摘录（含出处），用于引用原文、核验方法论依据。',
    parameters: {
      query: { type: 'string', required: true, description: '检索主题词或短语，如「主要矛盾」「调查研究」「持久战」「群众路线」' },
      limit: { type: 'number', description: '最多返回的篇目数（默认 3，最大 6）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { content: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: { content: string }) => [{ type: 'text' as const, text: value.content }],
    },
    isConcurrencySafe: () => true,
    async execute(args: { query: string; limit?: number }) {
      const limit = Math.min(Math.max(Number(args.limit) || 3, 1), 6)
      return { content: buildReferenceReport(String(args.query || ''), limit) }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'mao_contradiction_analysis',
    description: '矛盾分析法（《矛盾论》1937）：对复杂问题/多目标/多约束任务做结构化矛盾分析——列矛盾清单、抓主要矛盾、看矛盾主要方面、找转化条件、定行动优先序。',
    parameters: {
      problem: { type: 'string', required: true, description: '要分析的问题或目标，尽量写清现状与约束' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { content: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: { content: string }) => [{ type: 'text' as const, text: value.content }],
    },
    isConcurrencySafe: () => true,
    async execute(args: { problem: string }) {
      const problem = String(args.problem || '').trim() || '（未提供问题描述）'
      return {
        content: '请对「' + problem + '」按《矛盾论》矛盾分析法输出以下结构：\n\n'
          + '一、矛盾清单：列出该问题涉及的全部矛盾（约束、风险、利益冲突、需求冲突）\n'
          + '二、主要矛盾：起领导、决定作用的那一个；其余为次要矛盾，说明各自与主要矛盾「规定或影响」的关系\n'
          + '三、矛盾的主要方面：决定问题性质的一方（本质/主流），及其与次要方面互相转化的条件\n'
          + '四、行动优先序：集中资源先解决什么、其次什么；外部条件变化后如何重新判断主次\n'
          + '五、禁忌检查：是否平均用力、如堕烟海？是否把主次判断当成一成不变？是否以支流代替主流？\n\n'
          + '（依据：《矛盾论》「四 主要的矛盾和主要的矛盾方面」；可用 mao_reference 检索原文核验）',
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'mao_practice_review',
    description: '实践论复盘（《实践论》1937）：任务失败/结果不符预期/一轮迭代结束时，按「实践—认识—再实践」闭环复盘——区分假设与事实、找认识错误、定下一轮验证计划。',
    parameters: {
      plan: { type: 'string', required: true, description: '原方案/原认识（含曾明确或隐含的假设）' },
      result: { type: 'string', required: true, description: '实际结果：成功/失败/部分符合，附关键事实' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { content: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: { content: string }) => [{ type: 'text' as const, text: value.content }],
    },
    isConcurrencySafe: () => true,
    async execute(args: { plan: string; result: string }) {
      return {
        content: '请对以下实践做复盘（实践论闭环）：\n'
          + '原方案/假设：' + String(args.plan || '') + '\n'
          + '实际结果：' + String(args.result || '') + '\n\n'
          + '输出：\n'
          + '一、事实与推断分离：哪些是实际发生的（事实），哪些只是你的推断/预期（推断）\n'
          + '二、认识检验：原方案中的哪些认识被证实、哪些被证伪？不符的原因是什么（思想与客观规律何处不相合）\n'
          + '三、教训沉淀：本次失败的教训（吃一堑长一智），写成可复用的错误清单条目\n'
          + '四、下一轮：改正后的方案 + 这一轮要验证的假设 + 验证方法（再实践）\n'
          + '五、禁忌检查：是否原样重试不分析原因？是否把失败全归咎外部而拒绝改正自己的思想？',
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'mao_protracted_plan',
    description: '持久战三阶段规划（《论持久战》1938）：面向长期目标（数月以上）、当前力量不足的任务，输出战略防御/战略相持/战略反攻三阶段路线图、当前阶段判断与小胜里程碑。',
    parameters: {
      goal: { type: 'string', required: true, description: '长期目标' },
      constraints: { type: 'string', description: '现状与约束：现有资源、缺口、时间压力等' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { content: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: { content: string }) => [{ type: 'text' as const, text: value.content }],
    },
    isConcurrencySafe: () => true,
    async execute(args: { goal: string; constraints?: string }) {
      return {
        content: '请对目标「' + String(args.goal || '') + '」做持久战式三阶段规划'
          + (args.constraints ? '（现状与约束：' + String(args.constraints) + '）' : '') + '：\n\n'
          + '一、双极端同斥检查：先拒绝「很快就能成、无需费大力」的速胜论与「根本做不成」的悲观论；判断依据必须是条件分析\n'
          + '二、阶段划分：\n'
          + '　第一阶段（战略防御）：守住基本盘、摸清现状、建立基础——当前的主要任务是什么\n'
          + '　第二阶段（战略相持）：最困难期，持续积累力量、准备反攻（枢纽阶段）——小步多点推进、积小胜为大胜\n'
          + '　第三阶段（战略反攻）：条件成熟后集中优势达成目标——总攻的触发条件是什么\n'
          + '三、当前阶段判断：现在处于哪一阶段？判断依据（力量对比的实际变化）是什么\n'
          + '四、小胜里程碑：每阶段 2-3 个可度量的阶段性成果（不在一城一地之得失，局部取舍服从全局）\n'
          + '五、计划性：阶段轮廓随情况修改，但不朝令夕改（相对固定的计划）\n'
          + '六、禁忌检查：是否想跳过相持期直达反攻？是否孤注一掷搞无把握的决战？',
      }
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'mao_investigation',
    description: '调查研究清单（《反对本本主义》1930 等）：对尚无把握的问题先调查再发言——列出事实清单、信息缺口、需验证的假设与最小验证实验，禁止凭印象下结论。',
    parameters: {
      topic: { type: 'string', required: true, description: '待调查的问题/待决策事项' },
      known: { type: 'string', description: '目前已知的信息（可选）' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { content: { type: 'string', required: true } },
      },
      render: (_args: unknown, value: { content: string }) => [{ type: 'text' as const, text: value.content }],
    },
    isConcurrencySafe: () => true,
    async execute(args: { topic: string; known?: string }) {
      return {
        content: '对「' + String(args.topic || '') + '」先调查再发言。'
          + (args.known ? '\n已知信息：' + String(args.known) : '') + '\n\n'
          + '请输出：\n'
          + '一、结论状态声明：在调查完成前，不给出确定性结论；材料不足处明确标注「待验证」\n'
          + '二、事实清单：需要查清的现实情况与历史情况（现状、来源、相关方、数据）\n'
          + '三、信息缺口：哪些是二手转述/未证实？哪些只能通过亲自运行、复现、实验获得（直接经验）\n'
          + '四、最小验证：用最小的实验/调查动作验证关键假设（读代码、跑测试、查数据、问相关方）\n'
          + '五、调查方法：到「现场」去（真实环境、一手数据、多方听取），不满足于道听途说\n'
          + '六、禁忌检查：是否在零碎材料上强下结论？是否把二手转述当已证实事实？是否闭门造车「想办法」？',
      }
    },
  })))
}

// ---------------------------------------------------------------------------
// 状态路由（回环地址限定，供设置页/调试）
// ---------------------------------------------------------------------------
function isLoopback(req: { socket?: { remoteAddress?: string } }): boolean {
  const ra = req.socket && req.socket.remoteAddress
  return ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1'
}

function sendJson(res: { writeHead(status: number, headers: Record<string, string>): void; end(data: string | Uint8Array): void }, status: number, body: unknown): void {
  const data = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(data.length),
  })
  res.end(data)
}

/** 读取请求体并解析为 JSON 对象（解析失败返回空对象）。 */
function readJsonBody(req: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const r = req as { on(event: string, listener: (chunk: Buffer) => void): unknown }
    const chunks: Buffer[] = []
    r.on('data', (chunk) => chunks.push(chunk))
    r.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        const parsed = raw ? JSON.parse(raw) : {}
        resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {})
      } catch {
        resolve({})
      }
    })
  })
}

// ---------------------------------------------------------------------------
// 类型（最小结构化声明，避免引入未链接的包）
// ---------------------------------------------------------------------------
type SectionLike = { name: string; order: number; text: string }
type SystemPromptLike = { section(section: SectionLike): () => void }
type AgentLike = { ctx: { systemPrompt?: SystemPromptLike } }

type SettingsScopeLike = {
  get(): Config
  watch(callback: (value: Config) => void): void
}
type SettingsLike = { register(namespace: string, schema: unknown, options?: { base?: Config }): SettingsScopeLike }

type ToolRegistryLike = { register(definition: unknown): () => void }
type WebServerLike = {
  register(route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }): () => void
}

type AppContext = Context & {
  settings: SettingsLike
  systemPrompt: SystemPromptLike
  tools: ToolRegistryLike
  webServer: WebServerLike
  logger?: { info?(msg: string): void; warn?(msg: string): void }
}

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------
export function apply(ctx: AppContext, config: Config): () => void {
  const disposers: Array<() => void> = []
  let liveConfig = (): Config => config || ({} as Config)
  let injectedAgents = 0
  let settingsScopeRef: { update(patch: Record<string, unknown>): Promise<unknown> } | null = null

  // 设置命名空间（存储配置非法时降级为组合配置，不阻断启动）
  try {
    const scope = ctx.settings.register('dsh-mao', Config, { base: config || {} })
    liveConfig = () => scope.get()
    settingsScopeRef = scope as unknown as { update(patch: Record<string, unknown>): Promise<unknown> }
    scope.watch(() => {
      const cfg = liveConfig() || ({} as Config)
      ctx.logger?.info?.('[' + name + '] settings updated: ' + JSON.stringify({ enabled: cfg.enabled, compact: cfg.compact }))
    })
  } catch (error) {
    ctx.logger?.warn?.('[' + name + '] settings section unavailable: ' + String((error && (error as Error).message) || error))
  }

  // 每个 agent 创建时注入方法论节（随 agent 纤维自动销毁，无泄漏）
  ctx.on('agent/created', (payload: { agent: AgentLike }) => {
    const cfg = liveConfig()
    const data = loadMaoData()
    if (!cfg.enabled || !data) return
    const toggles = cfg as unknown as Record<string, unknown>
    data.sections.forEach((s, i) => {
      const key = SECTION_TOGGLES[s.section]
      if (key && toggles[key] === false) return
      try {
        payload.agent.ctx.systemPrompt?.section({
          name: 'mao:' + s.section,
          order: PERSONA_ORDER + 1 + i,
          text: renderSection(s, !!cfg.compact),
        })
      } catch (error) {
        ctx.logger?.warn?.('[' + name + '] section ' + s.section + ' 注入失败: ' + String((error && (error as Error).message) || error))
      }
    })
    injectedAgents += 1
    ctx.logger?.info?.('[' + name + '] 已向 agent 注入方法论节（第 ' + injectedAgents + ' 个）')
  })

  // 工具注册
  registerTools(ctx, disposers)

  // 状态路由
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-mao-method/status',
    handler: (req, res) => {
      if (!isLoopback(req as { socket?: { remoteAddress?: string } })) {
        ;(res as { writeHead(status: number): void; end(data: string): void }).writeHead(403)
        ;(res as { writeHead(status: number): void; end(data: string): void }).end('forbidden')
        return
      }
      const data = loadMaoData()
      const cfg = liveConfig()
      sendJson(res as { writeHead(status: number, headers: Record<string, string>): void; end(data: string): void }, 200, {
        ok: true,
        plugin: name,
        enabled: !!cfg.enabled,
        compact: !!cfg.compact,
        sections: data
          ? data.sections.map((s) => ({
              id: s.section,
              title: SECTION_NAMES[s.section] || s.section,
              principles: s.principles.length,
              enabled: !((cfg as unknown as Record<string, unknown>)[SECTION_TOGGLES[s.section]] === false),
            }))
          : [],
        volume_index: data ? data.volume_index.length : 0,
        injected_agents: injectedAgents,
        tools: ['mao_reference', 'mao_contradiction_analysis', 'mao_practice_review', 'mao_protracted_plan', 'mao_investigation'],
      })
    },
  }))

  // 配置读写路由：client 设置页经此路由读写（不经 apiProxy 的命名空间暴露白名单）
  // ——apiProxy 的 WEB_SETTINGS_NAMESPACES 为部署硬编码，插件命名空间默认不对浏览器暴露。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-mao-method/config',
    handler: (req, res) => {
      const rr = req as { method?: string; socket?: { remoteAddress?: string } }
      const send = (status: number, body: unknown) => sendJson(res as { writeHead(status: number, headers: Record<string, string>): void; end(data: string | Uint8Array): void }, status, body)
      if (!isLoopback(rr)) {
        ;(res as { writeHead(status: number): void; end(data: string): void }).writeHead(403)
        ;(res as { writeHead(status: number): void; end(data: string): void }).end('forbidden')
        return
      }
      if (rr.method === 'GET') {
        send(200, { ok: true, config: liveConfig() })
        return
      }
      if (rr.method === 'POST') {
        void (async () => {
          const patch = await readJsonBody(req)
          if (!settingsScopeRef) {
            send(500, { ok: false, message: 'settings scope unavailable（host 注册失败）' })
            return
          }
          try {
            await settingsScopeRef.update(patch)
            send(200, { ok: true, config: liveConfig() })
          } catch (error) {
            send(400, { ok: false, message: String((error && (error as Error).message) || error) })
          }
        })()
        return
      }
      send(405, { ok: false, message: 'method not allowed' })
    },
  }))

  ctx.logger?.info?.('[' + name + '] 已启动（方法论节注入 + 5 工具 + 设置 dsh-mao）')

  return () => {
    for (const d of disposers) {
      try { d() } catch { /* 忽略清理错误 */ }
    }
  }
}
