# Claude 检测工具箱

检测 AI 中转站 / OneAPI / NewAPI 中 Claude 模型的**真实来源**和**掺水程度**，同时支持**额度查询**和**调用明细**。

## v2.1 更新

- **双协议自动适配** — 自动探测 OpenAI (`/v1/chat/completions`) 和 Anthropic (`/v1/messages`) 两种 API 格式，CLI 端点（如 aicodewith.com）也能检测
- **检测算法增强** — 扩展伪装识别（覆盖 DeepSeek/Mistral/Qwen 等）、细化行为指纹分析、动态知识截止匹配、推理链质量评估
- **并行检测** — 测试请求并发执行（可配置），检测耗时减少 60%+
- **模型预校验** — 检测前自动验证模型是否存在，不存在时给出可用模型建议
- **Token 异常检测** — 分析 Prompt Token 是否偏高（检测 System Prompt 注入）、Completion Token 波动
- **多平台额度查询** — 支持 Apertis（套餐制 + PAYG）、NewAPI/OneAPI（标准 billing）、不支持余额接口的平台自动降级
- **已知平台识别** — 自动识别 aicodewith.com、apertis.ai 等平台，给出精准的控制台链接和计费模式提示
- **日志查询兼容** — 不支持日志接口的平台优雅降级，不再报错
- **请求重试 & 超时** — 429/5xx 自动重试，单请求 30s 超时保护
- **更多模型快捷选择** — 官方模型名 + 常见中转站别名

## 功能

### 模型真伪检测

通过 8 项自动化测试，综合判断中转站返回的模型是否为**官方原生 Claude**：

| 测试项 | 检测内容 | 权重 |
|--------|---------|------|
| 身份认知测试 | 模型是否正确声称自己是 Claude（覆盖 10+ 竞品伪装检测） | 20% |
| 系统提示泄漏测试 | 检测中转站是否注入额外提示或身份覆盖指令 | 18% |
| 推理能力测试 | 逻辑推理 + 语言陷阱分析能力 | 15% |
| 行为指纹测试 | 指令遵从度、客套话检测、格式简洁度 | 12% |
| 风格指纹测试 | 用词、语气、多角度思维、克制度 | 10% |
| 知识边界测试 | 训练截止日期与 Claude 版本匹配 | 10% |
| 拒绝模式测试 | 安全策略行为（教育性回答 + 伦理提醒） | 8% |
| 多语言能力测试 | 中/日/英三语切换 + 身份一致性 | 7% |

检测完成后输出综合评分（0-100）和可信度判定：

| 评分 | 判定 |
|------|------|
| >= 85 | 高度可信 - 极大概率为官方原生 Claude |
| >= 65 | 基本可信 - 可能存在轻微包装 |
| >= 40 | 存疑 - 可能为掺水模型 |
| < 40 | 高度可疑 - 极大概率非 Claude |

### 额度查询

自动适配多种中转站计费接口：

| 平台类型 | 接口 | 支持情况 |
|---------|------|---------|
| Apertis AI | `/v1/dashboard/billing/credits` | 套餐配额 + PAYG 余额 |
| NewAPI / OneAPI | `/v1/dashboard/billing/subscription` | 总额度 / 已用 / 剩余 |
| aicodewith.com 等 | 降级到 `/v1/models` | Key 验证 + 可用模型列表 + 控制台链接 |

额外功能：
- 调用日志明细（模型、tokens、花费、耗时）
- 按模型分类统计
- 导出 CSV

### API 格式自动适配

| 格式 | 端点 | 适用场景 |
|------|------|---------|
| OpenAI 兼容 | `/v1/chat/completions` | NewAPI / OneAPI / Apertis 等 |
| Anthropic 原生 | `/v1/messages` | aicodewith.com CLI 端点等 |

检测时自动探测可用格式，无需手动切换。

### 安全措施

- API Key **仅保存在页面内存**，关闭页面即销毁
- **不写入** localStorage / sessionStorage / Cookie
- 页面闲置 5 分钟自动清除 Key
- 历史记录中**不包含** API Key
- 后端 API **不记录、不缓存** Key
- 禁止浏览器自动填充（兼容 LastPass / 1Password / Bitwarden）
- Docker 部署采用非 root 用户 + 只读文件系统 + 禁止提权

## 快速开始

### 方式一：本地运行

```bash
# 克隆仓库
git clone git@github.com:jackZmym/claude-detector.git
cd claude-detector

# 一键启动
chmod +x start.sh
./start.sh
```

浏览器访问 `http://localhost:3000`

### 方式二：Docker 部署（推荐）

```bash
# 一键部署
chmod +x docker-start.sh
./docker-start.sh

# 自定义端口
./docker-start.sh 8080

# 停止
./docker-stop.sh

# 停止并清理镜像
./docker-stop.sh --clean
```

### 方式三：Docker Compose

```bash
# 启动
docker compose up -d --build

# 自定义端口
PORT=8080 docker compose up -d --build

# 停止
docker compose down
```

### 方式四：手动运行

```bash
npm install
npm run dev    # 开发模式
npm run build  # 生产构建
npm start      # 生产启动
```

## 使用说明

1. 填写中转站的 **Base URL**（如 `https://api.example.com`）
2. 填写 **API Key**（如 `sk-xxxxxxxxxxxx`）
3. 切换到「模型检测」或「额度查询」Tab

### 模型检测

- 支持**自动获取**中转站模型列表（调用 `/v1/models`）
- 支持**手动输入**自定义模型别名
- 内置最新 Claude 模型快捷按钮（Opus 4 / Sonnet 4 / Sonnet 4.5 等）+ 常见中转站别名
- 自动探测 API 格式（OpenAI / Anthropic），CLI 端点也能检测
- 模型不存在时自动给出可用模型建议
- 点击「开始检测」后等待约 15-30 秒（并行检测）
- 查看综合评分和各项测试详情（可展开查看原始回复）

### 额度查询

- 点击「查询额度 & 明细」
- 自动适配平台接口格式（Apertis 套餐制 / NewAPI 标准 / 降级模式）
- 不支持余额查询的平台会识别并给出控制台链接
- 支持按模型过滤、排序、导出 CSV

## 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **部署**: Docker / Node.js
- **API**: OpenAI 兼容格式 + Anthropic Messages API（自动适配）

## 项目结构

```
claude-detector/
├── src/
│   ├── app/
│   │   ├── layout.js              # 全局布局
│   │   ├── globals.css            # 全局样式
│   │   ├── page.js                # 主页面（Tab 切换）
│   │   └── api/
│   │       ├── detect/route.js    # 模型检测 API（双协议自动适配）
│   │       ├── models/route.js    # 获取模型列表 API
│   │       ├── balance/route.js   # 额度查询 API（多平台兼容）
│   │       └── logs/route.js      # 调用日志 API（优雅降级）
│   ├── components/
│   │   ├── ModelSelector.js       # 模型选择器（下拉+手动+别名）
│   │   ├── ScoreRing.js           # 圆形评分环
│   │   ├── TestCard.js            # 测试结果卡片
│   │   ├── ProgressBar.js         # 检测进度条
│   │   ├── BalanceCard.js         # 余额信息面板（多模式展示）
│   │   └── LogsTable.js           # 调用日志表格
│   └── lib/
│       ├── detection-tests.js     # 8 项检测测试套件 + 加权评分
│       └── security.js            # API Key 安全模块
├── Dockerfile                     # 多阶段构建
├── docker-compose.yml
├── docker-start.sh                # Docker 一键部署
├── docker-stop.sh                 # Docker 停止清理
├── start.sh                       # 本地一键启动
├── package.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 检测原理

通过向中转站发送精心设计的测试 prompt，分析回复内容中的多维特征：

- **身份特征**：真正的 Claude 会声称自己是 Anthropic 的 Claude（检测 10+ 竞品伪装）
- **行为特征**：Claude 有独特的回复风格（克制、平衡、多角度、无多余客套）
- **知识特征**：不同版本 Claude 的知识截止日期不同（Claude 4 → 2025 / Claude 3.5 → 2024）
- **安全特征**：Claude 有特有的安全拒绝模式（教育性回答 + 伦理框架）
- **能力特征**：高端模型和降级模型的推理能力有明显差异
- **注入检测**：检查 API 返回的 `model` 字段、Prompt Token 异常、系统提示泄漏
- **协议适配**：自动探测 OpenAI / Anthropic 两种 API 格式

> 注意：检测结果仅供参考，不保证 100% 准确。高级的模型伪装可能无法被完全检测到。

## License

MIT
