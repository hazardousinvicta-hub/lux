import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sector = searchParams.get("sector") || "luxury";

    try {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('sector', sector)
            .order('updated_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Transform back to StatusItem format implies we need to aggregate status?
        // For simpler viewer, we just return articles. The 'SystemStatus' might be fake/static or calculated.

        // Mock summary from data
        const summary = [
            { source: "Database", status: "success", count: data.length, duration: 0, items: [] }
        ];

        return NextResponse.json({
            articles: data,
            summary
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
