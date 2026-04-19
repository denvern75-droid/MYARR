export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const model = "gpt-4.1-mini";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return json({ error: "GET만 허용됩니다." }, 405);
      }

      return json({
        ok: true,
        status: "ok",
        model,
        has_api_key: Boolean(env.OPENAI_API_KEY),
      });
    }

    if (url.pathname === "/api/report-stream") {
      if (request.method === "GET") {
        return json({
          ok: true,
          status: "ok",
          message: "POST로 호출하세요.",
        });
      }

      if (request.method !== "POST") {
        return json({ error: "POST만 허용됩니다." }, 405);
      }

      if (!env.OPENAI_API_KEY) {
        return json({ error: "OPENAI_API_KEY 없음" }, 500);
      }

      const body = await request.json().catch(() => ({}));
      const prompt = String(body.prompt || "").trim();

      if (!prompt) {
        return json({ error: "prompt 필요" }, 400);
      }

      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          input: prompt,
        }),
      });

      const text = await upstream.text();
      let data = null;

      try {
        data = JSON.parse(text);
      } catch {}

      if (!upstream.ok) {
        return json({
          error: "OpenAI 실패",
          status: upstream.status,
          detail: data?.error?.message || text,
        }, upstream.status);
      }

      let output = "";

      if (typeof data?.output_text === "string") {
        output = data.output_text;
      } else if (Array.isArray(data?.output)) {
        output = data.output
          .flatMap(o => o.content || [])
          .filter(c => c.type === "output_text")
          .map(c => c.text || "")
          .join("\n");
      }

      return json({
        ok: true,
        output_text: output,
        raw: data,
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ error: "ASSETS 없음" }, 500);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
