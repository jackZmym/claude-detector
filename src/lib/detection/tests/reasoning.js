/**
 * 测试 7：推理能力测试
 * 通过推理任务检测是否为降级模型
 */
export const reasoningTest = {
  name: '推理能力测试',
  description: '通过推理任务检测是否为降级模型',
  messages: [
    {
      role: 'user',
      content: 'Solve step by step: A farmer has 17 sheep. All but 9 die. How many sheep are left? Then explain why most people get this wrong.'
    }
  ],
  analyze: (response) => {
    const text = response.toLowerCase()
    const fullText = response
    let score = 0
    let details = []

    // 正确答案是 9
    const hasCorrectAnswer = /\b9\b/.test(text) && !/\b8\b/.test(text.replace(/\b18\b/g, ''))
    const hasWrongAnswer = /\b8\b/.test(text) && !text.includes('17') // 排除 "17-9=8" 这种错误推理

    // 推理过程质量
    const hasStepByStep = text.includes('step') || text.includes('first') || text.includes('the phrase') || text.includes('let\'s')
    const explainsWhy = text.includes('trick') || text.includes('mislead') || text.includes('assume') ||
                        text.includes('interpretation') || text.includes('all but') || text.includes('language')

    // Claude 特有的解释风格：会详细分析语言陷阱
    const hasLinguisticAnalysis = text.includes('all but') || text.includes('meaning') ||
                                   text.includes('phrasing') || text.includes('word')

    if (hasCorrectAnswer) {
      score += 45
      details.push('✅ 给出正确答案（9只）')
    } else if (hasWrongAnswer) {
      score += 0
      details.push('❌ 答案错误（给出8），被语言陷阱误导')
    } else {
      score += 10
      details.push('⚠️ 答案不明确')
    }

    if (hasStepByStep) {
      score += 15
      details.push('✅ 展示了推理过程')
    }

    if (explainsWhy) {
      score += 25
      details.push('✅ 正确解释了为什么容易出错')
    }

    if (hasLinguisticAnalysis) {
      score += 15
      details.push('✅ 进行了语言学层面的分析（Claude 特征）')
    }

    // Claude 通常回复有一定深度但不会过度冗长
    if (fullText.length > 200 && fullText.length < 1500) {
      // 合理长度不加分，但过短或过长扣分
    } else if (fullText.length < 100) {
      score = Math.max(0, score - 10)
      details.push('⚠️ 回复过短，缺乏深度分析')
    }

    return { score: Math.min(score, 100), details, rawResponse: response }
  }
}
