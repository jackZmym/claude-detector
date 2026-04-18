/**
 * 检测测试套件 - 加权评分与结论生成
 */

// 各项测试的权重（合计 = 1.0）
export const TEST_WEIGHTS = {
  '身份认知测试': 0.20,     // 最重要：是否自认 Claude
  '系统提示泄漏测试': 0.18, // 检测包装是关键
  '推理能力测试': 0.15,     // 推理能力区分降级
  '行为指纹测试': 0.12,     // 行为模式识别
  '风格指纹测试': 0.10,     // 语言风格
  '知识边界测试': 0.10,     // 知识截止
  '拒绝模式测试': 0.08,     // 拒绝模式
  '多语言能力测试': 0.07,   // 多语言切换
}

const DEFAULT_WEIGHT = 0.1

/**
 * 根据综合得分与失败数生成结论文本 + 颜色
 */
function buildVerdict(overall, errorCount) {
  if (errorCount >= 4) {
    return {
      verdict: '检测不完整 - 超过半数测试请求失败，结果不可靠',
      verdictColor: 'orange',
    }
  }
  if (overall >= 85) {
    return {
      verdict: '高度可信 - 极大概率为官方原生 Claude',
      verdictColor: 'green',
    }
  }
  if (overall >= 65) {
    return {
      verdict: '基本可信 - 可能为 Claude 但存在轻微包装',
      verdictColor: 'yellow',
    }
  }
  if (overall >= 40) {
    return {
      verdict: '存疑 - 可能为掺水模型或非原生 Claude',
      verdictColor: 'orange',
    }
  }
  return {
    verdict: '高度可疑 - 极大概率非 Claude 模型',
    verdictColor: 'red',
  }
}

/**
 * 计算整体评分
 * 失败的测试会从权重中剔除，剩余权重自动归一化
 */
export function calculateOverallScore(results) {
  let totalScore = 0
  let totalWeight = 0
  let errorCount = 0

  for (const result of results) {
    if (result.error) {
      errorCount++
      continue
    }
    const weight = TEST_WEIGHTS[result.name] ?? DEFAULT_WEIGHT
    totalScore += result.score * weight
    totalWeight += weight
  }

  const overall = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
  const { verdict, verdictColor } = buildVerdict(overall, errorCount)

  return {
    overall,
    verdict,
    verdictColor,
    errorCount,
    validTests: results.length - errorCount,
  }
}
