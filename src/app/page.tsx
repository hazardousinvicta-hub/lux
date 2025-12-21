"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NewsCard } from "@/components/NewsCard";
import { InterestSettings } from "@/components/InterestSettings";
import { SystemStatus, StatusItem } from "@/components/SystemStatus";
import { RefreshCw, Zap, LayoutGrid } from "lucide-react";

interface Article {
  title: string;
  url: string;
  source: string;
  time?: string;
  summary?: string;
}

const LUXURY_SOURCES = [
  { id: 'cpp', name: 'CPP Luxury' },
  { id: 'jing', name: 'Jing Daily' },
  { id: 'purseblog', name: 'PurseBlog' },
  { id: 'forum', name: 'PurseBlog Forum' },
  { id: 'google', name: 'Google News' }
];

export default function Home() {
  const [sector, setSector] = useState<"semiconductors" | "luxury">("semiconductors");
  const userEmail = "hazardousinvicta@gmail.com";

  const [articles, setArticles] = useState<Article[]>([]);
  const [summary, setSummary] = useState<StatusItem[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterText, setFilterText] = useState("");

  // Progress State
  const [completedScrapes, setCompletedScrapes] = useState(0);
  const [totalScrapes, setTotalScrapes] = useState(0);

  const fetchNews = async () => {
    setIsLoading(true);
    setSummary([]);
    setArticles([]);
    setCompletedScrapes(0);

    // Check if running in Viewer Mode (Vercel deployment)
    const isViewerMode = process.env.NEXT_PUBLIC_VIEWER_MODE === 'true';

    if (isViewerMode) {
      // VIEWER MODE: Read from Supabase database
      setTotalScrapes(1);
      try {
        const res = await fetch(`/api/news?sector=${sector}`);
        const data = await res.json();
        if (data.articles) {
          setArticles(data.articles);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
        setLastUpdated(new Date());
      } catch (e) {
        console.error("Error fetching from database", e);
        setSummary([{ source: "Database", status: "error", count: 0, duration: 0, error: "Failed to fetch" }]);
      } finally {
        setCompletedScrapes(1);
        setIsLoading(false);
      }
      return;
    }

    // SCRAPER MODE: Fetch live from sources
    if (sector === "luxury") {
      setTotalScrapes(LUXURY_SOURCES.length);

      const promises = LUXURY_SOURCES.map(async (src) => {
        try {
          const res = await fetch(`/api/scrape?sector=luxury&source=${src.id}`);
          const data = await res.json();
          if (data.articles) {
            setArticles(prev => {
              const combined = [...prev, ...data.articles];
              // Unique by URL
              const unique = Array.from(new Map(combined.map(item => [item.url, item])).values());
              return unique;
            });
            if (data.summary && data.summary[0]) {
              setSummary(prev => [...prev, data.summary[0]]);
            }
          }
        } catch (e) {
          console.error(`Error scraping ${src.name}`, e);
          setSummary(prev => [...prev, { source: src.name, status: "error", count: 0, duration: 0, error: "Failed to fetch" }]);
        } finally {
          setCompletedScrapes(prev => prev + 1);
        }
      });

      await Promise.all(promises);
      setLastUpdated(new Date());
    } else {
      // Single source for Semis (Lithos)
      setTotalScrapes(1);
      try {
        const res = await fetch(`/api/scrape?sector=semiconductors`);
        const data = await res.json();
        if (data.articles) {
          setArticles(data.articles);
          if (data.summary) setSummary(data.summary);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch news", error);
      } finally {
        setCompletedScrapes(1);
      }
    }
    setIsLoading(false);
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

  const flaggedArticles = filteredArticles.filter((a) => isFlagged(a.title));
  const otherArticles = filteredArticles.filter((a) => !isFlagged(a.title));

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

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-[1600px] mx-auto bg-[#0a0a0a] text-slate-200 selection:bg-amber-500/30">
      {/* Amber Progress Bar */}
      {isLoading && totalScrapes > 0 && (
        <div className="fixed top-0 left-0 w-full h-1 bg-[#0a0a0a] z-50">
          <div
            className="h-full bg-amber-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]"
            style={{ width: `${(completedScrapes / totalScrapes) * 100}%` }}
          />
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-8 mb-12 border-b border-amber-900/20 pb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-medium text-white tracking-tight">
              {sector === "semiconductors" ? "Lithos Intelligence" : "Luxury Pulse"}
            </h1>
            <p className="text-amber-600/80 mt-2 text-xs font-mono uppercase tracking-[0.2em] ml-1">
              {sector === "semiconductors" ? "Semiconductor Sector Analysis" : "Global Market Intelligence"}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <Link
              href="/gallery"
              className="text-slate-500 hover:text-white transition-colors p-2"
              title="Archive"
            >
              <LayoutGrid className="w-5 h-5" />
            </Link>

            <button
              onClick={handleGenerateInfographic}
              disabled={isGenerating || articles.length === 0}
              className="group"
            >
              <div className={`px-5 py-2 border border-slate-700 text-slate-300 text-xs uppercase tracking-widest font-bold transition-all ${isGenerating ? "opacity-50" : "hover:border-amber-500 hover:text-amber-500"}`}>
                {isGenerating ? "GENERATING..." : "CREATE BRIEF"}
              </div>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-8 border-b border-slate-900/50">
          <button
            onClick={() => setSector("semiconductors")}
            className={`pb-4 text-sm uppercase tracking-widest transition-all border-b-2 ${sector === "semiconductors" ? "border-amber-500 text-white font-bold" : "border-transparent text-slate-500 hover:text-slate-300"}`}
          >
            Semiconductors
          </button>
          <button
            onClick={() => setSector("luxury")}
            className={`pb-4 text-sm uppercase tracking-widest transition-all border-b-2 ${sector === "luxury" ? "border-amber-500 text-white font-bold" : "border-transparent text-slate-500 hover:text-slate-300"}`}
          >
            Luxury Lifestyle
          </button>
        </div>
      </header>

      {/* System Status - Passed lastUpdated */}
      <SystemStatus summary={summary} lastUpdated={lastUpdated} />

      {/* Filters & Selection Controls */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <input
          type="text"
          placeholder="FILTER INTELLIGENCE..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="bg-transparent border-b border-slate-800 text-amber-500 placeholder-slate-600 py-2 text-sm w-64 focus:outline-none focus:border-amber-500 transition-colors font-mono uppercase tracking-wider"
        />
        <div className="flex items-center gap-4">
          {selectedArticles.size > 0 && (
            <button
              onClick={() => setSelectedArticles(new Set())}
              className="text-xs text-slate-500 hover:text-amber-500 uppercase tracking-widest transition-colors"
            >
              Deselect All
            </button>
          )}
          <button
            onClick={fetchNews}
            disabled={isLoading}
            className="text-slate-500 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <div className="text-sm font-serif text-slate-400 pl-4 border-l border-slate-800">
            <span className="text-white font-bold">{selectedArticles.size}</span> SELECTED
          </div>
        </div>
      </div>

      {/* Infographic Modal */}
      {infographicUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={() => setInfographicUrl(null)}>
          <div className="relative max-w-4xl w-full bg-[#0a0a0a] border border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={infographicUrl} alt="Executive Briefing" className="w-full h-auto" />
            <div className="p-4 bg-[#0a0a0a] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInfographicUrl(null)}
                className="px-6 py-2 border border-slate-700 text-white text-xs uppercase tracking-widest hover:bg-slate-900 transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-12">
        {/* All News Section - GRID LAYOUT */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Latest Wire
            </h2>
            <div className="text-[10px] text-amber-500/50 font-mono">
              {isLoading ? `SYNCING NODES ${completedScrapes}/${totalScrapes}...` : `${articles.length} UNITS`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredArticles.map((article) => (
              <NewsCard
                key={article.url}
                article={article}
                isSelected={selectedArticles.has(article.url)}
                onToggle={() => toggleArticle(article.url)}
              />
            ))}

            {isLoading && (
              [...Array(4)].map((_, i) => (
                <div key={`skel-${i}`} className="h-40 bg-slate-900/20 animate-pulse border-t border-slate-800/50" />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-24 pt-12 border-t border-amber-900/10">
        <InterestSettings
          keywords={keywords}
          onAddKeyword={(k) => setKeywords([...keywords, k])}
          onRemoveKeyword={(k) => setKeywords(keywords.filter((w) => w !== k))}
        />
      </div>
    </main>
  );
}
