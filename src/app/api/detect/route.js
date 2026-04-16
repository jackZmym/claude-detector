import { NextResponse } from 'next/server'

// 安全：禁止缓存此路由
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * 核心检测 API v2.2
 * 
 * 支持两种 API 格式：
 * 1. OpenAI 兼容格式: POST /v1/chat/completions (NewAPI/OneAPI/Apertis 等)
 * 2. Anthropic 原生格式: POST /v1/messages (aicodewith.com CLI 端点等)
 * 
 * 自动探测逻辑：
 * - 先尝试 OpenAI 格式
 * - 如果返回"模型不存在/路径不支持"，自动降级到 Anthropic 格式
 * - 前端无需感知，后端自动适配
 */

const REQUEST_TIMEOUT = 30000
const MAX_CONCURRENCY = 3
const MAX_RETRIES = 1
const RETRY_DELAY = 2000

// API 格式枚举
const API_FORMAT = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 判断错误是否为 "模型/路径不存在" 类错误
 */
function isModelOrPathNotFound(status, errText) {
  const text = errText.toLowerCase()
  return (
    text.includes('不存在') ||
    text.includes('未上线') ||
    text.includes('not found') ||
    text.includes('not exist') ||
    text.includes('does not exist') ||
    text.includes('model_not_found') ||
    text.includes('invalid_model') ||
    text.includes('不支持的请求路径') ||
    text.includes('unsupported') ||
    (status === 404) ||
    (status === 400 && (text.includes('模型') || text.includes('model')))
  )
}

// ==================== OpenAI 格式请求 ====================
function buildOpenAIRequest(url, apiKey, model, messages) {
  return {
    url: `${url}/chat/completions`,
    options: {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    },
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage || {},
      responseModel: data.model || '',
      finishReason: data.choices?.[0]?.finish_reason || '',
    }),
  }
}

// ==================== Anthropic 格式请求 ====================
function buildAnthropicRequest(url, apiKey, model, messages) {
  // Anthropic 格式不允许 system role 在 messages 里，需要提取出来
  const systemMessages = messages.filter(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system')
  
  const body = {
    model,
    messages: userMessages,
    max_tokens: 1024,
    temperature: 0.3,
  }
  
  // system 消息单独放
  if (systemMessages.length > 0) {
    body.system = systemMessages.map(m => m.content).join('\n')
  }

  return {
    url: `${url}/messages`,
    options: {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        // 部分中转站同时接受 Bearer token
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    parseResponse: (data) => {
      // Anthropic 响应格式: { content: [{type: "text", text: "..."}], model, usage, stop_reason }
      let content = ''
      if (Array.isArray(data.content)) {
        content = data.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('')
      } else if (typeof data.content === 'string') {
        content = data.content
      }

      return {
        content,
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        responseModel: data.model || '',
        finishReason: data.stop_reason || '',
      }
    },
  }
}

/**
 * 执行单个测试（支持 OpenAI/Anthropic 双格式）
 */
async function executeTest(url, apiKey, model, test, apiFormat, retries = MAX_RETRIES) {
  const testStart = Date.now()
  
  const reqBuilder = apiFormat === API_FORMAT.ANTHROPIC
    ? buildAnthropicRequest
    : buildOpenAIRequest

  const req = reqBuilder(url, apiKey, model, test.messages)

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(req.url, req.options)

      if (!response.ok) {
        const errText = await response.text()

        // 429/5xx 可重试
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)))
          continue
        }

        return {
          name: test.name,
          description: test.description,
          score: 0,
          details: [`❌ API 请求失败: ${response.status} - ${errText.substring(0, 200)}`],
          rawResponse: errText,
          latency: Date.now() - testStart,
          error: true,
          retries: attempt,
        }
      }

      const data = await response.json()
      const parsed = req.parseResponse(data)

      // 模型名称不一致检测
      const modelMismatch = parsed.responseModel &&
        parsed.responseModel.toLowerCase() !== model.toLowerCase() &&
        !parsed.responseModel.toLowerCase().includes('claude')

      return {
        name: test.name,
        description: test.description,
        rawResponse: parsed.content,
        latency: Date.now() - testStart,
        usage: parsed.usage,
        responseModel: parsed.responseModel,
        modelMismatch,
        finishReason: parsed.finishReason,
        error: false,
        retries: attempt,
      }
    } catch (err) {
      if (attempt < retries && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)))
        continue
      }

      return {
        name: test.name,
        description: test.description,
        score: 0,
        details: [`❌ 请求异常: ${err.name === 'AbortError' ? '请求超时' : err.message}`],
        rawResponse: '',
        latency: Date.now() - testStart,
        error: true,
        retries: attempt,
      }
    }
  }
}

/**
 * 限制并发的批量执行
 */
async function executeTestsWithConcurrency(url, apiKey, model, tests, apiFormat, concurrency = MAX_CONCURRENCY) {
  const results = new Array(tests.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tests.length) {
      const index = nextIndex++
      results[index] = await executeTest(url, apiKey, model, tests[index], apiFormat)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tests.length) },
    () => worker()
  )

  await Promise.all(workers)
  return results
}

/**
 * 自动探测 API 格式
 * 
 * 1. 先试 OpenAI /v1/chat/completions
 * 2. 如果失败（模型不存在/路径不支持），试 Anthropic /v1/messages
 * 3. 返回可用的格式和探测结果
 */
async function detectApiFormat(url, apiKey, model) {
  // 第一步：试 OpenAI 格式
  try {
    const req = buildOpenAIRequest(url, apiKey, model, [{ role: 'user', content: 'hi' }])
    // 用较小的 max_tokens 节省探测开销
    const body = JSON.parse(req.options.body)
    body.max_tokens = 5
    req.options.body = JSON.stringify(body)

    const response = await fetchWithTimeout(req.url, req.options, 15000)

    if (response.ok) {
      return { format: API_FORMAT.OPENAI, valid: true }
    }

    const errText = await response.text()

    // 认证失败 → 直接报错
    if (response.status === 401 || response.status === 403) {
      return { valid: false, fatal: true, error: 'API Key 无效或无权限' }
    }

    // 不是模型/路径问题 → 认为 OpenAI 格式可用（可能是其他临时错误）
    if (!isModelOrPathNotFound(response.status, errText)) {
      return { format: API_FORMAT.OPENAI, valid: true }
    }
  } catch {
    // 网络错误，继续尝试 Anthropic
  }

  // 第二步：试 Anthropic 格式
  try {
    const req = buildAnthropicRequest(url, apiKey, model, [{ role: 'user', content: 'hi' }])
    const body = JSON.parse(req.options.body)
    body.max_tokens = 5
    req.options.body = JSON.stringify(body)

    const response = await fetchWithTimeout(req.url, req.options, 15000)

    if (response.ok) {
      return { format: API_FORMAT.ANTHROPIC, valid: true }
    }

    const errText = await response.text()

    if (response.status === 401 || response.status === 403) {
      return { valid: false, fatal: true, error: 'API Key 无效或无权限' }
    }

    // Anthropic 也报模型不存在
    if (isModelOrPathNotFound(response.status, errText)) {
      // 两种格式都不行 → 获取可用模型建议
      let suggestions = []
      try {
        const modelsRes = await fetchWithTimeout(`${url}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }, 10000)

        if (modelsRes.ok) {
          const modelsData = await modelsRes.json()
          const allModels = modelsData.data || modelsData || []
          if (Array.isArray(allModels)) {
            const claudeKeywords = ['claude', 'sonnet', 'opus', 'haiku']
            suggestions = allModels
              .map(m => m.id || m.name || m)
              .filter(id => claudeKeywords.some(k => String(id).toLowerCase().includes(k)))
              .slice(0, 15)
          }
        }
      } catch { /* ignore */ }

      return {
        valid: false,
        fatal: true,
        error: `模型 "${model}" 在该平台不可用（已尝试 OpenAI 和 Anthropic 两种接口格式）`,
        suggestions,
      }
    }

    // Anthropic 格式有响应但非模型问题，认为可用
    return { format: API_FORMAT.ANTHROPIC, valid: true }
  } catch {
    // 两种都失败
  }

  return {
    valid: false,
    fatal: true,
    error: '无法连接到该平台（OpenAI 和 Anthropic 格式均失败）。请检查 Base URL 是否正确。',
    suggestions: [],
  }
}

// ==================== 主入口 ====================
export async function POST(request) {
  let apiKey = null
  try {
    const body = await request.json()
    const { baseUrl, model, tests } = body
    apiKey = body.apiKey

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { error: '请提供 Base URL、API Key 和模型名称' },
        { status: 400 }
      )
    }

    // 规范化 baseUrl
    let url = baseUrl.replace(/\/+$/, '')
    if (!url.endsWith('/v1')) {
      url += '/v1'
    }

    // ==================== 自动探测 API 格式 ====================
    const detection = await detectApiFormat(url, apiKey, model)

    if (!detection.valid && detection.fatal) {
      const suggestionsText = detection.suggestions?.length > 0
        ? `\n\n该平台可用的 Claude 模型：\n${detection.suggestions.map(s => `  • ${s}`).join('\n')}\n\n请切换到「手动输入」模式选择上述模型，或使用「自动获取」拉取模型列表。`
        : '\n\n请先使用「自动获取」功能查看该平台支持的模型列表，或切换到「手动输入」选择正确的模型名。'

      return NextResponse.json(
        {
          error: detection.error + suggestionsText,
          modelNotFound: true,
          suggestions: detection.suggestions || [],
        },
        { status: 400 }
      )
    }

    const apiFormat = detection.format
    const startTime = Date.now()

    // 并行执行测试（带并发限制）
    const results = await executeTestsWithConcurrency(url, apiKey, model, tests, apiFormat)

    const totalLatency = Date.now() - startTime

    // ==================== 额外信号检测 ====================
    const extraSignals = []

    // 0. 告知使用的 API 格式
    if (apiFormat === API_FORMAT.ANTHROPIC) {
      extraSignals.push({
        type: 'info',
        message: '已自动使用 Anthropic Messages API 格式（该平台为 CLI 端点）',
      })
    }

    // 1. 模型字段一致性
    const responseModels = results
      .filter(r => r.responseModel && !r.error)
      .map(r => r.responseModel)

    if (responseModels.length > 0) {
      const uniqueModels = [...new Set(responseModels)]

      if (uniqueModels.some(m => !m.toLowerCase().includes('claude'))) {
        extraSignals.push({
          type: 'warning',
          message: `API 返回的 model 字段为 "${uniqueModels.join(', ')}"，可能非 Claude 模型`,
        })
      }
      if (uniqueModels.length > 1) {
        extraSignals.push({
          type: 'warning',
          message: `多次请求返回了不同的 model 名称 (${uniqueModels.join(', ')})，可能负载均衡或混合调度`,
        })
      }
    }

    // 2. Token 使用异常检测
    const usageStats = results
      .filter(r => r.usage && (r.usage.prompt_tokens || r.usage.input_tokens) && !r.error)
      .map(r => r.usage)

    if (usageStats.length >= 3) {
      const avgPromptTokens = usageStats.reduce((a, u) => a + (u.prompt_tokens || u.input_tokens || 0), 0) / usageStats.length
      if (avgPromptTokens > 200) {
        extraSignals.push({
          type: 'warning',
          message: `平均 Prompt Token 数 ${Math.round(avgPromptTokens)} 偏高，中转站可能注入了额外 System Prompt`,
        })
      }

      const completionTokens = usageStats.map(u => u.completion_tokens || u.output_tokens || 0)
      const avgCompletion = completionTokens.reduce((a, b) => a + b, 0) / completionTokens.length
      const variance = completionTokens.reduce((a, t) => a + Math.pow(t - avgCompletion, 2), 0) / completionTokens.length
      const cv = avgCompletion > 0 ? Math.sqrt(variance) / avgCompletion : 0

      if (cv > 1.5) {
        extraSignals.push({
          type: 'info',
          message: `Completion Token 变异系数 ${cv.toFixed(2)}，输出长度波动较大`,
        })
      }
    }

    // 3. 延迟分析
    const latencies = results.filter(r => !r.error).map(r => r.latency)
    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const minLatency = Math.min(...latencies)
      const maxLatency = Math.max(...latencies)

      if (avgLatency > 15000) {
        extraSignals.push({ type: 'info', message: `平均响应延迟 ${Math.round(avgLatency)}ms，延迟极高（可能经过多层中转）` })
      } else if (avgLatency > 8000) {
        extraSignals.push({ type: 'info', message: `平均响应延迟 ${Math.round(avgLatency)}ms，延迟较高` })
      }

      if (maxLatency > minLatency * 5 && latencies.length >= 4) {
        extraSignals.push({
          type: 'warning',
          message: `响应延迟差异极大 (${Math.round(minLatency)}ms ~ ${Math.round(maxLatency)}ms)，可能存在混合调度`,
        })
      }
    }

    // 4. 重试统计
    const totalRetries = results.reduce((a, r) => a + (r.retries || 0), 0)
    if (totalRetries > 0) {
      extraSignals.push({ type: 'info', message: `有 ${totalRetries} 次请求进行了重试` })
    }

    return NextResponse.json({
      results,
      totalLatency,
      extraSignals,
      requestedModel: model,
      apiFormat, // 告知前端用了什么格式
    })
  } catch (error) {
    return NextResponse.json(
      { error: `检测失败: ${error.message}` },
      { status: 500 }
    )
  }
}
