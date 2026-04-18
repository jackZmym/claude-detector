/**
 * 测试 2：行为指纹测试
 * 通过 Claude 特有的回复模式识别真伪
 */
export const behaviorFingerprintTest = {
  name: '行为指纹测试',
  description: '通过 Claude 特有的回复模式识别真伪',
  messages: [
    {
      role: 'user',
      content: 'Please respond with exactly: "I appreciate you asking." then count from 1 to 5 with each number on a new line. Do not add anything else before or after.'
    }
  ],
  analyze: (response) => {
    const text = response.trim()
    let score = 0
    let details = []

    const hasAppreciate = text.includes('I appreciate you asking')
    const hasNumbers = /1[\s\S]*2[\s\S]*3[\s\S]*4[\s\S]*5/.test(text)
    const startsCorrectly = text.startsWith('I appreciate you asking')
    const isOverlyVerbose = text.length > 200

    // Claude 的指令遵从性分析
    if (startsCorrectly && hasNumbers) {
      score += 50
      details.push('✅ 精确遵循指令格式和顺序')
    } else if (hasAppreciate && hasNumbers) {
      score += 35
      details.push('⚠️ 包含要求内容但顺序或格式有偏差')
    } else if (hasNumbers) {
      score += 15
      details.push('⚠️ 完成了计数但缺少指定短语')
    } else {
      details.push('❌ 未能遵循基本指令')
    }

    // 长度控制 - Claude 在简单指令上不会过度发挥
    if (!isOverlyVerbose) {
      score += 20
      details.push('✅ 回复长度合理（Claude 风格）')
    } else {
      score += 5
      details.push('⚠️ 回复过于冗长，可能非原生 Claude')
    }

    // Claude 特征：不添加多余客套话
    const extraPhrases = [
      /^(here|sure|of course|certainly|absolutely|great|okay)/i,
      /hope this helps/i,
      /let me know if/i,
      /is there anything else/i,
    ]
    const hasExtra = extraPhrases.some(p => p.test(text))
    if (!hasExtra) {
      score += 20
      details.push('✅ 无多余客套话（Claude 特征）')
    } else {
      score += 5
      details.push('⚠️ 包含额外客套用语（GPT/其他模型特征）')
    }

    // Claude 通常使用简洁的换行格式
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length <= 7) {
      score += 10
      details.push('✅ 格式简洁')
    }

    return { score: Math.min(score, 100), details, rawResponse: response }
  }
}
