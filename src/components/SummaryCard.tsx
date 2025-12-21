import { StockSummary } from "@/types";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface SummaryCardProps {
    data: StockSummary;
}

export function SummaryCard({ data }: SummaryCardProps) {
    const isPositive = data.changePercent >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {data.ticker}
                        <span className="text-lg font-normal text-gray-500">
                            {data.companyName}
                        </span>
                    </h2>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-bold">
                            ${data.price.toFixed(2)}
                        </span>
                        <span
                            className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            {isPositive ? "+" : ""}
                            {data.changePercent.toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
            </div>

            <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Daily AI Summary
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {data.summary}
                </p>
            </div>
        </motion.div>
    );
}
