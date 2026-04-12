import { createServer } from "http";
import { spawn } from "child_process";

const PORT = 3100;
const CLAUDE_PATH = "/home/ubuntu/.nvm/versions/node/v22.22.1/bin/claude";

const server = createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/chat") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const { message, conversationId } = parsed;
    if (!message || typeof message !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "message is required" }));
      return;
    }

    const args = ["--print", "--output-format", "text"];
    if (conversationId) {
      args.push("--resume", conversationId);
    }
    args.push(message);

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    });

    const proc = spawn(CLAUDE_PATH, args, {
      env: {
        ...process.env,
        HOME: "/home/ubuntu",
        PATH: `/home/ubuntu/.nvm/versions/node/v22.22.1/bin:${process.env.PATH}`,
      },
      cwd: "/home/ubuntu",
    });

    proc.stdout.on("data", (chunk) => res.write(chunk));
    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.error("[claude stderr]", text);
    });

    proc.on("close", (code) => {
      if (code !== 0) res.write(`\n[进程退出，代码: ${code}]`);
      res.end();
    });

    proc.on("error", (err) => {
      res.write(`\n[错误: ${err.message}]`);
      res.end();
    });
  });
});

server.listen(PORT, () => {
  console.log(`Chat API server running on port ${PORT}`);
});
