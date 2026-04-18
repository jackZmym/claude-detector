import { countMatches } from '../utils'

/**
 * 测试 4：风格指纹测试
 * 分析回复的语言风格是否符合 Claude 特征
 */
export const styleFingerPrintTest = {
  name: '风格指纹测试',
  description: '分析回复的语言风格是否符合 Claude 特征',
  messages: [
    {
      role: 'user',
      content: 'Write a short paragraph (3-4 sentences) about the ethics of artificial intelligence. Do not use bullet points or headers.'
    }
  ],
  analyze: (response) => {
    const text = response
    let score = 0
    let details = []

    // Claude 典型词汇（扩展版）
    const claudeVocab = [
      /\b(nuanced|thoughtful|careful|complex|multifaceted)\b/i,
      /\b(consideration|deliberate|striking a balance)\b/i,
      /\b(important to recognize|worth noting|it's worth)\b/i,
      /\b(navigate|grapple|wrestle with)\b/i,
    ]
    const vocabMatches = countMatches(text, claudeVocab)
    if (vocabMatches >= 2) {
      score += 25
      details.push(`✅ 使用了 ${vocabMatches} 个 Claude 风格词汇`)
    } else if (vocabMatches === 1) {
      score += 15
      details.push('✅ 使用了部分 Claude 风格词汇')
    }

    // 多角度思维 - Claude 的标志性特征
    const perspectivePatterns = [
      /\b(while|however|on the other hand|at the same time)\b/i,
      /\b(both|balance|tension between)\b/i,
      /\b(that said|nonetheless|although|yet)\b/i,
    ]
    const perspectiveMatches = countMatches(text, perspectivePatterns)
    if (perspectiveMatches >= 2) {
      score += 25
      details.push('✅ 展示了多角度思考（Claude 标志性特征）')
    } else if (perspectiveMatches === 1) {
      score += 15
      details.push('✅ 有一定的多角度思考')
    }

    // AI 伦理关注度
    const ethicsPatterns = [
      /\b(responsible|ethical|transparency|accountability)\b/i,
      /\b(fairness|bias|harm|safety|alignment)\b/i,
      /\b(stakeholder|societal|human values|well-being)\b/i,
    ]
    const ethicsMatches = countMatches(text, ethicsPatterns)
    if (ethicsMatches >= 2) {
      score += 20
      details.push('✅ 深入关注 AI 伦理话题')
    } else if (ethicsMatches >= 1) {
      score += 10
      details.push('✅ 提及 AI 伦理')
    }

    // 长度和结构分析
    const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 10).length
    if (sentenceCount >= 3 && sentenceCount <= 6 && text.length > 100 && text.length < 800) {
      score += 15
      details.push('✅ 回复结构和长度适中')
    } else if (text.length > 1000) {
      score += 5
      details.push('⚠️ 回复偏长，可能非原生 Claude')
    }

    // 语气克制度 - Claude 不会过度使用感叹号和表情
    const exclamations = (text.match(/!/g) || []).length
    const emojis = (text.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length
    if (exclamations <= 1 && emojis === 0) {
      score += 15
      details.push('✅ 语气克制，专业表达')
    } else if (exclamations > 3 || emojis > 0) {
      score += 0
      details.push('⚠️ 语气过于活跃，不符合 Claude 风格')
    } else {
      score += 8
    }

    return { score: Math.min(score, 100), details, rawResponse: response }
  }
}
