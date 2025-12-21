"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

interface SearchBarProps {
    onSearch: (ticker: string) => void;
    isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
    const [ticker, setTicker] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (ticker.trim()) {
            onSearch(ticker.trim().toUpperCase());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md relative">
            <div className="relative flex items-center">
                <Search className="absolute left-4 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="Enter stock ticker (e.g. AAPL)"
                    className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    disabled={isLoading}
                />
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isLoading || !ticker.trim()}
                    className="absolute right-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? "Searching..." : "Search"}
                </motion.button>
            </div>
        </form>
    );
}
