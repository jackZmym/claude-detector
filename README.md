# Claude 检测工具箱

检测 AI 中转站 / OneAPI / NewAPI 中 Claude 模型的**真实来源**和**掺水程度**，同时支持**额度查询**和**调用明细**。

## 功能

### 模型真伪检测

通过 8 项自动化测试，综合判断中转站返回的模型是否为**官方原生 Claude**：

| 测试项 | 检测内容 |
|--------|---------|
| 身份认知测试 | 模型是否正确声称自己是 Claude |
| 行为指纹测试 | 回复风格是否符合 Claude 特征 |
| 知识边界测试 | 训练截止日期是否与 Claude 一致 |
| 风格指纹测试 | 用词、语气、句式分析 |
| 拒绝模式测试 | 安全策略行为是否符合 Claude |
| 系统提示泄漏测试 | 检测中转站是否注入额外提示 |
| 推理能力测试 | 逻辑推理能力是否匹配 |
| 多语言能力测试 | 多语种切换能力 |

检测完成后输出综合评分（0-100）和可信度判定。

### 额度查询

- 查询令牌总额度、已用额度、剩余额度
- 有效期展示
- 调用日志明细（模型、tokens、花费、耗时）
- 按模型分类统计
- 导出 CSV

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
- 内置最新 Claude 模型快捷按钮（Opus 4 / Sonnet 4 / Sonnet 4.5 等）
- 点击「开始检测」后等待约 30-60 秒
- 查看综合评分和各项测试详情（可展开查看原始回复）

### 额度查询

- 点击「查询额度 & 明细」
- 查看余额信息和调用日志
- 支持按模型过滤、排序、导出 CSV

## 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **部署**: Docker / Node.js
- **API**: OpenAI 兼容格式（适配 NewAPI / OneAPI）

## 项目结构

```
claude-detector/
├── src/
│   ├── app/
│   │   ├── layout.js              # 全局布局
│   │   ├── globals.css            # 全局样式
│   │   ├── page.js                # 主页面（Tab 切换）
│   │   └── api/
│   │       ├── detect/route.js    # 模型检测 API
│   │       ├── models/route.js    # 获取模型列表 API
│   │       ├── balance/route.js   # 额度查询 API
│   │       └── logs/route.js      # 调用日志 API
│   ├── components/
│   │   ├── ModelSelector.js       # 模型选择器（下拉+手动）
│   │   ├── ScoreRing.js           # 圆形评分环
│   │   ├── TestCard.js            # 测试结果卡片
│   │   ├── ProgressBar.js         # 检测进度条
│   │   ├── BalanceCard.js         # 余额信息面板
│   │   └── LogsTable.js           # 调用日志表格
│   └── lib/
│       ├── detection-tests.js     # 8 项检测测试套件
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

- **身份特征**：真正的 Claude 会声称自己是 Anthropic 的 Claude
- **行为特征**：Claude 有独特的回复风格（克制、平衡、多角度）
- **知识特征**：不同模型的知识截止日期不同
- **安全特征**：Claude 有特有的安全拒绝模式
- **能力特征**：高端模型和降级模型的推理能力有明显差异
- **返回值比对**：检查 API 返回的 `model` 字段是否与请求一致

> 注意：检测结果仅供参考，不保证 100% 准确。高级的模型伪装可能无法被完全检测到。

## License

MIT
