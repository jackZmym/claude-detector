/**
 * 测试 3：知识边界测试
 * 测试模型的知识截止日期是否与 Claude 一致
 */
export const knowledgeBoundaryTest = {
  name: '知识边界测试',
  description: '测试模型的知识截止日期是否与 Claude 一致',
  messages: [
    {
      role: 'user',
      content: 'What is your training data cutoff date? Answer in one short sentence with the specific date or time period. Do not hedge or speculate.'
    }
  ],
  // 注意：保留 requestedModel 形参以兼容调用方（虽当前未使用，可用于按模型版本精细化判定）
  analyze: (response, requestedModel) => {
    const text = response.toLowerCase()
    let score = 0
    let details = []

    // 所有可能的 Claude 截止日期
    const allClaudeDates = [
      '2025', '2024', 'early 2025', 'february 2025', 'march 2025',
      'april 2025', 'early 2024', 'april 2024', 'late 2024'
    ]

    // GPT 系列截止日期
    const gptDates = [
      'september 2021', 'january 2022', 'april 2023',
      'december 2023', 'october 2023', 'april 2024'
    ]

    // DeepSeek/其他模型特征日期
    const otherDates = ['january 2024', 'june 2024']

    const matchesClaude = allClaudeDates.some(d => text.includes(d))
    const matchesGPT = gptDates.some(d => text.includes(d))
    const matchesOther = otherDates.some(d => text.includes(d))

    if (matchesClaude && !matchesGPT) {
      score = 90
      details.push('✅ 知识截止日期与 Claude 模型一致')
    } else if (matchesGPT) {
      score = 5
      details.push('❌ 知识截止日期明确指向 GPT 模型')
    } else if (matchesOther) {
      score = 15
      details.push('❌ 知识截止日期不匹配 Claude')
    } else {
      score = 40
      details.push('⚠️ 无法确定知识截止日期是否匹配')
    }

    // Claude 的不确定性表达特征
    const uncertaintyPhrases = [
      'not entirely sure', 'approximately', 'around', 'roughly',
      'i believe', 'if i recall', 'to my knowledge'
    ]
    const hasUncertainty = uncertaintyPhrases.some(p => text.includes(p))
    if (hasUncertainty) {
      score = Math.min(100, score + 10)
      details.push('✅ 表达了适度不确定性（Claude 特征）')
    }

    // 反模式：过度自信地给出错误日期
    if (!matchesClaude && !hasUncertainty && text.length < 100) {
      score = Math.max(0, score - 10)
      details.push('⚠️ 自信地给出非 Claude 日期，可疑')
    }

    return { score: Math.min(score, 100), details, rawResponse: response }
  }
}
