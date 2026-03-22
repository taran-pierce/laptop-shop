import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const product = searchParams.get("product") || "scar"; // default to scar

  try {
    const csvDir = join(process.cwd(), "..", "csv_output");

    // List all spec comparison files
    const files = await readdir(csvDir);
    const specFiles = files.filter((f) =>
      f.startsWith(`spec_comparison_${product}`)
    );

    if (specFiles.length === 0) {
      return NextResponse.json(
        {
          error: `No spec comparison files found for product: ${product}`,
          available: ["scar", "g18"],
        },
        { status: 404 }
      );
    }

    // Get the most recent file
    const latestFile = specFiles.sort().reverse()[0];
    const filePath = join(csvDir, latestFile);

    // Read and parse CSV
    const csvContent = await readFile(filePath, "utf-8");
    const parsed = Papa.parse(csvContent, { header: true });

    return NextResponse.json({
      product,
      file: latestFile,
      data: parsed.data.filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        return r.rank; // Filter out empty rows
      }),
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to load spec data" },
      { status: 500 }
    );
  }
}
