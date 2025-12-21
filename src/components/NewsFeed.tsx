import { Article } from "@/types";
import { ExternalLink } from "lucide-react";

interface NewsFeedProps {
    articles: Article[];
}

export function NewsFeed({ articles }: NewsFeedProps) {
    if (articles.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                No recent news found.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">Latest News</h3>
            <div className="grid gap-4">
                {articles.map((article, index) => (
                    <a
                        key={index}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
                    >
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h4 className="font-medium group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {article.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {article.source}
                                    </span>
                                    <span>•</span>
                                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                                </div>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                    {article.snippet}
                                </p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}
