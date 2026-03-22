import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productParam = (searchParams.get("product") || "all").toLowerCase();

  try {
    const csvDir = join(process.cwd(), "..", "csv_output");

    // List all spec comparison files
    const files = await readdir(csvDir);
    let specFiles = files.filter((f) => f.startsWith("spec_comparison_"));

    if (productParam !== "all") {
      specFiles = specFiles.filter((f) =>
        f.startsWith(`spec_comparison_${productParam}`)
      );
    }

    if (specFiles.length === 0) {
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
      const filteredRows = parsed.data.filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        return r && r.rank;
      });
      parsedData.push(...filteredRows);
    });

    return NextResponse.json({
      product: productParam,
      files: specFiles,
      data: parsedData,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to load spec data" },
      { status: 500 }
    );
  }
}
