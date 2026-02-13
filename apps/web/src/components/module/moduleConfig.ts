export type ModuleConfig = {
  title: string;
  summary: string;
  highlights: string[];
};

export const MODULE_CONFIG: Record<string, ModuleConfig> = {
  play: {
    title: 'Play',
    summary: '与机器人和真实对手对战，验证策略执行是否稳定。',
    highlights: ['赛季积分', '对战记录', '赛后复盘入口']
  },
  study: {
    title: 'Study Hub',
    summary: '浏览预解库、查看策略矩阵，并把节点一键转成训练任务。',
    highlights: ['Strategy / Ranges / Breakdown 视图', 'EV / EQ / EQR 指标栏', '一键生成 Drill']
  },
  solver: {
    title: 'Solver Lab',
    summary: '提交自定义求解任务，支持复杂树和 nodelock 场景。',
    highlights: ['参数模板', '队列状态', '结果版本对比']
  },
  practice: {
    title: 'Trainer',
    summary: '按 Spot/Street/Full Hand 进行训练并追踪 EV 偏差。',
    highlights: ['错题本', '分层难度', '训练评分']
  },
  analyze: {
    title: 'Hand Analyzer',
    summary: '批量上传手牌，定位 EV 损失最大的错误并回跳学习。',
    highlights: ['HH 上传队列', 'EV 排序', '错误标签']
  },
  reports: {
    title: 'Leak Reports',
    summary: '把离散失误转化为统计级漏洞，按收益影响排序。',
    highlights: ['样本量置信度', '趋势对比', '指标回查手牌']
  },
  arena: {
    title: 'Arena',
    summary: '通过竞技对战验证训练效果，并触发赛后复盘。',
    highlights: ['赛季积分', '关键手牌标注', '赛后 3 分钟摘要']
  },
  learn: {
    title: 'Academy',
    summary: '内容学习和训练路径结合，构建长期提升节奏。',
    highlights: ['课程体系', '每日题', 'AI 推荐学习清单']
  },
  aiCoachHistory: {
    title: 'AI Coach History',
    summary: '查看 AI 教练会话历史与执行动作记录。',
    highlights: ['会话过滤', '动作回放', '风险提示追踪']
  }
};
