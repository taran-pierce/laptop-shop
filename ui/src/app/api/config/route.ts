import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

interface ScraperConfig {
  searchTerms: string[];
  priceTargets: Record<string, number>;
}

const CONFIG_FILE = join(process.cwd(), "..", "scraper_config.json");

async function getConfig(): Promise<ScraperConfig> {
  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    // Return defaults if file doesn't exist
    return {
      searchTerms: ["ASUS ROG Strix SCAR 18", "ASUS ROG Strix G18"],
      priceTargets: { "ASUS ROG Strix SCAR 18": 2500, "ASUS ROG Strix G18": 2100 },
    };
  }
}

async function saveConfig(config: ScraperConfig): Promise<void> {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Config read error:", error);
    return NextResponse.json(
      { error: "Failed to read config" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: ScraperConfig = body;

    // Validate
    if (!Array.isArray(config.searchTerms) || config.searchTerms.length === 0) {
      return NextResponse.json(
        { error: "searchTerms must be a non-empty array" },
        { status: 400 }
      );
    }

    if (typeof config.priceTargets !== "object" || config.priceTargets === null) {
      return NextResponse.json(
        { error: "priceTargets must be a key-value object" },
        { status: 400 }
      );
    }

    // Ensure each search term has a target (default 0 if missing)
    const normalizedTargets: Record<string, number> = {};
    config.searchTerms.forEach((term) => {
      const value = Number(config.priceTargets[term]);
      normalizedTargets[term] = Number.isFinite(value) ? value : 0;
    });

    await saveConfig({
      ...config,
      priceTargets: normalizedTargets,
    });
    return NextResponse.json({ success: true, config: { ...config, priceTargets: normalizedTargets } });
  } catch (error) {
    console.error("Config write error:", error);
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 }
    );
  }
}
