import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import Papa from "papaparse";

export async function GET() {
  try {
    const csvDir = join(process.cwd(), "..", "csv_output");

    // List all deal files
    const files = await readdir(csvDir);
    const dealFiles = files.filter((f) => f.startsWith("deals_"));

    if (dealFiles.length === 0) {
      return NextResponse.json({
        data: [],
        file: null,
        message: "No deals found yet",
      });
    }

    // Get the most recent deals file
    const latestFile = dealFiles.sort().reverse()[0];
    const filePath = join(csvDir, latestFile);

    // Read and parse CSV
    const csvContent = await readFile(filePath, "utf-8");
    const parsed = Papa.parse(csvContent, { header: true });

    return NextResponse.json({
      file: latestFile,
      data: parsed.data.filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        return r.title; // Filter out empty rows
      }),
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to load deals data", data: [] },
      { status: 500 }
    );
  }
}
