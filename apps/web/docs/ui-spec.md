# ZENGTO Web UI Specification

## 1. 文档目的

定义 ZENGTO Web 的视觉语言、布局规则、组件规范、状态反馈和可访问性基线，确保设计与实现一致。

## 2. 设计方向

- 气质：专业、冷静、可信、偏“策略终端”
- 关键词：高对比、低噪音、强层级、可追踪状态
- 重点：输入与结果区域的注意力聚焦，不做花哨干扰

## 3. Design Tokens（初版）

## 3.1 Color

```css
:root {
  --bg-page: #05080d;
  --bg-panel: #0b1018;
  --bg-panel-elevated: #111827;
  --bg-interactive: #0f172a;
  --text-primary: #e6edf7;
  --text-secondary: #9aa4b2;
  --text-muted: #6f7a89;
  --line-subtle: rgba(154, 164, 178, 0.24);
  --line-strong: rgba(154, 164, 178, 0.45);
  --accent-primary: #4cc9f0;
  --accent-success: #3ddc97;
  --accent-warning: #f4b740;
  --accent-danger: #f45b69;
  --accent-info: #7bdcff;
}
```

规则：

- 交互主高亮只使用 `--accent-primary`
- 风险态只用 `warning/danger`
- 不使用大面积高饱和纯色底

## 3.2 Typography

- 主字体：`IBM Plex Sans`, `Noto Sans SC`, sans-serif
- 数值/牌谱字体：`IBM Plex Mono`, `JetBrains Mono`, monospace

字号建议：

- Display：56/64（用于 `COMING SOON`）
- H1：36/44
- H2：28/36
- H3：20/28
- Body：16/24
- Small：13/20
- Micro：12/16

## 3.3 Radius / Spacing / Shadow

- Radius：`6 / 10 / 14 / 20`
- Spacing 基线：`4px`（4/8/12/16/24/32/48）
- 阴影：仅用于浮层与 CTA

```css
--shadow-soft: 0 8px 24px rgba(0, 0, 0, 0.28);
--shadow-focus: 0 0 0 2px rgba(76, 201, 240, 0.35);
```

## 4. 布局系统

## 4.1 桌面布局（>= 1200px）

- 左侧导航：固定宽度 `280px`
- 主工作区：居中内容容器，最大宽度 `1040px`
- 主输入框宽度：`720-840px`

## 4.2 平板布局（768-1199px）

- 左栏折叠为 icon rail (`72px`)
- 主工作区最大宽度 `90vw`

## 4.3 移动布局（<= 767px）

- 顶部导航 + 底部一级入口
- 输入框铺满可视宽度
- `COMING SOON` 文案降级为 32/40，保证首屏 CTA 可见

## 5. 关键页面规格

## 5.1 Home / Coming Soon（M0）

必须元素：

- 左侧品牌导航与模块入口
- 中央问题输入框（可编辑）
- 分析流程文案区（静态或半动态）
- 大标题 `COMING SOON`
- CTA：`成为首批内测玩家`

状态：

- 默认态：CTA 可点，输入可点
- 提交态：按钮 loading，防重复点击
- 成功态：提示已加入内测名单
- 错误态：提示重试

## 5.2 New Solution（M1）

必须元素：

- Prompt 输入区（多行）
- 示例快捷标签（位置/筹码/街道）
- 提交按钮
- 任务状态条（queued/processing）
- 结果卡片入口

## 5.3 Analysis Result（M1）

必须元素：

- 推荐动作卡（Fold/Call/Raise）
- 理由摘要（3-5 点）
- 关键参数（effective stack, position, pot odds）
- 可视化区域（频率图或 EV 比较）
- 复制按钮与重算按钮

## 5.4 ZEN Chat（M1）

必须元素：

- 会话消息流（用户/助手双侧气泡）
- 输入框（支持多行与 `Cmd/Ctrl+Enter` 发送）
- 建议问题快捷入口
- 清空会话按钮
- provider 状态标记（heuristic/openai/qwen/fallback）

状态：

- 空态：展示 2-3 个示例问题
- 发送中：显示 typing 提示并禁用重复发送
- 成功：插入助手回复并更新建议问题
- 失败：展示可重试错误提示

## 6. 组件规格

## 6.1 左侧导航 `SideNav`

- Section 标题和 item 间距固定
- 选中态：左边框 + 文本高亮
- 未开放项：右上角 `Soon` 标签

## 6.2 输入框 `PromptComposer`

- 最小高度：`64px`
- 支持快捷粘贴大段手牌文本
- 支持 `Ctrl/Cmd + Enter` 提交
- 支持 `aria-label="Hand question input"`

校验规则：

- 1-2000 字符
- 空输入禁用提交
- 超长时显示剩余字符提示

## 6.3 状态步骤 `AnalysisProgress`

- 4 步：解析 -> 范围 -> 求解 -> 输出
- 每步状态：pending / active / done / failed
- 错误时显示“查看详情”

## 6.4 CTA Button

- 高度：48px（桌面）/44px（移动）
- 主按钮 hover：背景亮度 +8%
- 按下态：scale(0.98)
- disabled 态：40% 不透明 + 禁用指针

## 6.5 结果卡 `ActionCard`

字段：

- `action`
- `confidence`
- `ev_delta`
- `reasoning_points[]`
- `alternatives[]`

视觉规则：

- 推荐动作在卡片顶部，以高对比色块强调
- `Fold/Call/Raise` 使用固定色（danger/info/success）

## 7. 动效规范

- 页面初次加载：左栏与主区错峰淡入（200ms + 120ms 延迟）
- 状态切换：仅 opacity/transform，不做布局抖动
- 结果出现：卡片逐个上移淡入（stagger 80ms）
- 禁止：长时间无限旋转或高频闪烁

## 8. 文案与语气

- 文案风格：专业、简短、操作导向
- 失败提示：给出原因 + 下一步（重试/修改输入）
- 避免夸张营销语

示例：

- 好：`分析超时，请重试或缩小问题范围。`
- 差：`系统炸了，请稍后再来。`

## 9. 无障碍（A11y）基线

- 正文对比度 >= 4.5:1
- 全部可点击元素支持键盘导航
- 输入、按钮、菜单具备明确 aria label
- loading 态需 `aria-live="polite"` 提示
- 动画遵循 `prefers-reduced-motion`

## 10. 响应式断点

- `sm`: 0-767
- `md`: 768-1199
- `lg`: 1200-1599
- `xl`: >=1600

每个断点至少提供：

- 顶部 1 屏截图
- 主输入区截图
- 分析结果区截图

## 11. 设计交付清单

设计到开发前必须提供：

- 页面级高保真稿（M0/M1）
- 组件标注（尺寸、间距、状态）
- Token 清单（色值、字体、圆角、阴影）
- 交互动效说明
- 多语言文案表（中/英）

## 12. UI 验收标准

- 与规格稿偏差小于 2px（关键布局）
- 交互状态完整（default/hover/active/disabled/loading/error）
- 移动端首屏 CTA 可见且可操作
- 无障碍检查通过（键盘、对比度、aria）
