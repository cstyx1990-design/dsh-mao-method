/**
 * 类型 shim：app 内发布的 @deepseek-ai 包不含 .d.ts（npm 打包时 types 缺失），
 * 这里只声明本项目用到的导出，保持 host 侧严格编译。
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    on(event: string, listener: (...args: any[]) => void): () => void
    logger?: { info?(msg: string): void; warn?(msg: string): void }
    effect?(callback: () => unknown, label?: string): void
    [key: string]: any
  }
}

declare module '@deepseek-ai/schemastery' {
  const z: any
  export default z
}

declare module '@deepseek-ai/dsh-system-prompt' {
  export const PERSONA_SECTION: string
  export const PERSONA_ORDER: number
  export function renderPrompt(assembly: any): string
}

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(options: any): any
}
