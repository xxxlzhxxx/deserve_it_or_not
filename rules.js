export const JOBS = {
  engineer: "程序员",
  pm: "产品经理",
  sales: "销售",
  teacher: "教师",
  doctor: "医生",
  designer: "设计师",
  founder: "创业者",
  student: "学生",
  other: "其他",
};

export const GOALS = {
  productivity: "提高生产力",
  job_hop: "面试跳槽",
  startup: "创业赚钱",
  reporting: "应付领导汇报",
  expertise: "提高专业能力",
  showoff: "装逼尝鲜",
  side_hustle: "副业赚钱",
};

const DEFAULT_JOB_SCORE = {
  engineer: 0,
  pm: 0,
  sales: 0,
  teacher: 0,
  doctor: 0,
  designer: 0,
  founder: 0,
  student: 0,
  other: 0,
};

const KEYWORD_RULES = [
  {
    name: "技术框架 / AI 工程",
    keywords: ["MCP", "Agent Framework", "LangGraph", "RAG", "agentic", "workflow orchestration", "向量数据库"],
    scores: { engineer: 20, pm: 5, sales: -10, teacher: -15, designer: -5, doctor: -10, founder: 5, student: 10 },
  },
  {
    name: "办公提效",
    keywords: ["ChatGPT", "Office", "PPT", "Excel", "会议纪要", "meeting notes", "slides", "spreadsheet"],
    scores: { pm: 20, sales: 20, teacher: 15, engineer: 5, founder: 15, student: 10, doctor: 8, designer: 5 },
  },
  {
    name: "编程助手",
    keywords: ["Cursor", "Claude Code", "Copilot", "code assistant", "AI coding", "代码生成", "代码补全"],
    scores: { engineer: 30, pm: 5, teacher: -10, student: 12, founder: 8, sales: -10, designer: -5 },
  },
  {
    name: "视觉生成",
    keywords: ["Midjourney", "Flux", "ComfyUI", "Stable Diffusion", "image generation", "文生图", "生图"],
    scores: { designer: 30, engineer: 5, sales: -10, pm: 8, founder: 12, student: 8, teacher: 5 },
  },
  {
    name: "销售增长",
    keywords: ["CRM", "lead generation", "cold email", "sales automation", "线索", "客户跟进", "销售自动化", "外呼"],
    scores: { sales: 30, founder: 18, pm: 8, engineer: 3, teacher: -10, doctor: -10, student: 5 },
  },
  {
    name: "教育教学",
    keywords: ["教案", "出题", "批改", "课程", "学生", "lesson plan", "quiz", "learning assistant"],
    scores: { teacher: 30, student: 15, pm: 6, engineer: 3, sales: -8, designer: 5 },
  },
  {
    name: "医疗场景",
    keywords: ["医疗", "病历", "临床", "患者", "医学影像", "medical", "clinical", "patient", "healthcare"],
    scores: { doctor: 30, engineer: 8, pm: 6, founder: 8, sales: -8, teacher: -5 },
  },
  {
    name: "创业商业化",
    keywords: ["创业", "变现", "增长", "获客", "商业模式", "startup", "monetization", "growth", "go-to-market"],
    scores: { founder: 25, sales: 12, pm: 10, student: 8, engineer: 6, designer: 5 },
  },
];

const GOAL_RULES = {
  productivity: ["自动化", "效率", "批量", "workflow", "automation", "integrations", "template"],
  job_hop: ["面试", "简历", "作品集", "求职", "interview", "resume", "portfolio", "career"],
  startup: ["创业", "增长", "变现", "获客", "startup", "growth", "monetization", "customers"],
  reporting: ["汇报", "PPT", "会议纪要", "报告", "dashboard", "slides", "meeting", "summary"],
  expertise: ["专业", "进阶", "最佳实践", "认证", "expert", "advanced", "best practice", "course"],
  showoff: ["炫酷", "尝鲜", "demo", "viral", "showcase", "生成视频", "海报", "创意"],
  side_hustle: ["副业", "接单", "赚钱", "模板售卖", "freelance", "side hustle", "marketplace"],
};

const PRICE_PATTERNS = [
  /(?:\$|USD\s*)(\d{1,4})(?:\.\d+)?\s*\/?\s*(?:mo|month|monthly|月)/gi,
  /(?:￥|¥|RMB\s*)(\d{1,5})(?:\.\d+)?\s*\/?\s*(?:月|month|monthly)?/gi,
  /(\d{1,4})(?:\.\d+)?\s*(?:美元|美金|刀)\s*\/?\s*(?:月|每月)/gi,
  /(\d{1,5})(?:\.\d+)?\s*元\s*\/?\s*(?:月|每月)/gi,
];

const LEVELS = [
  { min: 85, level: "再不学完蛋了" },
  { min: 65, level: "学了没坏处，虽然也没啥大用" },
  { min: 45, level: "看两眼至少能装个B" },
  { min: 25, level: "没啥大用抖音刷无聊了看两眼换换脑子" },
  { min: -Infinity, level: "不如回去睡大觉" },
];

const COST_KEYWORDS = {
  high: ["framework", "API", "SDK", "deployment", "fine-tuning", "RAG", "LangGraph", "ComfyUI", "部署", "微调", "工作流"],
  low: ["template", "Office", "Excel", "PPT", "ChatGPT", "会议纪要", "模板", "浏览器插件", "一键"],
};

function normalizeText(contentProfile) {
  return `${contentProfile.title || ""}\n${contentProfile.description || ""}\n${contentProfile.text || ""}`;
}

function countKeywordHits(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.reduce((count, keyword) => {
    return lower.includes(keyword.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function clamp(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMatchedRules(text, job) {
  return KEYWORD_RULES.map((rule) => {
    const hits = countKeywordHits(text, rule.keywords);
    if (!hits) return null;
    return {
      name: rule.name,
      hits,
      score: (rule.scores[job] ?? rule.scores.other ?? 0) * Math.min(hits, 2),
    };
  }).filter(Boolean);
}

function detectMonthlyPrice(text) {
  const prices = [];
  for (const pattern of PRICE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) {
        const isUsd = match[0].includes("$") || /usd|美元|美金|刀/i.test(match[0]);
        prices.push(isUsd ? value * 7.2 : value);
      }
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

function budgetScore(budget, detectedPrice) {
  if (!detectedPrice) return budget === 0 ? -5 : 5;
  if (detectedPrice > 20 * 7.2 && budget === 0) return -20;
  if (budget >= 9999) return 12;
  if (budget === 0 && detectedPrice > 0) return -18;
  if (budget >= detectedPrice) return 12;
  if (budget >= detectedPrice * 0.6) return 2;
  return -12;
}

function goalScore(text, goal) {
  return Math.min(24, countKeywordHits(text, GOAL_RULES[goal] || []) * 8);
}

function estimateLearningCost(text, matchedRules) {
  const highHits = countKeywordHits(text, COST_KEYWORDS.high);
  const lowHits = countKeywordHits(text, COST_KEYWORDS.low);
  const technicalScore = matchedRules.find((rule) => rule.name === "技术框架 / AI 工程")?.hits || 0;
  if (highHits + technicalScore >= 3) return "高";
  if (lowHits >= 2 && highHits === 0) return "低";
  return "中";
}

function estimatePaybackCycle(score, learningCost, goal) {
  if (score >= 80 && learningCost === "低") return "立即见效";
  if (goal === "showoff" && score >= 55) return "立即见效";
  if (score >= 70) return "1个月";
  if (score >= 45) return "3个月";
  return "长期";
}

function buildReasons({ job, goal, text, matchedRules, detectedPrice, budget, score, learningCost }) {
  const reasons = [];
  const positiveRules = matchedRules.filter((rule) => rule.score > 0).sort((a, b) => b.score - a.score);
  const negativeRules = matchedRules.filter((rule) => rule.score < 0).sort((a, b) => a.score - b.score);

  if (positiveRules[0]) {
    reasons.push(`内容命中了「${positiveRules[0].name}」信号，和你的职业「${JOBS[job]}」相关。`);
  } else {
    reasons.push(`页面没有明显命中「${JOBS[job]}」的高相关能力信号。`);
  }

  const goalHits = countKeywordHits(text, GOAL_RULES[goal] || []);
  if (goalHits > 0) {
    reasons.push(`它和你的诉求「${GOALS[goal]}」有 ${goalHits} 个关键词匹配。`);
  } else {
    reasons.push(`它和你的诉求「${GOALS[goal]}」暂时缺少直接匹配。`);
  }

  if (detectedPrice) {
    reasons.push(`页面识别到约 ${Math.round(detectedPrice)} 元/月的价格线索，你的预算是 ${budget >= 9999 ? "不限" : `${budget} 元/月`}。`);
  } else {
    reasons.push("页面没有明确价格线索，预算判断按保守规则处理。");
  }

  if (negativeRules[0]) {
    reasons.push(`同时命中了「${negativeRules[0].name}」这类对你当前画像不友好的信号。`);
  } else if (score >= 70) {
    reasons.push("职业匹配、诉求匹配和预算压力整体比较顺。");
  } else {
    reasons.push("建议先看案例和价格，别急着系统投入学习时间。");
  }

  reasons.push(`预计学习成本为「${learningCost}」。`);
  return reasons;
}

function buildCommentary({ job, goal, score, level, learningCost, paybackCycle }) {
  const jobLabel = JOBS[job] || "你这个职业";
  const goalLabel = GOALS[goal] || "你的诉求";
  const goalAdvice = {
    productivity: "你要的是省时间，所以别把它当新玩具供起来，直接拿一个每天重复的活去试。",
    job_hop: "你要拿它服务面试跳槽，那重点不是会不会玩，而是能不能产出一个能讲清楚的作品或案例。",
    startup: "你要靠它创业赚钱，就别沉迷功能列表，先看它能不能帮你更快做出东西、拿到客户、收上钱。",
    reporting: "你要应付领导汇报，它只要能帮你把材料、PPT、纪要和数据说圆，就已经算有现实价值。",
    expertise: "你要提高专业能力，就别只看演示视频，得看它能不能真的进入你的专业流程。",
    showoff: "你要装逼尝鲜，那判断标准很简单：上手快、效果炸、别人一看能问你怎么做的。",
    side_hustle: "你要副业赚钱，别光看热闹，重点看它能不能稳定交付、能不能降低你的接单成本。",
  };

  if (score >= 85) {
    return `作为${jobLabel}，你想「${goalLabel}」，这个东西已经不是“有空看看”的级别了。${goalAdvice[goal]}学习成本${learningCost}，回报周期大概${paybackCycle}，别再收藏夹吃灰了。`;
  }

  if (score >= 65) {
    return `作为${jobLabel}，你想「${goalLabel}」，它和你的场景是沾边的。${goalAdvice[goal]}不用重仓学习，拿半天到一天做个小实验，成了就留下，不成就删。`;
  }

  if (score >= 45) {
    return `作为${jobLabel}，你想「${goalLabel}」，它目前更像谈资和灵感来源。${goalAdvice[goal]}可以看两眼，至少下次聊天不至于完全接不上。`;
  }

  if (score >= 25) {
    return `作为${jobLabel}，你想「${goalLabel}」，它现在和你的真实需求有点隔。${goalAdvice[goal]}别系统学，刷累了换换脑子可以。`;
  }

  return `作为${jobLabel}，你想「${goalLabel}」，这个东西暂时别硬学。它要么离你的工作太远，要么投入产出太弱，不如把时间拿去睡觉或者干点更具体的事。`;
}

export function evaluateWorth(userProfile, contentProfile) {
  const text = normalizeText(contentProfile);
  const matchedRules = getMatchedRules(text, userProfile.job);
  const baseScore = 35;
  const keywordScore = matchedRules.reduce((sum, rule) => sum + rule.score, 0);
  const intentScore = goalScore(text, userProfile.goal);
  const detectedPrice = detectMonthlyPrice(text);
  const payScore = budgetScore(Number(userProfile.budget), detectedPrice);
  const contentDepthScore = Math.min(10, Math.floor(text.length / 500));
  const score = clamp(baseScore + keywordScore + intentScore + payScore + contentDepthScore);
  const level = LEVELS.find((item) => score >= item.min).level;
  const learningCost = estimateLearningCost(text, matchedRules);
  const paybackCycle = estimatePaybackCycle(score, learningCost, userProfile.goal);
  const commentary = buildCommentary({
    job: userProfile.job,
    goal: userProfile.goal,
    score,
    level,
    learningCost,
    paybackCycle,
  });
  const reasons = buildReasons({
    job: userProfile.job,
    goal: userProfile.goal,
    text,
    matchedRules,
    detectedPrice,
    budget: Number(userProfile.budget),
    score,
    learningCost,
  });

  return {
    score,
    level,
    commentary,
    reasons,
    learningCost,
    paybackCycle,
    debug: {
      keywordScore,
      intentScore,
      budgetScore: payScore,
      contentDepthScore,
      detectedMonthlyPrice: detectedPrice,
      matchedRules,
    },
  };
}
