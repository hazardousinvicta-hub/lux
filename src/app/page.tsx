"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NewsCard } from "@/components/NewsCard";
import { InterestSettings } from "@/components/InterestSettings";
import { SourceStatusBar, SourceStatus, SourceState } from "@/components/SystemStatus";
import { RefreshCw, LayoutGrid } from "lucide-react";

interface Article {
  title: string;
  url: string;
  source: string;
  time?: string;
  summary?: string;
}

// Source name -> frontend ID mapping
const normalizeSourceId = (sourceName: string): string => {
  const normalized = sourceName.toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '');
  const map: Record<string, string> = {
    // Luxury
    'cppluxury': 'cpp',
    'jingdaily': 'jing',
    'purseblog': 'purseblog',
    'purseblogforum': 'forum',
    'googlenews': 'google',
    'googlenewsluxury': 'google',
    // Tech
    'lithosgraphein': 'lithos',
    'semianalysis': 'semianalysis',
    'fabricatedknowledge': 'fabricated',
    'asianometry': 'asianometry',
    'morethanmoore': 'morethanmoore',
    'hackernews': 'hackernews',
    'techcrunch': 'techcrunch',
    'arstechnica': 'ars',
    'googletechnews': 'google',
  };
  return map[normalized] || normalized;
};

const LUXURY_SOURCES = [
  { id: 'cpp', name: 'CPP Luxury' },
  { id: 'jing', name: 'Jing Daily' },
  { id: 'purseblog', name: 'PurseBlog' },
  { id: 'forum', name: 'Forum' },
  { id: 'google', name: 'Google News' }
];

const SEMI_SOURCES = [
  { id: 'lithos', name: 'Lithos' },
  { id: 'semianalysis', name: 'SemiAnalysis' },
  { id: 'fabricated', name: 'Fabricated' },
  { id: 'hackernews', name: 'Hacker News' },
  { id: 'techcrunch', name: 'TechCrunch' },
  { id: 'ars', name: 'Ars Technica' },
  { id: 'google', name: 'Google Tech' }
];

export default function Home() {
  const [sector, setSector] = useState<"semiconductors" | "luxury">("semiconductors");
  const userEmail = "hazardousinvicta@gmail.com";

  const [articles, setArticles] = useState<Article[]>([]);
  const [sourceStates, setSourceStates] = useState<Record<string, SourceStatus>>({});
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterText, setFilterText] = useState("");

  // Get sources for current sector
  const currentSources = sector === "luxury" ? LUXURY_SOURCES : SEMI_SOURCES;

  // Initialize source states
  const initSourceStates = (sources: typeof LUXURY_SOURCES) => {
    const states: Record<string, SourceStatus> = {};
    sources.forEach(src => {
      states[src.id] = { id: src.id, name: src.name, state: "pending" };
    });
    setSourceStates(states);
  };

  // Update a single source state
  const updateSourceState = (id: string, state: SourceState, count?: number, error?: string) => {
    setSourceStates(prev => ({
      ...prev,
      [id]: { ...prev[id], state, count, error }
    }));
  };

  const fetchNews = async () => {
    setIsLoading(true);
    setArticles([]);
    initSourceStates(currentSources);

    try {
      const res = await fetch(`/api/news?sector=${sector}`);
      const data = await res.json();

      if (data.articles) {
        setArticles(data.articles);

        // Count articles by source
        const counts: Record<string, number> = {};
        data.articles.forEach((a: Article) => {
          const srcId = normalizeSourceId(a.source);
          counts[srcId] = (counts[srcId] || 0) + 1;
        });

        // Update all source states with counts
        currentSources.forEach(src => {
          const count = counts[src.id] || 0;
          updateSourceState(src.id, "success", count);
        });
      }

      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching from database", e);
      currentSources.forEach(src => updateSourceState(src.id, "error", 0, "Failed to fetch"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    if (sector === "semiconductors") {
      setKeywords(["TSMC", "3nm", "AI", "Nvidia"]);
    } else {
      setKeywords(["Rolex", "LVMH", "Hermes", "Watch"]);
    }
    setSelectedArticles(new Set());
  }, [sector]);

  const toggleArticle = (url: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedArticles(newSelected);
  };

  const isFlagged = (title: string) => {
    return keywords.some((keyword) =>
      title.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const filteredArticles = articles.filter(a => {
    const matchesFilter = a.title.toLowerCase().includes(filterText.toLowerCase()) ||
      a.source.toLowerCase().includes(filterText.toLowerCase());
    return matchesFilter;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);

  const handleGenerateInfographic = async () => {
    const articlesToProcess = articles.filter(a => selectedArticles.has(a.url));

    if (articlesToProcess.length === 0) {
      alert("Please select at least one article to include in the briefing.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: articlesToProcess,
          sector,
          email: userEmail
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setInfographicUrl(data.imageUrl);
        if (data.emailStatus === "success") {
          alert(`Briefing generated and sent to ${userEmail}`);
        } else if (data.emailStatus?.startsWith("failed")) {
          alert(`Briefing generated, but delivery failed: ${data.emailStatus}`);
        }
      }
    } catch (error) {
      console.error("Failed to generate", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Convert sourceStates to array for SourceStatusBar
  const sourcesArray = Object.values(sourceStates);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto bg-[#0a0a0a] text-slate-200 selection:bg-amber-500/30">
      {/* Header - More compact */}
      <header className="flex flex-col gap-4 mb-6 border-b border-amber-900/20 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-medium text-white tracking-tight">
              {sector === "semiconductors" ? "Lithos Intelligence" : "Luxury Pulse"}
            </h1>
            <p className="text-amber-600/80 mt-1 text-[10px] font-mono uppercase tracking-[0.2em]">
              {sector === "semiconductors" ? "Semiconductor Analysis" : "Market Intelligence"}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <Link
              href="/gallery"
              className="text-slate-500 hover:text-white transition-colors p-2"
              title="Archive"
            >
              <LayoutGrid className="w-4 h-4" />
            </Link>

            <button
              onClick={handleGenerateInfographic}
              disabled={isGenerating || articles.length === 0}
              className="group"
            >
              <div className={`px-4 py-1.5 border border-slate-700 text-slate-300 text-[10px] uppercase tracking-widest font-bold transition-all ${isGenerating ? "opacity-50" : "hover:border-amber-500 hover:text-amber-500"}`}>
                {isGenerating ? "GENERATING..." : "CREATE BRIEF"}
              </div>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Compact */}
        <div className="flex gap-6">
          <button
            onClick={() => setSector("semiconductors")}
            className={`pb-2 text-xs uppercase tracking-widest transition-all border-b-2 ${sector === "semiconductors" ? "border-amber-500 text-white font-bold" : "border-transparent text-slate-500 hover:text-slate-300"}`}
          >
            Semiconductors
          </button>
          <button
            onClick={() => setSector("luxury")}
            className={`pb-2 text-xs uppercase tracking-widest transition-all border-b-2 ${sector === "luxury" ? "border-amber-500 text-white font-bold" : "border-transparent text-slate-500 hover:text-slate-300"}`}
          >
            Luxury
          </button>
        </div>
      </header>

      {/* Source Status Bar - New compact design */}
      <SourceStatusBar sources={sourcesArray} lastUpdated={lastUpdated} />

      {/* Filters & Selection Controls - More compact */}
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
        <input
          type="text"
          placeholder="FILTER..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="bg-transparent border-b border-slate-800 text-amber-500 placeholder-slate-600 py-1 text-xs w-48 focus:outline-none focus:border-amber-500 transition-colors font-mono uppercase tracking-wider"
        />
        <div className="flex items-center gap-3">
          {selectedArticles.size > 0 && (
            <button
              onClick={() => setSelectedArticles(new Set())}
              className="text-[10px] text-slate-500 hover:text-amber-500 uppercase tracking-widest transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={fetchNews}
            disabled={isLoading}
            className="text-slate-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <div className="text-[10px] font-mono text-slate-400 pl-3 border-l border-slate-800">
            <span className="text-white font-bold">{selectedArticles.size}</span> SEL
          </div>
        </div>
      </div>

      {/* Infographic Modal */}
      {infographicUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={() => setInfographicUrl(null)}>
          <div className="relative max-w-4xl w-full bg-[#0a0a0a] border border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={infographicUrl} alt="Executive Briefing" className="w-full h-auto" />
            <div className="p-3 bg-[#0a0a0a] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInfographicUrl(null)}
                className="px-4 py-1.5 border border-slate-700 text-white text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content - Tighter grid */}
      <div className="space-y-8">
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredArticles.map((article) => (
              <NewsCard
                key={article.url}
                article={article}
                isSelected={selectedArticles.has(article.url)}
                onToggle={() => toggleArticle(article.url)}
              />
            ))}

            {isLoading && (
              [...Array(5)].map((_, i) => (
                <div key={`skel-${i}`} className="h-28 bg-slate-900/20 animate-pulse border-t border-slate-800/50" />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-16 pt-8 border-t border-amber-900/10">
        <InterestSettings
          keywords={keywords}
          onAddKeyword={(k) => setKeywords([...keywords, k])}
          onRemoveKeyword={(k) => setKeywords(keywords.filter((w) => w !== k))}
        />
      </div>
    </main>
  );
}
