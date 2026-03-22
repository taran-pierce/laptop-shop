import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productParam = (searchParams.get("product") || "all").toLowerCase();

  try {
    const csvDir = join(process.cwd(), "csv_output");
    console.log(`[SPECS API] Reading from ${csvDir}, product: ${productParam}`);

    // List all spec comparison files
    const files = await readdir(csvDir);
    let specFiles = files.filter((f) => f.startsWith("spec_comparison_"));
    console.log(`[SPECS API] Found spec files: ${specFiles.join(', ')}`);

    if (productParam !== "all") {
      specFiles = specFiles.filter((f) =>
        f.startsWith(`spec_comparison_${productParam}`)
      );
    }

    if (specFiles.length === 0) {
      console.log(`[SPECS API] No spec files found for ${productParam}`);
      return NextResponse.json(
        {
          error: `No spec comparison files found for product: ${productParam}`,
          available: ["scar", "g18"],
        },
        { status: 404 }
      );
    }

    const parsedData: Record<string, unknown>[] = [];

    // Parse all matched CSV files and combine
    const fileReads = specFiles.map((filename) => {
      const filePath = join(csvDir, filename);
      return readFile(filePath, "utf-8").then((content) => ({ content }));
    });

    const resolved = await Promise.all(fileReads);
    resolved.forEach(({ content }) => {
      const parsed = Papa.parse(content, { header: true });
      console.log(`[SPECS API] Parsed ${parsed.data.length} rows`);
      parsedData.push(...parsed.data);
    });

    console.log(`[SPECS API] Returning ${parsedData.length} total items`);
    return NextResponse.json({
      data: parsedData,
      files: specFiles,
    });
  } catch (error) {
    console.error(`[SPECS API] Error: ${error.message}`);
    return NextResponse.json(
      { error: `Failed to load specs: ${error.message}` },
      { status: 500 }
    );
  }
}
