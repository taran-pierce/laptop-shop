import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

function sanitizeLines(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/\n/g, "\\n"));
}

export async function GET() {
  const pythonScript = join(process.cwd(), "..", "app.py");

  const stream = new ReadableStream({
    start(controller) {
      const python = spawn("python3", [pythonScript], {
        cwd: join(process.cwd(), ".."),
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      python.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        sanitizeLines(text).forEach((line) => {
          controller.enqueue(`data: ${line}\n\n`);
        });
      });

      python.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        sanitizeLines(text).forEach((line) => {
          controller.enqueue(`data: [stderr] ${line}\n\n`);
        });
      });

      python.on("close", (code) => {
        controller.enqueue(`event: done\ndata: ${code}\n\n`);
        controller.close();
      });

      python.on("error", (error) => {
        controller.enqueue(`event: error\ndata: ${error.message}\n\n`);
        controller.close();
      });
    },
    cancel() {
      // no-op; process closes when done or error
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
