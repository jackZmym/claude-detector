/**
 * 测试 1：身份认知测试
 * 测试模型是否正确认知自己为 Claude
 */
export const identityTest = {
  name: '身份认知测试',
  description: '测试模型是否正确认知自己为 Claude',
  messages: [
    {
      role: 'user',
      content: 'What is your name? Who made you? What version are you? Answer in exactly two sentences.'
    }
  ],
  analyze: (response) => {
    const text = response.toLowerCase()
    let score = 0
    let details = []

    // Claude 身份关键词
    const hasClaude = text.includes('claude')
    const hasAnthropic = text.includes('anthropic')

    // 版本号识别 - Claude 4/Sonnet 4/Opus 4
    const hasVersion = /claude\s*(4|3\.7|3\.5|sonnet|opus|haiku)/i.test(text)

    // 竞品伪装检测 - 扩展更多模型
    const fakeIdentity = {
      openai: text.includes('openai') || text.includes('gpt') || text.includes('chatgpt'),
      google: text.includes('google') || text.includes('gemini') || text.includes('bard'),
      meta: text.includes('meta') || text.includes('llama'),
      deepseek: text.includes('deepseek'),
      mistral: text.includes('mistral'),
      qwen: text.includes('qwen') || text.includes('tongyi') || text.includes('通义'),
      baichuan: text.includes('baichuan') || text.includes('百川'),
      zhipu: text.includes('zhipu') || text.includes('glm') || text.includes('智谱'),
      moonshot: text.includes('moonshot') || text.includes('kimi'),
    }

    const isFake = Object.values(fakeIdentity).some(v => v)
    const fakeNames = Object.entries(fakeIdentity)
      .filter(([, v]) => v)
      .map(([k]) => k)

    if (hasClaude && hasAnthropic) {
      score = hasVersion ? 100 : 95
      details.push('✅ 正确识别自己为 Anthropic 的 Claude')
      if (hasVersion) details.push('✅ 准确说明了版本信息')
    } else if (hasClaude && !isFake) {
      score = 80
      details.push('⚠️ 提到 Claude 但未提及 Anthropic')
    } else if (isFake) {
      score = 0
      details.push(`❌ 声称自己是 ${fakeNames.join('/')} 的模型，非 Claude`)
    } else if (text.includes('ai assistant') || text.includes('language model')) {
      // 模糊回答 - 可能被 system prompt 覆盖了身份
      score = 25
      details.push('⚠️ 使用模糊身份描述，可能被系统提示覆盖了真实身份')
    } else {
      score = 15
      details.push('⚠️ 未明确声明身份，高度可疑')
    }

    // 额外扣分：回复过长说明可能在解释/掩饰
    if (text.length > 500) {
      score = Math.max(0, score - 10)
      details.push('⚠️ 身份回答过于冗长，真 Claude 通常简洁作答')
    }

    return { score, details, rawResponse: response }
  }
}
