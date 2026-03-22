import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";

export async function GET() {
  try {
    const csvDir = join(process.cwd(), "csv_output");
    console.log(`[DEALS API] Reading from ${csvDir}`);

    // List all deal files
    const files = await readdir(csvDir);
    const dealFiles = files.filter((f) => f === "deals.csv");
    console.log(`[DEALS API] Found deal files: ${dealFiles.join(', ')}`);

    if (dealFiles.length === 0) {
      console.log(`[DEALS API] No deals.csv found`);
      return NextResponse.json({
        data: [],
        file: null,
        message: "No deals found yet",
      });
    }

    // Get the most recent deals file
    const latestFile = dealFiles.sort().reverse()[0];
    const filePath = join(csvDir, latestFile);
    console.log(`[DEALS API] Reading ${filePath}`);

    // Read and parse CSV
    const csvContent = await readFile(filePath, "utf-8");
    const parsed = Papa.parse(csvContent, { header: true });
    console.log(`[DEALS API] Parsed ${parsed.data.length} deals`);

    return NextResponse.json({
      file: latestFile,
      data: parsed.data.filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        return r.title; // Filter out empty rows
      }),
    });
  } catch (error) {
    console.error(`[DEALS API] Error: ${error.message}`);
    return NextResponse.json(
      { error: "Failed to load deals data", data: [] },
      { status: 500 }
    );
  }
}
