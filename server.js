import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function cleanUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http/https 链接");
  }

  for (const key of [...url.searchParams.keys()]) {
    const isAdParam =
      key.startsWith("utm_") ||
      ["gclid", "gbraid", "gad_source", "gad_campaignid", "gclsrc", "targetid"].includes(key);
    if (isAdParam) url.searchParams.delete(key);
  }

  return url.toString();
}

function decodeEntities(text) {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function firstMatch(html, pattern) {
  return decodeEntities(html.match(pattern)?.[1]?.trim() || "");
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(br|p|div|section|article|h[1-6]|li|tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function parseHtml(html) {
  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description:
      firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
      firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i),
    text: htmlToText(html),
  };
}

function parseJinaMarkdown(markdown) {
  return {
    title: firstMatch(markdown, /^Title:\s*(.+)$/im),
    description: firstMatch(markdown, /^Description:\s*(.+)$/im),
    text: markdown
      .replace(/^Title:\s*.+$/gim, "")
      .replace(/^URL Source:\s*.+$/gim, "")
      .replace(/^Markdown Content:\s*/gim, "")
      .replace(/^Description:\s*.+$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseDirect(url) {
  const upstream = await fetchWithTimeout(url);
  const html = await upstream.text();
  const profile = parseHtml(html);
  return { ok: upstream.ok, status: upstream.status, source: "direct", ...profile };
}

async function parseWithJina(url) {
  const upstream = await fetchWithTimeout(`https://r.jina.ai/${url}`);
  const markdown = await upstream.text();
  const profile = parseJinaMarkdown(markdown);
  return { ok: upstream.ok, status: upstream.status, source: "jina", ...profile };
}

function hasEnoughText(profile) {
  return `${profile.title || ""}\n${profile.description || ""}\n${profile.text || ""}`.trim().length >= 200;
}

async function handleParse(requestUrl, response) {
  try {
    const rawUrl = requestUrl.searchParams.get("url");
    if (!rawUrl) throw new Error("缺少 url 参数");

    const url = cleanUrl(rawUrl);
    const attempts = [];
    try {
      attempts.push(await parseDirect(url));
    } catch (error) {
      attempts.push({ ok: false, source: "direct", error: error.message });
    }

    const directProfile = attempts[0];
    if (!directProfile.ok || !hasEnoughText(directProfile)) {
      try {
        attempts.push(await parseWithJina(url));
      } catch (error) {
        attempts.push({ ok: false, source: "jina", error: error.message });
      }
    }

    const profile = attempts.find((attempt) => attempt.ok && hasEnoughText(attempt)) || attempts[0];

    if (!profile.ok) {
      response.writeHead(502, { "content-type": MIME_TYPES[".json"] });
      response.end(JSON.stringify({ error: profile.status ? `目标页面返回 ${profile.status}` : profile.error, url, attempts, ...profile }));
      return;
    }

    if (!hasEnoughText(profile)) {
      response.writeHead(422, { "content-type": MIME_TYPES[".json"] });
      response.end(JSON.stringify({ error: "没有提取到足够正文，可能是动态渲染页面", url, attempts, ...profile }));
      return;
    }

    response.writeHead(200, { "content-type": MIME_TYPES[".json"] });
    response.end(JSON.stringify({ url, attempts, ...profile }));
  } catch (error) {
    response.writeHead(400, { "content-type": MIME_TYPES[".json"] });
    response.end(JSON.stringify({ error: error.message }));
  }
}

async function handleStatic(pathname, response) {
  const safePath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
  if (requestUrl.pathname === "/parse") {
    await handleParse(requestUrl, response);
    return;
  }

  await handleStatic(requestUrl.pathname, response);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`AI worth MVP running at http://127.0.0.1:${PORT}/`);
});
