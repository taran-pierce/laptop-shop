import { NextResponse } from "next/server";
import { runScraper } from "@/lib/scraper";

function sanitizeLines(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/\n/g, "\\n"));
}

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const logCallback = (msg: string) => {
        sanitizeLines(msg).forEach((line) => {
          controller.enqueue(`data: ${line}\n\n`);
        });
      };

      runScraper(logCallback)
        .then(() => {
          controller.enqueue(`event: done\ndata: 0\n\n`);
          controller.close();
        })
        .catch((error) => {
          controller.enqueue(`event: error\ndata: ${error.message}\n\n`);
          controller.close();
        });
    },
    cancel() {
      // no-op
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