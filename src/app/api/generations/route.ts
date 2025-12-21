import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    const dataPath = path.join(process.cwd(), "data", "generations.json");
    let generations = [];

    try {
        if (fs.existsSync(dataPath)) {
            const fileContent = fs.readFileSync(dataPath, "utf-8");
            generations = JSON.parse(fileContent);
            // Sort by newness
            generations.reverse();
        }
        return NextResponse.json(generations);
    } catch (error) {
        console.error("Error reading generations:", error);
        return NextResponse.json({ error: "Failed to fetch generations" }, { status: 500 });
    }
}
