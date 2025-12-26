"use client";

import { Fragment } from "react";
import { Check, Loader2, Clock, XCircle } from "lucide-react";

export type SourceState = "pending" | "loading" | "success" | "error";

export interface SourceStatus {
    id: string;
    name: string;
    state: SourceState;
    count?: number;
    error?: string;
}

interface SourceStatusBarProps {
    sources: SourceStatus[];
    lastUpdated?: Date | null;
}

export function SourceStatusBar({ sources, lastUpdated }: SourceStatusBarProps) {
    if (sources.length === 0) return null;

    const getStateIcon = (state: SourceState) => {
        switch (state) {
            case "pending":
                return <Clock className="w-3 h-3 text-slate-500" />;
            case "loading":
                return <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />;
            case "success":
                return <Check className="w-3 h-3 text-emerald-500" />;
            case "error":
                return <XCircle className="w-3 h-3 text-red-500" />;
        }
    };

    const getStateColor = (state: SourceState) => {
        switch (state) {
            case "pending":
                return "border-slate-700 text-slate-500";
            case "loading":
                return "border-amber-500/50 text-amber-500";
            case "success":
                return "border-emerald-500/30 text-slate-300";
            case "error":
                return "border-red-500/30 text-red-400";
        }
    };

    const completedCount = sources.filter(s => s.state === "success" || s.state === "error").length;
    const totalArticles = sources.reduce((sum, s) => sum + (s.count || 0), 0);

    return (
        <div className="mb-6 font-mono text-[10px]">
            {/* Compact source pills row */}
            <div className="flex flex-wrap gap-2 items-center">
                {sources.map((source) => (
                    <div
                        key={source.id}
                        className={`flex items-center gap-1.5 px-2 py-1 border rounded-sm ${getStateColor(source.state)} transition-all`}
                        title={source.error || `${source.name}: ${source.count || 0} items`}
                    >
                        {getStateIcon(source.state)}
                        <span className="uppercase tracking-wider">{source.id}</span>
                        {source.state === "success" && source.count !== undefined && (
                            <span className="text-slate-500 ml-1">{source.count}</span>
                        )}
                    </div>
                ))}

                {/* Summary stats */}
                <div className="ml-auto flex items-center gap-4 text-slate-500">
                    <span>{completedCount}/{sources.length} SOURCES</span>
                    <span>{totalArticles} ITEMS</span>
                    {lastUpdated && (
                        <span className="text-amber-600/50">
                            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// Keep old component for backwards compatibility
export interface StatusItem {
    source: string;
    status: "success" | "warning" | "error";
    count: number;
    duration: number;
    error?: string;
}

interface SystemStatusProps {
    summary: StatusItem[];
    lastUpdated?: Date | null;
}

export function SystemStatus({ summary, lastUpdated }: SystemStatusProps) {
    // Convert old format to new format
    const sources: SourceStatus[] = summary.map(item => ({
        id: item.source.toLowerCase().replace(/\s+/g, ''),
        name: item.source,
        state: item.status === "success" ? "success" : "error",
        count: item.count,
        error: item.error
    }));

    return <SourceStatusBar sources={sources} lastUpdated={lastUpdated} />;
}
