import { useState } from "react";
import { Plus, X } from "lucide-react";

interface InterestSettingsProps {
    keywords: string[];
    onAddKeyword: (keyword: string) => void;
    onRemoveKeyword: (keyword: string) => void;
}

export function InterestSettings({
    keywords,
    onAddKeyword,
    onRemoveKeyword,
}: InterestSettingsProps) {
    const [newKeyword, setNewKeyword] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newKeyword.trim()) {
            onAddKeyword(newKeyword.trim());
            setNewKeyword("");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-end gap-4 border-b border-slate-800 pb-4">
                <h3 className="text-lg font-serif text-slate-300">
                    Intelligence Filters
                </h3>

                <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder="ADD TOPIC..."
                        className="flex-1 bg-transparent border-b border-transparent focus:border-amber-500 text-sm py-1 text-amber-500 placeholder-slate-700 outline-none transition-colors font-mono uppercase font-bold"
                    />
                    <button
                        type="submit"
                        disabled={!newKeyword}
                        className="text-slate-500 hover:text-amber-500 disabled:opacity-30 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </form>
            </div>

            <div className="flex flex-wrap gap-3">
                {keywords.map((keyword) => (
                    <div
                        key={keyword}
                        className="group flex items-center gap-2 px-3 py-1.5 border border-slate-800 text-xs text-slate-400 font-mono uppercase tracking-wider hover:border-amber-900 hover:text-amber-500 transition-colors cursor-default"
                    >
                        <span>{keyword}</span>
                        <button
                            onClick={() => onRemoveKeyword(keyword)}
                            className="text-slate-600 group-hover:text-red-500 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
                {keywords.length === 0 && (
                    <span className="text-xs text-slate-700 font-mono italic">No active filters.</span>
                )}
            </div>
        </div>
    );
}
