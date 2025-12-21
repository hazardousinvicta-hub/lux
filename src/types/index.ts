export interface Article {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    snippet: string;
}

export interface StockSummary {
    ticker: string;
    companyName: string;
    price: number;
    changePercent: number;
    summary: string;
    articles: Article[];
}
