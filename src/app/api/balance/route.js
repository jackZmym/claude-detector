import { NextResponse } from 'next/server'

// 安全：禁止缓存
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * 查询令牌余额 v2.2
 * 
 * 兼容多种中转站接口格式（按优先级尝试）：
 * 
 * 策略1: Apertis 专有接口 /v1/dashboard/billing/credits
 *   - 返回 object:"billing_credits"，支持 PAYG + 套餐配额双模式
 *   - 套餐制：显示 cycle_quota_limit / cycle_quota_used / cycle_quota_remaining
 *   - PAYG：显示 account_credits / token_remaining
 * 
 * 策略2: NewAPI/OneAPI 标准 billing 接口
 *   - /v1/dashboard/billing/subscription + /v1/dashboard/billing/usage
 * 
 * 策略3: 降级到 /v1/models 验证 Key 有效性
 *   - 对于 aicodewith.com 等不支持任何 billing 接口的平台
 */

const REQUEST_TIMEOUT = 15000

async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ==================== 策略 1: Apertis /v1/dashboard/billing/credits ====================
async function tryApertisBilling(baseUrl, apiKey) {
  const headers = { 'Authorization': `Bearer ${apiKey}` }

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/dashboard/billing/credits`,
      { headers }
    )

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { error: 'API Key 无效或无权限查询余额', status: res.status }
      }
      return null
    }

    const data = await res.json()

    // 验证是否为 Apertis 格式
    if (data.object !== 'billing_credits' || !data.payg) {
      return null
    }

    const payg = data.payg
    const sub = data.subscription
    const isSubscriber = data.is_subscriber && sub

    // 构造统一响应
    const result = {
      // 标记为 Apertis 平台
      billingSource: 'apertis',
      isSubscriber,

      // PAYG 信息（始终存在）
      accountCredits: payg.account_credits,
      tokenUsed: payg.token_used,
      tokenTotal: payg.token_is_unlimited ? '无限' : payg.token_total,
      tokenRemaining: payg.token_is_unlimited ? '无限' : payg.token_remaining,
      tokenIsUnlimited: payg.token_is_unlimited,

      // 兼容标准模式的字段
      total: payg.token_is_unlimited ? '无限' : `$${Number(payg.token_total).toFixed(2)}`,
      totalRaw: payg.token_is_unlimited ? Infinity : payg.token_total,
      used: `$${Number(payg.token_used).toFixed(2)}`,
      usedRaw: payg.token_used,
      remaining: payg.token_is_unlimited ? '无限' : `$${Number(payg.token_remaining).toFixed(2)}`,
      remainingRaw: payg.token_is_unlimited ? Infinity : payg.token_remaining,
      isUnlimited: payg.token_is_unlimited,
      accessUntil: '未知',
      usagePercent: payg.token_is_unlimited ? 0 : (
        payg.token_total > 0 ? Math.min(100, (payg.token_used / payg.token_total) * 100) : 0
      ),
    }

    // 套餐信息（如果有）
    if (isSubscriber) {
      const cycleEnd = sub.cycle_end ? new Date(sub.cycle_end) : null
      result.subscription = {
        planType: sub.plan_type,
        status: sub.status,
        cycleQuotaLimit: sub.cycle_quota_limit,
        cycleQuotaUsed: sub.cycle_quota_used,
        cycleQuotaRemaining: sub.cycle_quota_remaining,
        cycleStart: sub.cycle_start ? new Date(sub.cycle_start).toLocaleString('zh-CN') : '未知',
        cycleEnd: cycleEnd ? cycleEnd.toLocaleString('zh-CN') : '未知',
        quotaPercent: sub.cycle_quota_limit > 0
          ? Math.min(100, (sub.cycle_quota_used / sub.cycle_quota_limit) * 100)
          : 0,
        paygFallbackEnabled: sub.payg_fallback_enabled || false,
        paygSpentUsd: sub.payg_spent_usd,
        paygLimitUsd: sub.payg_limit_usd,
      }
      result.accessUntil = cycleEnd ? cycleEnd.toLocaleString('zh-CN') : '未知'
    }

    // 月度限额（如果有）
    if (payg.token_monthly_limit_usd !== undefined) {
      result.monthlyLimit = payg.token_monthly_limit_usd
      result.monthlyUsed = payg.token_monthly_used_usd
      result.monthlyResetDay = payg.monthly_reset_day
    }

    return { success: true, source: 'apertis', data: result }
  } catch {
    return null
  }
}

// ==================== 策略 2: NewAPI/OneAPI 标准 billing ====================
async function tryStandardBilling(baseUrl, apiKey) {
  const headers = { 'Authorization': `Bearer ${apiKey}` }

  const urlVariants = [
    baseUrl,
    baseUrl.replace(/\/v1$/, ''),
  ]

  for (const url of urlVariants) {
    try {
      const subRes = await fetchWithTimeout(
        `${url}/dashboard/billing/subscription`,
        { headers }
      )

      if (!subRes.ok) {
        const errText = await subRes.text()
        if (subRes.status === 404 || subRes.status === 405) continue
        if (errText.includes('不存在') || errText.includes('not found') || errText.includes('not exist')) continue
        if (subRes.status === 401 || subRes.status === 403) {
          return { error: 'API Key 无效或无权限查询余额', status: subRes.status }
        }
        continue
      }

      const subData = await subRes.json()

      // 如果返回了 Apertis 格式的数据，跳过（已在策略1处理）
      if (subData.object === 'billing_credits') continue

      if (subData.hard_limit_usd === undefined && subData.system_hard_limit_usd === undefined && !subData.total) {
        continue
      }

      // 查询使用量
      const now = new Date()
      const startDate = new Date(now.getTime() - 100 * 24 * 3600 * 1000)
      const fmt = (d) => d.toISOString().split('T')[0]

      let usageData = { total_usage: 0 }
      try {
        const usageRes = await fetchWithTimeout(
          `${url}/dashboard/billing/usage?start_date=${fmt(startDate)}&end_date=${fmt(now)}`,
          { headers }
        )
        if (usageRes.ok) {
          usageData = await usageRes.json()
        }
      } catch { /* usage 查询失败不影响主流程 */ }

      const hardLimit = subData.hard_limit_usd || subData.system_hard_limit_usd || 0
      const isUnlimited = hardLimit >= 100000000
      const totalUsed = (usageData.total_usage || 0) / 100
      const remaining = isUnlimited ? Infinity : Math.max(0, hardLimit - totalUsed)

      const accessUntil = subData.access_until
        ? new Date(subData.access_until * 1000).toLocaleString('zh-CN')
        : '未知'

      return {
        success: true,
        source: 'billing',
        data: {
          billingSource: 'standard',
          total: isUnlimited ? '无限' : `$${hardLimit.toFixed(2)}`,
          totalRaw: hardLimit,
          used: `$${totalUsed.toFixed(2)}`,
          usedRaw: totalUsed,
          remaining: isUnlimited ? '无限' : `$${remaining.toFixed(2)}`,
          remainingRaw: remaining,
          isUnlimited,
          accessUntil,
          usagePercent: isUnlimited ? 0 : (hardLimit > 0 ? Math.min(100, (totalUsed / hardLimit) * 100) : 0),
        }
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * 已知平台识别 — 根据 URL 给出精准的控制台提示
 */
function detectPlatform(baseUrl) {
  const url = baseUrl.toLowerCase()
  if (url.includes('aicodewith.com')) {
    return {
      name: 'AI Code With',
      note: '该平台余额查询仅支持网页登录，无法通过 API Key 查询',
      consoleUrl: 'https://aicodewith.com/zh/dashboard',
      billingModel: '预充值 + 按量计费（余额永不过期）',
    }
  }
  if (url.includes('apertis.ai')) {
    return {
      name: 'Apertis AI',
      note: null, // Apertis 已通过策略1处理
      consoleUrl: 'https://apertis.ai/setting?tab=subscription',
      billingModel: '套餐制 + PAYG',
    }
  }
  return null
}

// ==================== 策略 3: 降级到 /v1/models ====================
async function tryModelsEndpoint(baseUrl, apiKey) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl}/models`, { headers })

    if (res.ok) {
      const data = await res.json()
      const models = data.data || data || []
      const modelCount = Array.isArray(models) ? models.length : 0
      const claudeModels = Array.isArray(models)
        ? models.filter(m => {
            const id = (m.id || m.name || '').toLowerCase()
            return id.includes('claude') || id.includes('sonnet') || id.includes('opus') || id.includes('haiku')
          })
        : []

      // 识别已知平台
      const platform = detectPlatform(baseUrl)
      const platformNote = platform?.note || '该平台不支持通过 API Key 查询余额，请在平台控制台查看'

      return {
        success: true,
        source: 'models',
        data: {
          billingSource: 'models_only',
          total: '未知',
          totalRaw: -1,
          used: '未知',
          usedRaw: -1,
          remaining: '未知',
          remainingRaw: -1,
          isUnlimited: false,
          accessUntil: '未知',
          usagePercent: -1,
          platformNote,
          platformName: platform?.name || null,
          consoleUrl: platform?.consoleUrl || null,
          billingModel: platform?.billingModel || null,
          keyValid: true,
          availableModels: modelCount,
          claudeModelCount: claudeModels.length,
          claudeModelNames: claudeModels.slice(0, 10).map(m => m.id || m.name || m),
        }
      }
    } else if (res.status === 401 || res.status === 403) {
      return { error: 'API Key 无效或已过期', status: res.status }
    }
  } catch { /* 连模型列表都查不了 */ }

  return null
}

// ==================== 主入口 ====================
export async function POST(request) {
  try {
    const { baseUrl, apiKey } = await request.json()

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: '请提供 Base URL 和 API Key' },
        { status: 400 }
      )
    }

    let url = baseUrl.replace(/\/+$/, '')
    if (!url.endsWith('/v1')) {
      url += '/v1'
    }

    // 策略1: 尝试 Apertis credits 接口（同时覆盖其他使用相同格式的平台）
    const apertisResult = await tryApertisBilling(url, apiKey)
    if (apertisResult?.error) {
      return NextResponse.json({ error: apertisResult.error }, { status: apertisResult.status || 400 })
    }
    if (apertisResult?.success) {
      return NextResponse.json(apertisResult.data)
    }

    // 策略2: 尝试 NewAPI/OneAPI 标准 billing 接口
    const billingResult = await tryStandardBilling(url, apiKey)
    if (billingResult?.error) {
      return NextResponse.json({ error: billingResult.error }, { status: billingResult.status || 400 })
    }
    if (billingResult?.success) {
      return NextResponse.json(billingResult.data)
    }

    // 策略3: 降级到 models 接口
    const modelsResult = await tryModelsEndpoint(url, apiKey)
    if (modelsResult?.error) {
      return NextResponse.json({ error: modelsResult.error }, { status: modelsResult.status || 400 })
    }
    if (modelsResult?.success) {
      return NextResponse.json(modelsResult.data)
    }

    // 全部失败
    return NextResponse.json(
      {
        error: '无法查询余额信息。该平台可能不支持标准的余额查询接口。\n' +
               '提示：部分平台区分 CLI 和 API 端点，请确认使用了正确的 API 端点。\n' +
               '您可以在平台控制台直接查看余额和用量。'
      },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: `请求失败: ${error.message}` },
      { status: 500 }
    )
  }
}
