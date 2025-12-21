import { Fragment } from "react";
import { Check, AlertTriangle, XCircle, Clock, Terminal } from "lucide-react";

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
    if (summary.length === 0) return null;

    return (
        <div className="mb-8 rounded-none border border-amber-900/40 bg-black p-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 mb-4 border-b border-amber-900/30 pb-2 text-amber-600/50 uppercase tracking-widest">
                <Terminal className="w-3 h-3" />
                <span>System_Diagnostics_v2.0</span>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2 text-amber-500/80">
                <div className="text-slate-500 mb-2">SOURCE</div>
                <div className="text-slate-500 mb-2 text-right">LATENCY</div>
                <div className="text-slate-500 mb-2 text-right">STATUS</div>

                {summary.map((item) => (
                    <Fragment key={item.source}>
                        <div className="flex items-center gap-2">
                            <span className={item.status === 'success' ? 'text-amber-500' : 'text-red-500'}>
                                {item.source.toUpperCase()}
                            </span>
                        </div>
                        <div className="text-right text-slate-500">
                            {item.duration > 0 ? `${(item.duration / 1000).toFixed(2)}s` : '--'}
                        </div>
                        <div className="text-right flex justify-end">
                            {item.status === "success" ? (
                                <span className="text-emerald-500 flex items-center gap-1">
                                    OK <Check className="w-3 h-3" />
                                </span>
                            ) : (
                                <span className="text-red-500 flex items-center gap-1">
                                    ERR <XCircle className="w-3 h-3" />
                                </span>
                            )}
                        </div>
                    </Fragment>
                ))}
            </div>

            <div className="mt-4 pt-2 border-t border-amber-900/30 flex justify-between text-amber-700">
                <span>TOTAL_NODES: {summary.length}</span>
                <span className="flex items-center gap-2">
                    LAST_SYNC: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--:--:--"}
                </span>
            </div>
        </div>
    );
}
