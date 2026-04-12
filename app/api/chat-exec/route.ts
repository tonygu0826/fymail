import { spawn } from "child_process";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_MESSAGE_LENGTH = 10000;
const CLAUDE_PATH = process.env.CLAUDE_CLI_PATH || "/home/ubuntu/.nvm/versions/node/v22.22.1/bin/claude";

function sanitizeMessage(input: string): string {
  // Trim and limit length
  return input.trim().slice(0, MAX_MESSAGE_LENGTH);
}

function isValidConversationId(id: string): boolean {
  // UUID format only
  return /^[a-f0-9-]{36}$/.test(id);
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, conversationId } = body;

  if (!message || typeof message !== "string") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const sanitized = sanitizeMessage(message);
  if (!sanitized) {
    return Response.json({ error: "message cannot be empty" }, { status: 400 });
  }

  const args = ["--print", "--output-format", "text"];

  if (conversationId && typeof conversationId === "string") {
    if (!isValidConversationId(conversationId)) {
      return Response.json({ error: "invalid conversationId" }, { status: 400 });
    }
    args.push("--resume", conversationId);
  }

  // Message is passed as a single argument, not interpolated into a shell command
  // spawn() does NOT use a shell, so this is safe from shell injection
  args.push(sanitized);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(CLAUDE_PATH, args, {
        env: {
          HOME: "/home/ubuntu",
          PATH: `/home/ubuntu/.nvm/versions/node/v22.22.1/bin:/usr/bin:/bin`,
          NODE_ENV: "production",
        },
        cwd: "/home/ubuntu",
        timeout: 110000,
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      proc.stderr.on("data", () => {
        // Suppress stderr output to client
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          controller.enqueue(encoder.encode(`\n[进程异常退出]`));
        }
        controller.close();
      });

      proc.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n[服务暂时不可用]`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
