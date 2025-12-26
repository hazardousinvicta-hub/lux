/**
 * Supabase Implementation of ArticleRepository
 * 
 * Can be swapped for Postgres, SQLite, etc. by implementing the same interface.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Article, ArticleRepository } from './repository';

export class SupabaseRepository implements ArticleRepository {
    private client: SupabaseClient;

    constructor() {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
            || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('[SupabaseRepository] Missing SUPABASE_URL or key environment variables');
        }

        this.client = createClient(url, key);

        // Log which key type for debugging
        if (typeof window === 'undefined') {
            const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon';
            console.log(`[SupabaseRepository] Initialized with ${keyType} key`);
        }
    }

    async upsertArticles(articles: Article[]): Promise<{ success: boolean; count: number }> {
        if (articles.length === 0) {
            return { success: true, count: 0 };
        }

        // Prepare rows with updated_at timestamp
        const rows = articles.map(a => ({
            url: a.url,
            title: a.title,
            source: a.source,
            sector: a.sector,
            time: a.time || 'Recent',
            summary: a.summary || '',
            updated_at: new Date().toISOString(),
        }));

        // Deduplicate by URL
        const uniqueRows = Array.from(
            new Map(rows.map(r => [r.url, r])).values()
        );

        const { error } = await this.client
            .from('articles')
            .upsert(uniqueRows, { onConflict: 'url', ignoreDuplicates: false });

        if (error) {
            console.error('[SupabaseRepository] Upsert error:', error);
            return { success: false, count: 0 };
        }

        return { success: true, count: uniqueRows.length };
    }

    async updateArticleContent(url: string, content: string): Promise<boolean> {
        const { error } = await this.client
            .from('articles')
            .update({
                content,
                deep_scraped: true,
                deep_scraped_at: new Date().toISOString(),
            })
            .eq('url', url);

        if (error) {
            console.error('[SupabaseRepository] Update content error:', error);
            return false;
        }

        return true;
    }

    async getArticles(sector: string, limit: number = 100): Promise<Article[]> {
        const { data, error } = await this.client
            .from('articles')
            .select('*')
            .eq('sector', sector)
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[SupabaseRepository] Get articles error:', error);
            return [];
        }

        return data || [];
    }

    async getArticlesBySource(source: string, limit: number = 50): Promise<Article[]> {
        const { data, error } = await this.client
            .from('articles')
            .select('*')
            .eq('source', source)
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[SupabaseRepository] Get by source error:', error);
            return [];
        }

        return data || [];
    }

    async getUnscrapedArticles(limit: number = 5): Promise<Article[]> {
        const { data, error } = await this.client
            .from('articles')
            .select('*')
            .or('deep_scraped.is.null,deep_scraped.eq.false')
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[SupabaseRepository] Get unscraped error:', error);
            return [];
        }

        return data || [];
    }

    async markAsDeepScraped(url: string): Promise<void> {
        const { error } = await this.client
            .from('articles')
            .update({
                deep_scraped: true,
                deep_scraped_at: new Date().toISOString(),
            })
            .eq('url', url);

        if (error) {
            console.error('[SupabaseRepository] Mark scraped error:', error);
        }
    }
}
