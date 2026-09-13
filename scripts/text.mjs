// 共享文本工具：敏感话题过滤、台湾表述规范化、标题哈希
import { createHash } from 'node:crypto'

// 强制过滤：敏感话题关键词
// 优先从环境变量 SENSITIVE_KEYWORDS 读取（逗号或换行分隔），未配置时用内置默认表
const DEFAULT_SENSITIVE = []

const envList = (process.env.SENSITIVE_KEYWORDS ?? '')
  .split(/[,\n]/)
  .map(s => s.trim())
  .filter(Boolean)

export const SENSITIVE_KEYWORDS = envList.length ? envList : DEFAULT_SENSITIVE

export const isSensitive = t => {
  const s = t.toLowerCase()
  return SENSITIVE_KEYWORDS.some(k => s.includes(k.toLowerCase()))
}

// "台湾"（前缀非"中国"时）→ "中国台湾"
export const normalizeTaiwan = t => t.replace(/(?<!中国)台湾/g, '中国台湾')

/** 标题哈希（去重 + 详述页 slug） */
export const hash12 = t => createHash('sha1').update(t).digest('hex').slice(0, 12)
