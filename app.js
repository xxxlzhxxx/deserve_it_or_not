import { evaluateWorth } from "./rules.js";

const steps = [...document.querySelectorAll(".step")];
const form = document.querySelector("#worth-form");
const progressBar = document.querySelector("#progress-bar");
const prevButton = document.querySelector("#prev-button");
const nextButton = document.querySelector("#next-button");
const submitButton = document.querySelector("#submit-button");
const message = document.querySelector("#message");
const urlInput = document.querySelector("#url-input");
const parseButton = document.querySelector("#parse-button");
const parseLoading = document.querySelector("#parse-loading");
const parseStatus = document.querySelector("#parse-status");
const wizard = document.querySelector("#worth-form");
const resultShell = document.querySelector("#result-panel");
const loadingState = document.querySelector("#loading-state");
const resultPanel = document.querySelector("#result");

let currentStep = 0;
let contentProfile = {
  title: "",
  description: "",
  text: "",
};

function showStep(index) {
  currentStep = index;
  steps.forEach((step, stepIndex) => {
    step.classList.toggle("active", stepIndex === index);
  });
  progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
  prevButton.disabled = index === 0;
  nextButton.classList.toggle("hidden", index === steps.length - 1);
  submitButton.classList.toggle("hidden", index !== steps.length - 1);
  message.textContent = "";
}

function selectedValue(name) {
  return new FormData(form).get(name);
}

function validateStep(index) {
  if (index === 0 && !selectedValue("job")) return "先选一个职业。";
  if (index === 1 && !selectedValue("goal")) return "先选一个主要诉求。";
  if (index === 2 && !selectedValue("budget")) return "先选一个预算。";
  if (index === 3 && !urlInput.value.trim()) return "先输入一个公开网页链接。";
  if (index === 3 && contentProfile.text.trim().length < 20) return "请先点击解析链接，解析成功后再完成。";
  return "";
}

function getUserProfile() {
  return {
    job: selectedValue("job"),
    goal: selectedValue("goal"),
    budget: Number(selectedValue("budget")),
  };
}

function parseHtmlPage(html) {
  const documentCopy = new DOMParser().parseFromString(html, "text/html");
  documentCopy.querySelectorAll("script, style, noscript, svg").forEach((node) => node.remove());
  const title = documentCopy.querySelector("title")?.textContent?.trim() || "";
  const description =
    documentCopy.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ||
    documentCopy.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() ||
    "";
  const text = documentCopy.body?.innerText?.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() || "";

  return { title, description, text };
}

function parseJinaMarkdown(markdown) {
  const titleMatch = markdown.match(/^Title:\s*(.+)$/im);
  const descriptionMatch = markdown.match(/^Description:\s*(.+)$/im);
  const cleanedText = markdown
    .replace(/^Title:\s*.+$/gim, "")
    .replace(/^URL Source:\s*.+$/gim, "")
    .replace(/^Markdown Content:\s*/gim, "")
    .replace(/^Description:\s*.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: titleMatch?.[1]?.trim() || "",
    description: descriptionMatch?.[1]?.trim() || "",
    text: cleanedText,
  };
}

function allOriginsUrl(rawUrl) {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
}

function readableUrl(rawUrl) {
  const url = new URL(rawUrl);
  const removablePrefixes = ["utm_"];
  const removableParams = ["gclid", "gbraid", "gad_source", "gad_campaignid", "gclsrc", "targetid"];

  for (const key of [...url.searchParams.keys()]) {
    if (removableParams.includes(key) || removablePrefixes.some((prefix) => key.startsWith(prefix))) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

function jinaReaderUrl(rawUrl) {
  return `https://r.jina.ai/${readableUrl(rawUrl)}`;
}

async function parseUrl(rawUrl) {
  const cleanUrl = readableUrl(rawUrl);
  try {
    const localResponse = await fetch(`/parse?url=${encodeURIComponent(cleanUrl)}`);
    const profile = await localResponse.json();
    if (!localResponse.ok) throw new Error(profile.error || `本地解析返回 ${localResponse.status}`);
    return profile;
  } catch (error) {
    if (!location.hostname || location.protocol === "file:") {
      throw error;
    }
  }

  try {
    const response = await fetch(allOriginsUrl(cleanUrl));
    if (!response.ok) throw new Error(`网页代理返回 ${response.status}`);
    const profile = parseHtmlPage(await response.text());
    if (profile.text.length > 20) return profile;
  } catch {
    // Fall through to the plain-text reader service.
  }

  const readerResponse = await fetch(jinaReaderUrl(cleanUrl));
  if (!readerResponse.ok) {
    throw new Error(`解析服务返回 ${readerResponse.status}`);
  }
  const profile = parseJinaMarkdown(await readerResponse.text());
  if (profile.text.length < 20) {
    throw new Error("没有提取到足够正文，可能是页面禁止代理抓取或主要内容由脚本动态渲染");
  }
  return profile;
}

function updateParsedPreview(profile) {
  parseStatus.hidden = false;
  parseStatus.className = "parse-status success";
  parseStatus.textContent = profile.title ? "解析成功" : "解析成功";
}

function renderResult(result) {
  loadingState.classList.add("hidden");
  resultPanel.classList.remove("hidden");
  document.querySelector("#level").textContent = result.level;
  document.querySelector("#score").textContent = `${result.score}/100`;
  document.querySelector("#commentary").textContent = result.commentary;
  document.querySelector("#learning-cost").textContent = result.learningCost;
  document.querySelector("#payback-cycle").textContent = result.paybackCycle;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

prevButton.addEventListener("click", () => {
  if (currentStep > 0) showStep(currentStep - 1);
});

nextButton.addEventListener("click", () => {
  const error = validateStep(currentStep);
  if (error) {
    message.textContent = error;
    return;
  }
  showStep(currentStep + 1);
});

parseButton.addEventListener("click", async () => {
  const rawUrl = urlInput.value.trim();
  if (!rawUrl) {
    message.textContent = "先输入一个公开网页链接。";
    return;
  }

  parseButton.disabled = true;
  parseButton.textContent = "解析中";
  parseStatus.hidden = true;
  parseLoading.hidden = false;
  message.textContent = "";

  try {
    contentProfile = await parseUrl(rawUrl);
    contentProfile.text = contentProfile.text.slice(0, 12000);
    updateParsedPreview(contentProfile);
    message.textContent = "";
  } catch (error) {
    contentProfile = { title: "", description: "", text: "" };
    parseStatus.hidden = false;
    parseStatus.className = "parse-status error";
    parseStatus.textContent = "该链接无效，无法解析";
    message.textContent = "";
  } finally {
    parseLoading.hidden = true;
    parseButton.disabled = false;
    parseButton.textContent = "解析链接";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = validateStep(currentStep);
  if (error) {
    message.textContent = error;
    return;
  }

  const finalContentProfile = {
    ...contentProfile,
    text: contentProfile.text.trim(),
  };

  submitButton.disabled = true;
  prevButton.disabled = true;
  message.textContent = "";
  wizard.classList.add("hidden");
  resultShell.classList.remove("hidden");
  resultPanel.classList.add("hidden");
  loadingState.classList.remove("hidden");

  await sleep(2000);

  const result = evaluateWorth(getUserProfile(), finalContentProfile);
  renderResult(result);
  submitButton.disabled = false;
  prevButton.disabled = false;
});

showStep(0);
