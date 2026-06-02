const AD_PARAMS = ["gclid", "gbraid", "gad_source", "gad_campaignid", "gclsrc", "targetid"];

function cleanUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http/https 链接");
  }

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || AD_PARAMS.includes(key)) {
      url.searchParams.delete(key);
    }
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

function firstMatch(source, pattern) {
  return decodeEntities(source.match(pattern)?.[1]?.trim() || "");
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

async function fetchWithTimeout(url, timeoutMs = 5000) {
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

export default async function handler(request, response) {
  try {
    const rawUrl = request.query?.url;
    if (!rawUrl || Array.isArray(rawUrl)) throw new Error("缺少 url 参数");

    const url = cleanUrl(rawUrl);
    const attempts = [];

    try {
      attempts.push(await parseDirect(url));
    } catch (error) {
      attempts.push({ ok: false, source: "direct", error: error.message });
    }

    if (!attempts[0].ok || !hasEnoughText(attempts[0])) {
      try {
        attempts.push(await parseWithJina(url));
      } catch (error) {
        attempts.push({ ok: false, source: "jina", error: error.message });
      }
    }

    const profile = attempts.find((attempt) => attempt.ok && hasEnoughText(attempt)) || attempts[0];

    if (!profile.ok) {
      response.status(502).json({
        error: profile.status ? `目标页面返回 ${profile.status}` : profile.error,
        url,
        attempts,
        ...profile,
      });
      return;
    }

    if (!hasEnoughText(profile)) {
      response.status(422).json({ error: "没有提取到足够正文，可能是动态渲染页面", url, attempts, ...profile });
      return;
    }

    response.status(200).json({ url, attempts, ...profile });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
}
