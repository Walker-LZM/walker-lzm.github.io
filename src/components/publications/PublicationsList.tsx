'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    CalendarIcon,
    BookOpenIcon,
    ClipboardDocumentIcon,
    DocumentTextIcon,
    LinkIcon,
    CodeBracketIcon,
    DocumentIcon,
    UserIcon
} from '@heroicons/react/24/outline';
import { Publication } from '@/types/publication';
import { PublicationPageConfig } from '@/types/page';
import { cn } from '@/lib/utils';

interface PublicationsListProps {
    config: PublicationPageConfig;
    publications: Publication[];
    embedded?: boolean;
}

// Badge styling rules (case-insensitive detection; canonical labels come from bibtexParser)
//
// Visual intent (from strongest to weakest):
//  - strong  : Awards / Highly Cited / Hot (most prominent)
//  - medium  : Top-tier A-like rankings (noticeable but weaker than awards)
//  - soft    : Mid-tier ranks (e.g., B) and top partitions (Q1/Z1)
//  - muted   : Second-tier partitions (Q2/Z2)
//  - default : Everything else (neutral grey)
type BadgeTone = 'award' | 'rank' | 'partition' | 'other';
type BadgeVariant = 'strong' | 'medium' | 'soft' | 'muted' | 'default';

function badgeTone(label: string): BadgeTone {
    const u = label.trim().toUpperCase();

    // Awards / special highlights
    if (/(BEST|AWARD|OUTSTANDING|HONORABLE|HIGHLY\s*CITED|\bHOT\b)/i.test(label)) return 'award';

    // Partitions
    if (/^(JCR\s+Q[1-4]|CITESCORE\s+Q[1-4]|CAS\s+Z[1-4])$/.test(u)) return 'partition';

    // Rankings
    if (
        /^CCF-[ABC]$/.test(u) ||
        /^CAA-(A\+|A|B|C)$/.test(u) ||
        /^CAAI-[ABC]$/.test(u) ||
        /^CORE\s+(A\*|A|B|C)$/.test(u) ||
        /^TH-[AB]$/.test(u)
    ) {
        return 'rank';
    }

    return 'other';
}

function badgeVariant(label: string): BadgeVariant {
    const u = label.trim().toUpperCase();

    // Strong highlight: awards / outstanding / honorable / highly cited / hot
    if (badgeTone(label) === 'award') return 'strong';

    // ----- Partitions: JCR / CiteScore (Q1..Q4), CAS (Z1..Z4) -----
    let m: RegExpMatchArray | null;

    m = u.match(/^JCR\s+Q([1-4])$/);
    if (m) {
        const q = Number(m[1]);
        if (q === 1) return 'soft';
        if (q === 2) return 'muted';
        // Q3 and Q4 look the same
        return 'default';
    }

    m = u.match(/^CITESCORE\s+Q([1-4])$/);
    if (m) {
        const q = Number(m[1]);
        if (q === 1) return 'soft';
        if (q === 2) return 'muted';
        // Q3 and Q4 look the same
        return 'default';
    }

    m = u.match(/^CAS\s+Z([1-4])$/);
    if (m) {
        const z = Number(m[1]);
        if (z === 1) return 'soft';
        if (z === 2) return 'muted';
        // Z3 and Z4 look the same
        return 'default';
    }

    // ----- Rankings with A/B/C (and variants like A+, A*) -----
    // CCF-A/B/C
    m = u.match(/^CCF-([ABC])$/);
    if (m) {
        if (m[1] === 'A') return 'medium';
        // B should be noticeably weaker than A
        if (m[1] === 'B') return 'muted';
        return 'default'; // C
    }

    // CAA-A+/A/B/C
    m = u.match(/^CAA-(A\+|A|B|C)$/);
    if (m) {
        const r = m[1];
        // A+ slightly stronger than A, but still weaker than awards
        if (r === 'A+') return 'medium';
        if (r === 'A') return 'medium';
        if (r === 'B') return 'muted';
        return 'default';
    }

    // CAAI-A/B/C
    m = u.match(/^CAAI-([ABC])$/);
    if (m) {
        if (m[1] === 'A') return 'medium';
        if (m[1] === 'B') return 'muted';
        return 'default';
    }

    // CORE A*/A/B/C
    m = u.match(/^CORE\s+(A\*|A|B|C)$/);
    if (m) {
        const r = m[1];
        if (r === 'A*') return 'medium';
        if (r === 'A') return 'medium';
        if (r === 'B') return 'muted';
        return 'default';
    }

    // TH-A/B
    m = u.match(/^TH-([AB])$/);
    if (m) {
        if (m[1] === 'A') return 'medium';
        return 'muted';
    }

    // For other labels (Oral/Poster/Spotlight/etc.), keep neutral by default.
    return 'default';
}

function badgeClass(label: string): string {
    const tone = badgeTone(label);
    const variant = badgeVariant(label);

    // Neutral grey for: non-highlighted, low tiers, and general tags
    const neutral = 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';

    if (tone === 'award') {
        // Most prominent (stronger than ranks/partitions)
        return 'bg-warning text-white border-warning dark:bg-warning dark:border-warning';
    }

    if (tone === 'rank') {
        // Ranking: use INFO color family (blue-ish), with A/B/C intensity
        switch (variant) {
            case 'medium':
                // A / A+ / A*  (noticeable, but weaker than awards)
                return 'bg-info/15 text-info border-info/45 dark:bg-info/20 dark:border-info/55 font-semibold';
            case 'muted':
                // B (weaker than A)
                // Slight fill to improve legibility, still clearly weaker than A
                return 'bg-info/5 text-info/90 border-info/25 dark:bg-info/10 dark:text-info/90 dark:border-info/30';
            default:
                // C
                return neutral;
        }
    }

    if (tone === 'partition') {
        // Partitions: use SUCCESS color family (green-ish), with Q/Z intensity
        switch (variant) {
            case 'soft':
                // Q1 / Z1
                return 'bg-success/15 text-success border-success/40 dark:bg-success/20 dark:border-success/50';
            case 'muted':
                // Q2 / Z2
                // Slight fill to improve legibility, still weaker than Q1/Z1
                return 'bg-success/5 text-success/90 border-success/25 dark:bg-success/10 dark:text-success/90 dark:border-success/30';
            default:
                // Q3/Q4, Z3/Z4
                return neutral;
        }
    }

    return neutral;
}

function HoverTooltip({ label }: { label: string }) {
    return (
        <span
            className={cn(
                'pointer-events-none absolute z-20 left-1/2 -translate-x-1/2',
                // Show above the icon button
                '-top-9',
                'whitespace-nowrap rounded-md px-2 py-1 text-xs',
                'bg-neutral-900 text-white shadow-sm',
                'opacity-0 translate-y-1',
                'group-hover:opacity-100 group-hover:translate-y-0',
                'group-focus-visible:opacity-100 group-focus-visible:translate-y-0',
                'transition-all duration-150'
            )}
        >
            {label}
        </span>
    );
}

function ActionIconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={cn(
                'group relative inline-flex h-7 w-7 items-center justify-center rounded-md',
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                'hover:bg-accent hover:text-white transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900'
            )}
        >
            {children}
            <HoverTooltip label={label} />
        </a>
    );
}

function ActionIconButton({
    onClick,
    label,
    isActive,
    children
}: {
    onClick: () => void;
    label: string;
    isActive?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cn(
                'group relative inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900',
                isActive
                    ? 'bg-accent text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-accent hover:text-white'
            )}
        >
            {children}
            <HoverTooltip label={label} />
        </button>
    );
}

export default function PublicationsList({ config, publications, embedded = false }: PublicationsListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
    const [selectedType, setSelectedType] = useState<string | 'all'>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [sortMode, setSortMode] = useState<'year' | 'contribution'>('year');
    const [expandedBibtexId, setExpandedBibtexId] = useState<string | null>(null);
    const [expandedAbstractId, setExpandedAbstractId] = useState<string | null>(null);

    // Extract unique years and types for filters
    const years = useMemo(() => {
        const uniqueYears = Array.from(new Set(publications.map(p => p.year)));
        return uniqueYears.sort((a, b) => b - a);
    }, [publications]);

    const types = useMemo(() => {
        const uniqueTypes = Array.from(new Set(publications.map(p => p.type)));
        return uniqueTypes.sort();
    }, [publications]);

    // Filter publications
    const filteredPublications = useMemo(() => {
        return publications.filter(pub => {
            const matchesSearch =
                pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pub.authors.some(author => author.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                pub.journal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pub.conference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pub.badges?.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesYear = selectedYear === 'all' || pub.year === selectedYear;
            const matchesType = selectedType === 'all' || pub.type === selectedType;

            return matchesSearch && matchesYear && matchesType;
        });
    }, [publications, searchQuery, selectedYear, selectedType]);

    function getMyContributionRank(pub: Publication): number {
        // Smaller means higher priority.
        // Priority: 1st author > co-first (#) > corresponding (*) > 2nd author > 3rd author > ... > not found
        const idx = pub.authors.findIndex(a => a.isHighlighted);
        if (idx < 0) return 99;

        const me = pub.authors[idx];

        if (idx === 0) return 0;
        if (me.isCoAuthor) return 1;
        if (me.isCorresponding) return 2;
        // Author position order: 2nd author > 3rd author > ...
        // idx: 1 -> 3, 2 -> 4, 3 -> 5, ...
        return 3 + Math.max(0, idx - 1);
    }

    function getMonthValue(month?: string | number): number {
        if (!month) return 0;
        if (typeof month === 'number') return month;
        const m = month.trim().toLowerCase();
        const monthMapping: Record<string, number> = {
            jan: 1,
            january: 1,
            feb: 2,
            february: 2,
            mar: 3,
            march: 3,
            apr: 4,
            april: 4,
            may: 5,
            jun: 6,
            june: 6,
            jul: 7,
            july: 7,
            aug: 8,
            august: 8,
            sep: 9,
            sept: 9,
            september: 9,
            oct: 10,
            october: 10,
            nov: 11,
            november: 11,
            dec: 12,
            december: 12
        };
        if (monthMapping[m]) return monthMapping[m];
        const n = parseInt(m, 10);
        return Number.isFinite(n) ? n : 0;
    }

    const displayedPublications = useMemo(() => {
        const arr = filteredPublications.slice();
        arr.sort((a, b) => {
            const ra = getMyContributionRank(a);
            const rb = getMyContributionRank(b);

            if (sortMode === 'contribution') {
                // Primary: authorship contribution
                if (ra !== rb) return ra - rb;

                // Tie-breakers: year desc, month desc, title
                if (b.year !== a.year) return b.year - a.year;
                const mm = getMonthValue(b.month) - getMonthValue(a.month);
                if (mm !== 0) return mm;
                return a.title.localeCompare(b.title);
            }

            // Default: year (new → old), then authorship within same year
            if (b.year !== a.year) return b.year - a.year;
            if (ra !== rb) return ra - rb;

            const mm = getMonthValue(b.month) - getMonthValue(a.month);
            if (mm !== 0) return mm;
            return a.title.localeCompare(b.title);
        });
        return arr;
    }, [filteredPublications, sortMode]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className="mb-8">
                <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-primary mb-4`}>{config.title}</h1>
                {config.description && (
                    <p className={`${embedded ? "text-base" : "text-lg"} text-neutral-600 dark:text-neutral-500 max-w-2xl`}>
                        {config.description}
                    </p>
                )}
            </div>

            {/* Search and Filter Controls */}
            <div className="mb-8 space-y-4">
                {/* ... (keep existing controls) ... */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search publications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center justify-center px-4 py-2 rounded-lg border transition-all duration-200",
                            showFilters
                                ? "bg-accent text-white border-accent"
                                : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 hover:border-accent hover:text-accent"
                        )}
                    >
                        <FunnelIcon className="h-5 w-5 mr-2" />
                        Filters
                    </button>

                    {!embedded && (
                        <button
                            type="button"
                            onClick={() => setSortMode(sortMode === 'year' ? 'contribution' : 'year')}
                            className={cn(
                                "relative group flex items-center justify-center w-10 h-10 rounded-lg border transition-all duration-200",
                                sortMode === 'contribution'
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 hover:border-accent hover:text-accent'
                            )}
                            aria-label={
                                sortMode === 'year'
                                    ? 'Sort: Year → Authorship (click to switch)'
                                    : 'Sort: Authorship → Year (click to switch)'
                            }
                            title={sortMode === 'year' ? 'Year → Authorship' : 'Authorship → Year'}
                        >
                            {sortMode === 'year' ? <CalendarIcon className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700/30 dark:border-neutral-300/60 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shadow-sm">
                                {sortMode === 'year' ? 'Year → Authorship' : 'Authorship → Year'}
                            </span>
                        </button>
                    )}
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-6">
                                {/* Year Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center">
                                        <CalendarIcon className="h-4 w-4 mr-1" /> Year
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedYear('all')}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedYear === 'all'
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                            )}
                                        >
                                            All
                                        </button>
                                        {years.map(year => (
                                            <button
                                                key={year}
                                                onClick={() => setSelectedYear(year)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full transition-colors",
                                                    selectedYear === year
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                                )}
                                            >
                                                {year}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Type Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center">
                                        <BookOpenIcon className="h-4 w-4 mr-1" /> Type
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedType('all')}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedType === 'all'
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                            )}
                                        >
                                            All
                                        </button>
                                        {types.map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setSelectedType(type)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full capitalize transition-colors",
                                                    selectedType === type
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                                )}
                                            >
                                                {type.replace('-', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Publications Grid */}
            <div className="space-y-6">
                {displayedPublications.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500">
                        No publications found matching your criteria.
                    </div>
                ) : (
                    displayedPublications.map((pub, index) => (
                        <motion.div
                            key={pub.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1 * index }}
                            className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all duration-200"
                        >
                            <div className="flex flex-col md:flex-row gap-6">
                                {pub.preview && (
                                    <div className="w-full md:w-48 flex-shrink-0">
                                        <div className="aspect-video md:aspect-[4/3] relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                                            <Image
                                                src={`/papers/${pub.preview}`}
                                                alt={pub.title}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="flex-grow">
                                    <h3 className={`${embedded ? "text-lg" : "text-xl"} font-semibold text-primary mb-2 leading-tight`}>
                                        {pub.title}
                                    </h3>
                                    <p className={`${embedded ? "text-sm" : "text-base"} text-neutral-600 dark:text-neutral-400 mb-2`}>
                                        {pub.authors.map((author, idx) => (
                                            <span key={idx}>
                                                <span className={`${author.isHighlighted ? 'font-semibold text-accent' : ''} ${author.isCoAuthor ? `underline underline-offset-4 ${author.isHighlighted ? 'decoration-accent' : 'decoration-neutral-400'}` : ''}`}>
                                                    {author.name}
                                                </span>
                                                {author.isCorresponding && (
                                                    <sup className={`ml-0 ${author.isHighlighted ? 'text-accent' : 'text-neutral-600 dark:text-neutral-400'}`}>†</sup>
                                                )}
                                                {idx < pub.authors.length - 1 && ', '}
                                            </span>
                                        ))}
                                    </p>
                                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-600 mb-3">
                                        {pub.journal || pub.conference} {pub.year}
                                    </p>

                                    {pub.description && (
                                        <p className="text-sm text-neutral-600 dark:text-neutral-500 mb-4 line-clamp-3">
                                            {pub.description}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-auto">
                                        {pub.doi && (
                                            <ActionIconLink href={`https://doi.org/${pub.doi}`} label="DOI">
                                                <LinkIcon className="h-4 w-4" />
                                            </ActionIconLink>
                                        )}
                                        {pub.code && (
                                            <ActionIconLink href={pub.code} label="Code">
                                                <CodeBracketIcon className="h-4 w-4" />
                                            </ActionIconLink>
                                        )}
                                        {!embedded && pub.pdfUrl && (
                                            <ActionIconLink href={pub.pdfUrl} label="Paper">
                                                <DocumentIcon className="h-4 w-4" />
                                            </ActionIconLink>
                                        )}
                                        {pub.abstract && (
                                            <ActionIconButton
                                                onClick={() => setExpandedAbstractId(expandedAbstractId === pub.id ? null : pub.id)}
                                                label="Abstract"
                                                isActive={expandedAbstractId === pub.id}
                                            >
                                                <DocumentTextIcon className="h-4 w-4" />
                                            </ActionIconButton>
                                        )}
                                        {pub.bibtex && (
                                            <ActionIconButton
                                                onClick={() => setExpandedBibtexId(expandedBibtexId === pub.id ? null : pub.id)}
                                                label="BibTeX"
                                                isActive={expandedBibtexId === pub.id}
                                            >
                                                <BookOpenIcon className="h-4 w-4" />
                                            </ActionIconButton>
                                        )}

                                        {/* Custom badges (from publications.bib badge/badges fields). Only show on the full Publications page. */}
                                        {!embedded && pub.badges?.map((badge) => (
                                            <span
                                                key={`${pub.id}::${badge}`}
                                                className={cn(
                                                    'inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium select-none whitespace-nowrap',
                                                    badgeClass(badge)
                                                )}
                                            >
                                                {badge}
                                            </span>
                                        ))}
                                    </div>

                                    <AnimatePresence>
                                        {expandedAbstractId === pub.id && pub.abstract ? (
                                            <motion.div
                                                key="abstract"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden mt-4"
                                            >
                                                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                                                    <p className="text-sm text-neutral-600 dark:text-neutral-500 leading-relaxed">
                                                        {pub.abstract}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ) : null}
                                        {expandedBibtexId === pub.id && pub.bibtex ? (
                                            <motion.div
                                                key="bibtex"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden mt-4"
                                            >
                                                <div className="relative bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                                                    <pre className="text-xs text-neutral-600 dark:text-neutral-500 overflow-x-auto whitespace-pre-wrap font-mono">
                                                        {pub.bibtex}
                                                    </pre>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(pub.bibtex || '');
                                                            // Optional: Show copied feedback
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-neutral-700 text-neutral-500 hover:text-accent shadow-sm border border-neutral-200 dark:border-neutral-600 transition-colors"
                                                        title="Copy to clipboard"
                                                    >
                                                        <ClipboardDocumentIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : null}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
