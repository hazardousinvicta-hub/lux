import { ExternalLink, Check, Clock, ChevronRight } from "lucide-react";

interface Article {
    title: string;
    url: string;
    source: string;
    time?: string;
    summary?: string;
}

interface NewsCardProps {
    article: Article;
    isSelected: boolean;
    onToggle: () => void;
}

export function NewsCard({ article, isSelected, onToggle }: NewsCardProps) {
    return (
        <div
            className={`group relative flex flex-col justify-between p-5 rounded-none border-t-[3px] transition-all cursor-pointer h-full bg-slate-900/40 backdrop-blur-sm ${isSelected
                ? "border-t-amber-500 bg-slate-800/60 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]"
                : "border-t-transparent hover:border-t-amber-500/50 hover:bg-slate-800/40"
                }`}
            onClick={onToggle}
        >
            {/* Selection Checkmark Overlay */}
            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center transition-all ${isSelected ? "bg-amber-500 border-amber-500 text-slate-900" : "text-transparent opacity-0 group-hover:opacity-100"
                }`}>
                <Check className="w-3 h-3 stroke-[3]" />
            </div>

            <div className="mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {article.source}
                </span>
            </div>

            <div className="flex-1">
                <h3 className={`font-serif text-lg leading-snug mb-3 transition-colors ${isSelected ? "text-amber-50" : "text-slate-200 group-hover:text-white"
                    }`}>
                    {article.title}
                </h3>

                {article.summary && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4 font-light">
                        {article.summary}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between mt-4 border-t border-slate-800/50 pt-3">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                    {article.time || "RECENT"}
                </div>

                <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                    Read <ChevronRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}
