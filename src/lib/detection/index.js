/**
 * Claude 模型检测测试套件 v2.1
 *
 * 入口：统一导出所有测试、评分函数和工具函数。
 *
 * 模块组织：
 *   - tests/*.js   各项独立测试（身份/行为/知识/风格/拒绝/泄漏/推理/多语言）
 *   - score.js     加权评分与结论生成
 *   - utils.js     共享工具函数
 *
 * 说明：
 *   - 单项测试导出保留为 named export，便于外部按需引用
 *   - allTests 汇总数组保持原顺序不变，向后兼容
 */

import { identityTest } from './tests/identity'
import { behaviorFingerprintTest } from './tests/behavior'
import { knowledgeBoundaryTest } from './tests/knowledge'
import { styleFingerPrintTest } from './tests/style'
import { refusalPatternTest } from './tests/refusal'
import { systemPromptLeakTest } from './tests/system-leak'
import { reasoningTest } from './tests/reasoning'
import { multilingualTest } from './tests/multilingual'

export { identityTest } from './tests/identity'
export { behaviorFingerprintTest } from './tests/behavior'
export { knowledgeBoundaryTest } from './tests/knowledge'
export { styleFingerPrintTest } from './tests/style'
export { refusalPatternTest } from './tests/refusal'
export { systemPromptLeakTest } from './tests/system-leak'
export { reasoningTest } from './tests/reasoning'
export { multilingualTest } from './tests/multilingual'

export { calculateOverallScore, TEST_WEIGHTS } from './score'
export { countMatches } from './utils'

// 所有测试套件（顺序即 UI 渲染顺序）
export const allTests = [
  identityTest,
  behaviorFingerprintTest,
  knowledgeBoundaryTest,
  styleFingerPrintTest,
  refusalPatternTest,
  systemPromptLeakTest,
  reasoningTest,
  multilingualTest,
]
