import { ExternalLink, Check } from "lucide-react";

interface Article {
    title: string;
    url: string;
    source: string;
    time?: string;
}

interface NewsListItemProps {
    article: Article;
    isSelected: boolean;
    onToggle: () => void;
}

export function NewsListItem({ article, isSelected, onToggle }: NewsListItemProps) {
    return (
        <div
            className={`group flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer ${isSelected
                ? "bg-blue-500/10 border-blue-500/50"
                : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                }`}
            onClick={onToggle}
        >
            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-600 text-transparent"
                }`}>
                <Check className="w-3 h-3 stroke-[3]" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${article.source.includes("PurseBlog") ? "bg-pink-900/30 text-pink-400 border border-pink-800/50" :
                        article.source.includes("Jing") ? "bg-red-900/30 text-red-400 border border-red-800/50" :
                            "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}>
                        {article.source}
                    </span>
                    {article.time && (
                        <span className="text-xs text-slate-500 font-mono">
                            {article.time}
                        </span>
                    )}
                </div>
                <h3 className={`text-sm md:text-base font-medium leading-relaxed ${isSelected ? "text-blue-100" : "text-slate-200"
                    }`}>
                    {article.title}
                </h3>
                <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-slate-500 hover:text-blue-400 mt-1 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    Read Source <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}
