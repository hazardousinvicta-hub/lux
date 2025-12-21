"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, Grid } from "lucide-react";

interface Generation {
    id: string;
    timestamp: string;
    imageUrl: string;
    sector: string;
    articleCount: number;
}

export default function GalleryPage() {
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch("/api/generations")
            .then((res) => res.json())
            .then((data) => {
                // Sort by timestamp descending
                const sorted = Array.isArray(data) ? data.sort((a: Generation, b: Generation) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                ) : [];
                setGenerations(sorted);
            })
            .catch((err) => console.error("Failed to load gallery", err))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <main className="min-h-screen p-6 md:p-12 max-w-[1600px] mx-auto bg-[#0a0a0a] text-slate-200 selection:bg-amber-500/30">
            <header className="flex flex-col gap-8 mb-12 border-b border-amber-900/20 pb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-serif font-medium text-white tracking-tight">
                            Intelligence Archive
                        </h1>
                        <p className="text-amber-600/80 mt-2 text-xs font-mono uppercase tracking-[0.2em] ml-1">
                            Historical Briefings & Data Visualizations
                        </p>
                    </div>

                    <Link
                        href="/"
                        className="group flex items-center gap-2 px-5 py-2 border border-slate-700 text-slate-300 text-xs uppercase tracking-widest font-bold hover:border-amber-500 hover:text-amber-500 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Wire
                    </Link>
                </div>
            </header>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="aspect-[3/4] bg-slate-900/30 animate-pulse border border-slate-800" />
                    ))}
                </div>
            ) : generations.length === 0 ? (
                <div className="text-center py-24 text-slate-500 font-serif italic text-lg opacity-50">
                    No archives available. Generate a briefing to see it here.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {generations.map((gen) => (
                        <div key={gen.id} className="group relative bg-black border border-slate-800 hover:border-amber-900/50 transition-colors">
                            <div className="aspect-[3/4] relative overflow-hidden bg-slate-900">
                                <img
                                    src={gen.imageUrl}
                                    alt={`Briefing ${gen.timestamp}`}
                                    className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                />

                                {/* Overlay details */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                    <div className="flex justify-between items-end border-b border-slate-700 pb-3 mb-3">
                                        <span className="text-amber-500 font-mono text-xs uppercase tracking-widest">
                                            {new Date(gen.timestamp).toLocaleDateString()}
                                        </span>
                                        <a
                                            href={gen.imageUrl}
                                            download={`briefing-${gen.id}.png`}
                                            className="text-white hover:text-amber-400 transition-colors"
                                            title="Download High-Res"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </div>
                                    <div className="text-slate-300 text-sm font-serif">
                                        {gen.articleCount ? `${gen.articleCount} Articles Analyzed` : 'Market Analysis'}
                                    </div>
                                    <div className="text-slate-500 text-xs mt-1 uppercase tracking-wide">
                                        {gen.sector || 'General'} SECTOR
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
