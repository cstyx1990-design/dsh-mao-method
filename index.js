// 包根入口兜底：部分加载器按 <pkgdir>/index.js 解析入口（不读 package.json main）。
// 实际实现在 lib/index.js；导出 { name, inject, Config, apply }。
export * from './lib/index.js'
