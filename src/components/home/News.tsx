'use client';

import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

export interface NewsItem {
    date: string;
    content: string;
}

interface NewsProps {
    items: NewsItem[];
    title?: string;
}

export default function News({ items, title = 'News' }: NewsProps) {
    const [expanded, setExpanded] = useState(false);
    const collapsedCount = 3;

    const visibleItems = useMemo(() => {
        return expanded ? items : items.slice(0, collapsedCount);
    }, [expanded, items]);

    const showToggle = items.length > collapsedCount;

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
        >
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">{title}</h2>

            {/* Only enable internal scrolling when expanded */}
            <div className={expanded ? 'max-h-48 overflow-y-auto pr-2' : ''}>
                <div className="space-y-3">
                    {visibleItems.map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                            <span className="text-xs text-neutral-500 mt-1 w-16 flex-shrink-0">{item.date}</span>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300">{item.content}</p>
                        </div>
                    ))}
                </div>
            </div>

            {showToggle && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-3 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </motion.section>
    );
}
