import { NextResponse } from "next/server";
import { runScraper } from "@/lib/scraper";

export async function POST() {
  try {
    console.log("[SCRAPER] Starting JS scraper");
    const data = await runScraper();
    console.log("[SCRAPER] Scraper completed successfully");
    return NextResponse.json({
      success: true,
      message: "Scraper completed successfully",
      data,
    });
  } catch (error) {
    console.error("[SCRAPER] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Scraper failed",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

