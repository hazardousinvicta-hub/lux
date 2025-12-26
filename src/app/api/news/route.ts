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

        // Group articles by source and count them
        const sourceCounts: Record<string, number> = {};
        data.forEach((article: any) => {
            const srcId = article.source?.toLowerCase().replace(/\s+/g, '') || 'unknown';
            sourceCounts[srcId] = (sourceCounts[srcId] || 0) + 1;
        });

        return NextResponse.json({
            articles: data,
            sourceCounts
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
