import { Check, ChevronRight } from "lucide-react";

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
            className={`group relative flex flex-col justify-between p-3 border-l-2 transition-all cursor-pointer h-full bg-slate-900/30 hover:bg-slate-800/40 ${isSelected
                ? "border-l-amber-500 bg-slate-800/50"
                : "border-l-transparent hover:border-l-amber-500/50"
                }`}
            onClick={onToggle}
        >
            {/* Selection indicator */}
            <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected
                ? "bg-amber-500 border-amber-500 text-slate-900"
                : "border-slate-600 opacity-0 group-hover:opacity-50"
                }`}>
                <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>

            {/* Source tag */}
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {article.source}
            </span>

            {/* Title */}
            <h3 className={`font-serif text-sm leading-tight line-clamp-3 transition-colors ${isSelected ? "text-amber-50" : "text-slate-200 group-hover:text-white"
                }`}>
                {article.title}
            </h3>

            {/* Footer */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/50 text-[9px]">
                <span className="text-slate-500 font-mono">
                    {article.time || "RECENT"}
                </span>

                <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-0.5 uppercase font-bold tracking-wider text-amber-500/70 hover:text-amber-400 transition-colors"
                >
                    Read <ChevronRight className="w-2.5 h-2.5" />
                </a>
            </div>
        </div>
    );
}
