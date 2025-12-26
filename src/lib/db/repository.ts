/**
 * Database Repository Pattern
 * 
 * Abstracts database operations so we can swap providers later.
 * Currently implemented with Supabase, but could be SQLite, Postgres, etc.
 */

export interface Article {
    id?: string;
    url: string;
    title: string;
    source: string;
    sector: 'luxury' | 'semiconductors';
    time?: string;
    summary?: string;
    content?: string;          // Full article text (from deep scraping)
    deep_scraped?: boolean;    // Whether we've scraped full content
    deep_scraped_at?: string;  // When deep scraped
    updated_at?: string;
}

export interface ArticleCounts {
    [sourceId: string]: number;
}

export interface ArticleRepository {
    // Write operations (used by daemon)
    upsertArticles(articles: Article[]): Promise<{ success: boolean; count: number }>;
    updateArticleContent(url: string, content: string): Promise<boolean>;

    // Read operations (used by frontend)
    getArticles(sector: string, limit?: number): Promise<Article[]>;
    getArticlesBySource(source: string, limit?: number): Promise<Article[]>;

    // Daemon operations
    getUnscrapedArticles(limit?: number): Promise<Article[]>;
    markAsDeepScraped(url: string): Promise<void>;
}

// Factory function - makes it easy to swap implementations
export function createRepository(): ArticleRepository {
    // Import dynamically to avoid circular deps
    const { SupabaseRepository } = require('./supabase-repository');
    return new SupabaseRepository();
}
