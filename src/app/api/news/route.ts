import { NextResponse } from "next/server";
import { SupabaseRepository } from "@/lib/db/supabase-repository";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sector = searchParams.get("sector") || "luxury";

    try {
        const repository = new SupabaseRepository();
        const articles = await repository.getArticles(sector, 100);

        return NextResponse.json({
            articles,
            count: articles.length
        });

    } catch (error: any) {
        console.error("[API/news] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
