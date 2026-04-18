/**
 * 测试 8：多语言切换测试
 * 测试模型的多语言切换能力是否与 Claude 一致
 */
export const multilingualTest = {
  name: '多语言能力测试',
  description: '测试模型的多语言切换能力是否与 Claude 一致',
  messages: [
    {
      role: 'user',
      content: '请用中文回答：你是什么模型？然后用日语说"我是AI助手"。最后用英文总结你的能力。每个语言各一句话。'
    }
  ],
  analyze: (response) => {
    const text = response
    const lowerText = text.toLowerCase()
    let score = 0
    let details = []

    // 检查语言存在性
    const hasChinese = /[\u4e00-\u9fa5]{3,}/.test(text) // 至少3个连续中文字符
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]{2,}/.test(text) // 至少2个日语字符
    const hasEnglish = /[a-zA-Z]{5,}/.test(text)
    const mentionsClaude = lowerText.includes('claude')

    if (hasChinese) {
      score += 20
      details.push('✅ 包含中文回复')
    } else {
      details.push('❌ 缺少中文回复')
    }

    if (hasJapanese) {
      score += 20
      details.push('✅ 包含日语回复')
    } else {
      // 检查是否用了罗马音替代
      if (lowerText.includes('watashi') || lowerText.includes('ai asistanto')) {
        score += 10
        details.push('⚠️ 使用罗马音而非日语字符')
      } else {
        details.push('❌ 缺少日语回复')
      }
    }

    if (hasEnglish) {
      score += 20
      details.push('✅ 包含英文回复')
    } else {
      details.push('❌ 缺少英文回复')
    }

    if (mentionsClaude) {
      score += 25
      details.push('✅ 在多语言环境中正确识别自身为 Claude')
    } else {
      score += 0
      details.push('⚠️ 未在多语言回复中提及 Claude')
    }

    // Claude 的多语言切换通常流畅且格式清晰
    const hasCleanSeparation = text.includes('\n') && (hasChinese && hasJapanese && hasEnglish)
    if (hasCleanSeparation) {
      score += 15
      details.push('✅ 多语言切换流畅，格式清晰')
    }

    return { score: Math.min(score, 100), details, rawResponse: response }
  }
}
