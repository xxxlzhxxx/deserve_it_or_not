import { evaluateWorth } from "./rules.js";

const engineerResult = evaluateWorth(
  { job: "engineer", goal: "productivity", budget: 300 },
  {
    title: "Claude Code and Cursor AI coding workflow",
    description: "AI coding assistant for developers",
    text: "Claude Code Cursor Copilot help developers automate code review and workflow. $20/month.",
  },
);

const salesResult = evaluateWorth(
  { job: "sales", goal: "reporting", budget: 0 },
  {
    title: "LangGraph RAG Agent Framework",
    description: "Developer framework",
    text: "LangGraph RAG MCP Agent Framework SDK deployment. $49/month.",
  },
);

if (engineerResult.score < 70) {
  throw new Error(`程序员编程助手场景分数过低：${engineerResult.score}`);
}

if (engineerResult.level !== "再不学完蛋了") {
  throw new Error(`程序员编程助手场景等级不符合预期：${engineerResult.level}`);
}

if (!engineerResult.commentary.includes("程序员") || !engineerResult.commentary.includes("提高生产力")) {
  throw new Error(`评语没有结合职业和诉求：${engineerResult.commentary}`);
}

if (salesResult.score > 50) {
  throw new Error(`销售低预算技术框架场景分数过高：${salesResult.score}`);
}

if (salesResult.level !== "不如回去睡大觉") {
  throw new Error(`销售低预算技术框架场景等级不符合预期：${salesResult.level}`);
}

console.log("rules ok", {
  engineer: engineerResult.level,
  sales: salesResult.level,
});
