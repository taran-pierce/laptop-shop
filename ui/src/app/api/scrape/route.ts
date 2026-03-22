import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

export async function POST() {
  try {
    const pythonScript = join(process.cwd(), "..", "app.py");

    return new Promise<NextResponse>((resolve) => {
      let output = "";
      let errorOutput = "";
      let isComplete = false;

      const python = spawn("python3", [pythonScript], {
        cwd: join(process.cwd(), ".."),
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      console.log(`[SCRAPER] Process spawned with PID ${python.pid}`);

      python.stdout?.on("data", (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log("[SCRAPER OUT]:", chunk);
      });

      python.stderr?.on("data", (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.log("[SCRAPER ERR]:", chunk);
      });

      python.on("close", (code) => {
        isComplete = true;
        console.log(`[SCRAPER] Process closed with code ${code}`);

        if (code === 0) {
          resolve(
            NextResponse.json({
              success: true,
              message: "Scraper completed successfully",
              output,
              code,
            })
          );
        } else {
          resolve(
            NextResponse.json(
              {
                success: false,
                message: "Scraper failed",
                error: errorOutput || output,
                code,
              },
              { status: 500 }
            )
          );
        }
      });

      python.on("error", (err) => {
        console.error("[SCRAPER] Spawn error:", err);
        resolve(
          NextResponse.json(
            { error: `Failed to start scraper: ${err.message}` },
            { status: 500 }
          )
        );
      });

      // Timeout safety: if process takes >10min, kill it
      setTimeout(() => {
        if (!isComplete && python.pid) {
          console.warn("[SCRAPER] Timeout after 10min, killing process");
          python.kill();
          resolve(
            NextResponse.json(
              { error: "Scraper timed out after 10 minutes" },
              { status: 500 }
            )
          );
        }
      }, 600000);
    });
  } catch (error) {
    console.error("Scraper error:", error);
    return NextResponse.json(
      { error: `Failed to start scraper: ${error}` },
      { status: 500 }
    );
  }
}

