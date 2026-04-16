import './globals.css'

export const metadata = {
  title: 'Claude 模型检测器 - AI中转站掺水检测',
  description: '检测中转站/OneAPI中Claude模型的真实来源和掺水程度',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
