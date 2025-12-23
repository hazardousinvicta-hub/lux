import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
    try {
        // Query generations table from Supabase
        const { data: generations, error } = await supabase
            .from('generations')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json({ error: "Failed to fetch generations" }, { status: 500 });
        }

        // Transform to match expected format
        const formattedGenerations = (generations || []).map(g => ({
            id: g.id,
            timestamp: g.timestamp,
            imageUrl: g.image_url,
            summary: g.summary,
            sector: g.sector
        }));

        return NextResponse.json(formattedGenerations);
    } catch (error) {
        console.error("Error reading generations:", error);
        return NextResponse.json({ error: "Failed to fetch generations" }, { status: 500 });
    }
}
