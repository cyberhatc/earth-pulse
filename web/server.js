import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const dist = path.join(__dirname, "dist");
const API_TARGET = process.env.API_TARGET || "http://localhost:8000";

// Static frontend build.
app.use(express.static(dist));

// Proxy API calls to the local Earth Pulse FastAPI backend.
// Must be registered before the SPA fallback.
app.use("/api", async (req, res) => {
  try {
    const url = new URL(req.originalUrl, `http://${req.hostname}`);
    // Backend routes live at root (e.g. /health); strip the /api prefix like the Vite dev proxy does.
    const upstreamPath = url.pathname.replace(/^\/api/, "") || "/";
    const headers = { ...req.headers };
    delete headers["host"];
    delete headers["content-length"];
    delete headers["connection"];
    const init = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(90000),
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      init.body = Buffer.concat(chunks);
      if (!headers["content-type"]) headers["content-type"] = "application/json";
    }
    const upstream = await fetch(`${API_TARGET}${upstreamPath}${url.search}`, init);
    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    for (const [k, v] of upstream.headers) {
      if (["content-length", "transfer-encoding", "connection"].includes(k)) continue;
      res.setHeader(k, v);
    }
    res.send(body);
  } catch (err) {
    res
      .status(502)
      .json({ detail: `Backend unreachable at ${API_TARGET}: ${err?.message ?? err}` });
  }
});

// SPA fallback.
app.get("*", (req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Serving ${dist} on :${port} and proxying /api -> ${API_TARGET}`);
});
