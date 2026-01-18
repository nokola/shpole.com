<script lang="ts">
    import { onMount } from "svelte";
    import { authStore, isAuthenticated } from "$lib/stores";
    import { moves as movesApi } from "$lib/api";
    import Dropdown from "$lib/components/Dropdown.svelte";

    interface Move {
        Id: number;
        Slug: string;
        PdcName: string | null;
        PdcLevel: number | null;
        StrengthReq: number | null;
        FlexibilityReq: number | null;
        TechniqueReq: number | null;
        MoveTypeName: string | null;
        AlsoKnownAs: string | null;
    }

    interface DisplayRow {
        name: string;
        primaryName: string; // For alt names, shows the PDC name
        slug: string;
        level: number | null;
        strength: number | null;
        flexibility: number | null;
        technique: number | null;
        isPrimary: boolean;
    }

    interface GroupedRow {
        name: string;
        altNames: string[];
        slug: string;
        level: number | null;
        strength: number | null;
        flexibility: number | null;
        technique: number | null;
    }

    let movesList = $state<Move[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Sorting state
    type SortColumn = "name" | "level" | "strength" | "flexibility" | "technique";
    let sortColumn = $state<SortColumn>("name");
    let sortDirection = $state<"asc" | "desc">("asc");

    function toggleSort(column: SortColumn) {
        if (sortColumn === column) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortColumn = column;
            sortDirection = "asc";
        }
    }

    function renderStars(value: number | null): string {
        if (value === null) return "–";
        return `${value}★`;
    }

    let useFlattenedMoves = $state(false);

    // Level filter state
    const levelLabels: Record<number, string> = {
        1: "Intro",
        2: "Beginner",
        3: "Intermediate",
        4: "Advanced",
        5: "Expert",
        6: "Master",
    };
    let selectedLevels = $state<Set<number>>(new Set());
    let levelDropdownOpen = $state(false);

    function toggleLevel(level: number) {
        const newSet = new Set(selectedLevels);
        if (newSet.has(level)) {
            newSet.delete(level);
        } else {
            newSet.add(level);
        }
        selectedLevels = newSet;
    }

    function getLevelButtonLabel(): string {
        if (selectedLevels.size === 0) {
            return "Level 123456"; // Empty = all levels
        }
        return "Level " + Array.from(selectedLevels).sort().join("");
    }

    // STR/FLEX/TECH filter state
    let selectedStrength = $state<Set<number>>(new Set());
    let selectedFlexibility = $state<Set<number>>(new Set());
    let selectedTechnique = $state<Set<number>>(new Set());
    let statsDropdownOpen = $state(false);

    // Search state
    let searchQuery = $state("");
    let searchForcesAltNames = $state(false); // True when search matches an alt name while in grouped mode
    let searchInputEl: HTMLInputElement | null = $state(null);
    let savedScrollPosition: number | null = null; // Store scroll position before search focus

    // Check if a search query matches a string (case-insensitive)
    function matchesSearch(text: string, query: string): boolean {
        if (!query) return true;
        return text.toLowerCase().includes(query.toLowerCase());
    }

    // Check if search matches any name (primary or alt) for a move
    function moveMatchesSearch(move: Move, query: string): { matches: boolean; matchesAltOnly: boolean } {
        if (!query) return { matches: true, matchesAltOnly: false };
        const q = query.toLowerCase();
        const primaryName = (move.PdcName || move.Slug).toLowerCase();
        const primaryMatches = primaryName.includes(q);

        if (primaryMatches) return { matches: true, matchesAltOnly: false };

        // Check alt names
        if (move.AlsoKnownAs) {
            const altNames = move.AlsoKnownAs.split(", ").map((n) => n.trim().toLowerCase());
            for (const alt of altNames) {
                if (alt.includes(q)) {
                    return { matches: true, matchesAltOnly: true };
                }
            }
        }
        return { matches: false, matchesAltOnly: false };
    }

    // Reactively update whether we need to force alt names display due to search
    $effect(() => {
        if (!searchQuery) {
            searchForcesAltNames = false;
            return;
        }
        // Check if any matching move only matches via alt name
        let hasAltOnlyMatch = false;
        for (const move of movesList) {
            const { matches, matchesAltOnly } = moveMatchesSearch(move, searchQuery);
            if (matches && matchesAltOnly) {
                hasAltOnlyMatch = true;
                break;
            }
        }
        searchForcesAltNames = hasAltOnlyMatch;
    });

    // Determine effective display mode (user choice or forced by search)
    let effectiveUseFlattenedMoves = $derived(useFlattenedMoves || searchForcesAltNames);

    function toggleStat(stat: "strength" | "flexibility" | "technique", value: number) {
        const sets = {
            strength: selectedStrength,
            flexibility: selectedFlexibility,
            technique: selectedTechnique,
        };
        const current = sets[stat];
        const newSet = new Set(current);
        if (newSet.has(value)) {
            newSet.delete(value);
        } else {
            newSet.add(value);
        }
        if (stat === "strength") selectedStrength = newSet;
        else if (stat === "flexibility") selectedFlexibility = newSet;
        else selectedTechnique = newSet;
    }

    function hasStatsFilter(): boolean {
        return selectedStrength.size > 0 || selectedFlexibility.size > 0 || selectedTechnique.size > 0;
    }

    function getStatsButtonLabel(): string {
        if (!hasStatsFilter()) {
            return "STR/FLEX/TECH";
        }
        const parts: string[] = [];
        if (selectedStrength.size > 0) parts.push(`S ${Array.from(selectedStrength).sort().join("")}`);
        if (selectedFlexibility.size > 0) parts.push(`F ${Array.from(selectedFlexibility).sort().join("")}`);
        if (selectedTechnique.size > 0) parts.push(`T ${Array.from(selectedTechnique).sort().join("")}`);
        return parts.join("/");
    }

    function matchesStatFilter(value: number | null, selected: Set<number>): boolean {
        if (selected.size === 0) return true; // No filter = show all
        if (value === null) return false; // Hide null when filtering
        return selected.has(value);
    }

    // Flatten moves to display each name (PDC + alternatives) on its own row
    let flattenedMoves = $derived(() => {
        const rows: DisplayRow[] = [];
        const seenNames = new Set<string>();

        // Filter by selected levels, stats, AND search (empty set = show all)
        const filteredMoves = movesList.filter((move) => {
            // Level filter
            if (selectedLevels.size > 0) {
                if (move.PdcLevel === null) return false;
                if (!selectedLevels.has(move.PdcLevel)) return false;
            }
            // Stats filters
            if (!matchesStatFilter(move.StrengthReq, selectedStrength)) return false;
            if (!matchesStatFilter(move.FlexibilityReq, selectedFlexibility)) return false;
            if (!matchesStatFilter(move.TechniqueReq, selectedTechnique)) return false;
            // Search filter
            const { matches } = moveMatchesSearch(move, searchQuery);
            return matches;
        });

        for (const move of filteredMoves) {
            const primaryName = move.PdcName || move.Slug;
            const primaryMatches = !searchQuery || matchesSearch(primaryName, searchQuery);

            // Check if any alt name matches (to decide if we should also show primary)
            let hasMatchingAlt = false;
            const matchingAltNames: string[] = [];
            if (move.AlsoKnownAs && searchQuery) {
                const altNames = move.AlsoKnownAs.split(", ")
                    .map((n) => n.trim())
                    .filter((n) => n);
                for (const altName of altNames) {
                    if (matchesSearch(altName, searchQuery)) {
                        hasMatchingAlt = true;
                        matchingAltNames.push(altName);
                    }
                }
            }

            // Add primary name row if it matches OR if any alt name matches (for context)
            // Use move slug as part of key to allow same name under different moves
            const primaryKey = `${move.Slug}:${primaryName.toLowerCase()}`;
            const shouldShowPrimary = primaryMatches || hasMatchingAlt;
            if (shouldShowPrimary && !seenNames.has(primaryKey)) {
                seenNames.add(primaryKey);
                rows.push({
                    name: primaryName,
                    primaryName: primaryName,
                    slug: move.Slug,
                    level: move.PdcLevel,
                    strength: move.StrengthReq,
                    flexibility: move.FlexibilityReq,
                    technique: move.TechniqueReq,
                    isPrimary: true,
                });
            }

            // Add alternative name rows (only if they match the search or no search)
            // Use move slug as part of key so same alt name can appear under different moves
            if (move.AlsoKnownAs) {
                const altNames = move.AlsoKnownAs.split(", ")
                    .map((n) => n.trim())
                    .filter((n) => n);
                for (const altName of altNames) {
                    const altKey = `${move.Slug}:${altName.toLowerCase()}`;
                    const altMatches = !searchQuery || matchesSearch(altName, searchQuery);
                    if (altMatches && !seenNames.has(altKey)) {
                        seenNames.add(altKey);
                        rows.push({
                            name: altName,
                            primaryName: primaryName,
                            slug: move.Slug,
                            level: move.PdcLevel,
                            strength: move.StrengthReq,
                            flexibility: move.FlexibilityReq,
                            technique: move.TechniqueReq,
                            isPrimary: false,
                        });
                    }
                }
            }
        }

        // Sort based on selected column and direction
        rows.sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case "name":
                    comparison = a.primaryName.localeCompare(b.primaryName);
                    break;
                case "level":
                    comparison = (a.level ?? -1) - (b.level ?? -1);
                    break;
                case "strength":
                    comparison = (a.strength ?? -1) - (b.strength ?? -1);
                    break;
                case "flexibility":
                    comparison = (a.flexibility ?? -1) - (b.flexibility ?? -1);
                    break;
                case "technique":
                    comparison = (a.technique ?? -1) - (b.technique ?? -1);
                    break;
            }
            return sortDirection === "asc" ? comparison : -comparison;
        });
        return rows;
    });

    // Grouped moves: primary moves with alt names in the same cell
    let groupedMoves = $derived(() => {
        const rows: GroupedRow[] = [];

        // Filter by selected levels, stats, AND search (empty set = show all)
        const filteredMoves = movesList.filter((move) => {
            // Level filter
            if (selectedLevels.size > 0) {
                if (move.PdcLevel === null) return false;
                if (!selectedLevels.has(move.PdcLevel)) return false;
            }
            // Stats filters
            if (!matchesStatFilter(move.StrengthReq, selectedStrength)) return false;
            if (!matchesStatFilter(move.FlexibilityReq, selectedFlexibility)) return false;
            if (!matchesStatFilter(move.TechniqueReq, selectedTechnique)) return false;
            // Search filter
            const { matches } = moveMatchesSearch(move, searchQuery);
            return matches;
        });

        for (const move of filteredMoves) {
            const primaryName = move.PdcName || move.Slug;
            const altNames = move.AlsoKnownAs
                ? move.AlsoKnownAs.split(", ")
                      .map((n) => n.trim())
                      .filter((n) => n && n.toLowerCase() !== primaryName.toLowerCase())
                : [];

            rows.push({
                name: primaryName,
                altNames,
                slug: move.Slug,
                level: move.PdcLevel,
                strength: move.StrengthReq,
                flexibility: move.FlexibilityReq,
                technique: move.TechniqueReq,
            });
        }

        // Sort based on selected column and direction
        rows.sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "level":
                    comparison = (a.level ?? -1) - (b.level ?? -1);
                    break;
                case "strength":
                    comparison = (a.strength ?? -1) - (b.strength ?? -1);
                    break;
                case "flexibility":
                    comparison = (a.flexibility ?? -1) - (b.flexibility ?? -1);
                    break;
                case "technique":
                    comparison = (a.technique ?? -1) - (b.technique ?? -1);
                    break;
            }
            return sortDirection === "asc" ? comparison : -comparison;
        });
        return rows;
    });

    onMount(() => {
        // Load moves data
        (async () => {
            try {
                const data = await movesApi.list();
                movesList = data.moves;
            } catch (e) {
                error = e instanceof Error ? e.message : "Failed to load moves";
            } finally {
                loading = false;
            }
        })();

        // Handle browser back to restore scroll position after search focus
        const handlePopState = (event: PopStateEvent) => {
            if (event.state?.scrollPosition !== undefined) {
                // Restore scroll position when navigating back from search
                window.scrollTo({ top: event.state.scrollPosition, behavior: "instant" });
                // Blur the search input if focused
                if (searchInputEl && document.activeElement === searchInputEl) {
                    searchInputEl.blur();
                }
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    });

    function navigateToMove(slug: string) {
        window.location.href = `/m/${slug}`;
    }

    // Highlight matching text within a string
    function highlightMatch(text: string, query: string): string {
        if (!query) return escapeHtml(text);
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const idx = lowerText.indexOf(lowerQuery);
        if (idx === -1) return escapeHtml(text);
        const before = text.slice(0, idx);
        const match = text.slice(idx, idx + query.length);
        const after = text.slice(idx + query.length);
        return (
            escapeHtml(before) + '<mark class="search-highlight">' + escapeHtml(match) + "</mark>" + escapeHtml(after)
        );
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
</script>

<svelte:head>
    <title>Shpole - Pole Dance Moves Database</title>
    <meta
        name="description"
        content="A comprehensive database of pole dance moves with levels, requirements, and tutorials."
    />
</svelte:head>

<div class="moves-page px-2">
    <header class="pl-1 pb-4">
        <h1>{movesList.length > 0 ? movesList.length : "335"} Pole Moves</h1>
        <button class="view-toggle" onclick={() => (useFlattenedMoves = !useFlattenedMoves)}>
            {useFlattenedMoves ? "📝 Primary+Alt Names" : "📋 Primary Names"}
        </button>
        <div class="search-box-wrapper">
            <input
                bind:this={searchInputEl}
                type="text"
                class="search-input"
                placeholder="🔍 Search moves..."
                bind:value={searchQuery}
                onfocus={(e) => {
                    // On mobile, save scroll position and push history state for back navigation
                    if (window.innerWidth < 768) {
                        const currentScroll = window.scrollY;
                        // Replace current state with scroll position (so popstate can restore it)
                        history.replaceState({ scrollPosition: currentScroll }, "");
                        // Push a new state for the search view
                        history.pushState({ searchActive: true }, "");

                        // Scroll so search bar is at very top of viewport
                        const inputEl = e.currentTarget;
                        const rect = inputEl.getBoundingClientRect();
                        const scrollTop = window.scrollY + rect.top - 10; // 10px padding from top
                        window.scrollTo({ top: scrollTop, behavior: "instant" });
                    }
                }}
            />
            {#if searchQuery}
                <button class="search-clear" onclick={() => (searchQuery = "")}>✕</button>
            {/if}
        </div>
        <div class="filter-row">
            <Dropdown bind:open={levelDropdownOpen} class="level-filter-wrapper">
                {#snippet trigger()}
                    <button class="view-toggle level-filter-btn" class:has-filter={selectedLevels.size > 0}>
                        🎯 {getLevelButtonLabel()}
                    </button>
                {/snippet}
                <div class="level-dropdown">
                    {#each [1, 2, 3, 4, 5, 6] as level}
                        <button
                            type="button"
                            class="level-option"
                            class:active={selectedLevels.has(level)}
                            onclick={() => toggleLevel(level)}
                        >
                            <span class="level-number">{level}</span>
                            <span class="level-label">{levelLabels[level]}</span>
                        </button>
                    {/each}
                </div>
            </Dropdown>
            <Dropdown bind:open={statsDropdownOpen}>
                {#snippet trigger()}
                    <button class="view-toggle stats-filter-btn" class:has-filter={hasStatsFilter()}>
                        💪 {getStatsButtonLabel()}
                    </button>
                {/snippet}
                <div class="stats-dropdown">
                    <div class="stat-row">
                        <span class="stat-label"><strong>STR</strong>ength</span>
                        <div class="star-buttons">
                            {#each [1, 2, 3, 4, 5] as star}
                                <button
                                    type="button"
                                    class="star-btn"
                                    class:active={selectedStrength.has(star)}
                                    onclick={() => toggleStat("strength", star)}>★</button
                                >
                            {/each}
                        </div>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label"><strong>FLEX</strong>ibility</span>
                        <div class="star-buttons">
                            {#each [1, 2, 3, 4, 5] as star}
                                <button
                                    type="button"
                                    class="star-btn"
                                    class:active={selectedFlexibility.has(star)}
                                    onclick={() => toggleStat("flexibility", star)}>★</button
                                >
                            {/each}
                        </div>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label"><strong>TECH</strong>nical</span>
                        <div class="star-buttons">
                            {#each [1, 2, 3, 4, 5] as star}
                                <button
                                    type="button"
                                    class="star-btn"
                                    class:active={selectedTechnique.has(star)}
                                    onclick={() => toggleStat("technique", star)}>★</button
                                >
                            {/each}
                        </div>
                    </div>
                </div>
            </Dropdown>
        </div>
    </header>

    <!-- Floating search button for mobile -->
    <!-- <button
        class="floating-search-btn"
        onclick={() => {
            if (searchInputEl) {
                searchInputEl.focus();
            }
        }}
    >
        🔍 Search
    </button> -->

    {#if loading}
        <div class="loading">Loading moves...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if movesList.length === 0}
        <div class="empty">
            <p>No moves in the database yet.</p>
        </div>
    {:else}
        <table class="moves-table">
            <thead>
                <tr>
                    <th class="sortable" class:active={sortColumn === "name"} onclick={() => toggleSort("name")}>
                        Name {#if sortColumn === "name"}<span class="sort-arrow"
                                >{sortDirection === "asc" ? "▲" : "▼"}</span
                            >{/if}
                    </th>
                    <th class="sortable" class:active={sortColumn === "level"} onclick={() => toggleSort("level")}>
                        Lvl {#if sortColumn === "level"}<span class="sort-arrow"
                                >{sortDirection === "asc" ? "▲" : "▼"}</span
                            >{/if}
                    </th>
                    <th class="combined-header">
                        <div class="combined-header-inner">
                            <button
                                type="button"
                                class="sortable-btn"
                                class:active={sortColumn === "strength"}
                                onclick={() => toggleSort("strength")}
                            >
                                Str{#if sortColumn === "strength"}<span class="sort-arrow"
                                        >{sortDirection === "asc" ? "▲" : "▼"}</span
                                    >{/if}/
                            </button>
                            <button
                                type="button"
                                class="sortable-btn"
                                class:active={sortColumn === "flexibility"}
                                onclick={() => toggleSort("flexibility")}
                            >
                                Flex{#if sortColumn === "flexibility"}<span class="sort-arrow"
                                        >{sortDirection === "asc" ? "▲" : "▼"}</span
                                    >{/if}/
                            </button>
                            <button
                                type="button"
                                class="sortable-btn"
                                class:active={sortColumn === "technique"}
                                onclick={() => toggleSort("technique")}
                            >
                                Tech{#if sortColumn === "technique"}<span class="sort-arrow"
                                        >{sortDirection === "asc" ? "▲" : "▼"}</span
                                    >{/if}
                            </button>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody>
                {#if effectiveUseFlattenedMoves}
                    {#each flattenedMoves() as row}
                        <tr
                            class="clickable-row"
                            class:secondary={!row.isPrimary}
                            onclick={() => navigateToMove(row.slug)}
                        >
                            <td class="leading-5 text-md">
                                <a href="/m/{row.slug}" class="move-link" onclick={(e) => e.stopPropagation()}>
                                    {#if row.isPrimary}
                                        {@html highlightMatch(row.name, searchQuery)}
                                    {:else}
                                        <span class="text-[hsl(var(--shpole-text-muted))]"
                                            >{@html highlightMatch(row.name, searchQuery)}</span
                                        >
                                    {/if}
                                </a>
                            </td>
                            <td class="level">{(row.isPrimary ? row.level : "") ?? "–"}</td>
                            <td class="stars-combined">
                                {#if row.isPrimary}
                                    {renderStars(row.strength)}<span class="text-[hsl(var(--shpole-text-muted))]"
                                        >/</span
                                    >{renderStars(row.flexibility)}<span class="text-[hsl(var(--shpole-text-muted))]"
                                        >/</span
                                    >{renderStars(row.technique)}
                                {/if}
                            </td>
                        </tr>
                    {/each}
                {:else}
                    {#each groupedMoves() as row}
                        <tr class="clickable-row" onclick={() => navigateToMove(row.slug)}>
                            <td class="leading-5 text-md">
                                <a href="/m/{row.slug}" class="move-link" onclick={(e) => e.stopPropagation()}
                                    >{@html highlightMatch(row.name, searchQuery)}</a
                                >
                            </td>
                            <td class="level">{row.level ?? "–"}</td>
                            <td class="stars-combined"
                                >{renderStars(row.strength)}<span class="text-[hsl(var(--shpole-text-muted))]">/</span
                                >{renderStars(row.flexibility)}<span class="text-[hsl(var(--shpole-text-muted))]"
                                    >/</span
                                >{renderStars(row.technique)}</td
                            >
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .moves-page {
        max-width: 880px;
        margin: 0 auto;
    }

    .loading,
    .error,
    .empty {
        text-align: center;
        padding: 3rem;
        color: hsl(var(--shpole-text-muted));
    }

    .error {
        color: hsl(0, 70%, 60%);
    }

    .moves-table {
        width: 100%;
        border-collapse: collapse;
    }

    .moves-table th {
        text-align: left;
        padding: 0.25rem 0.35rem;
        font-weight: 600;
        color: hsl(var(--shpole-text-muted));
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-bottom: 1px solid hsl(var(--shpole-border));
    }

    .sortable {
        cursor: pointer;
        text-decoration: underline;
        user-select: none;
    }

    .sortable:hover {
        color: hsl(var(--shpole-text));
    }

    .sortable.active {
        background: hsl(var(--shpole-primary) / 0.2);
        color: hsl(var(--shpole-primary));
        border-radius: 4px;
    }

    .sort-arrow {
        font-size: 0.6rem;
        margin-left: 0.15rem;
    }

    .moves-table td {
        padding: 0.2rem 0.35rem;
        color: hsl(var(--shpole-text));
    }

    .moves-table tbody tr {
        border-bottom: 1px solid hsl(var(--shpole-border) / 0.5);
    }

    .moves-table tbody tr:last-child {
        border-bottom: none;
    }

    .clickable-row {
        cursor: pointer;
    }

    .moves-table tbody tr:hover {
        background: hsl(var(--shpole-bg-secondary));
    }

    .move-link {
        color: hsl(var(--shpole-text));
        text-decoration: none;
        font-weight: 800;
    }

    .move-link:hover {
        text-decoration: underline;
    }

    .level {
        font-weight: 600;
    }

    .stars-combined {
        font-size: 0.8rem;
        letter-spacing: 0.02em;
        color: hsl(var(--shpole-primary));
        text-align: center;
        white-space: nowrap;
    }

    .combined-header {
        text-align: center;
        vertical-align: middle;
    }

    .combined-header-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .sortable-btn {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        color: hsl(var(--shpole-text-muted));
        cursor: pointer;
        text-decoration: underline;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.03em;
    }

    .sortable-btn:hover {
        color: hsl(var(--shpole-text));
    }

    .sortable-btn.active {
        background: hsl(var(--shpole-primary) / 0.25);
        color: hsl(var(--shpole-primary));
        padding: 1px 4px;
        border-radius: 3px;
        text-decoration: none;
    }

    .secondary .move-link {
        font-weight: 400;
    }

    .view-toggle {
        margin-top: 0.75rem;
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: hsl(var(--shpole-text));
        background: hsl(var(--shpole-surface));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .view-toggle:hover {
        background: hsl(var(--shpole-bg-secondary));
        border-color: hsl(var(--shpole-primary));
    }

    .level-filter-btn.has-filter {
        background: hsl(var(--shpole-primary) / 0.15);
        border-color: hsl(var(--shpole-primary));
    }

    .level-dropdown {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .level-option {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.12s ease;
        text-align: left;
    }

    .level-option:hover {
        background: hsl(var(--shpole-bg-secondary));
    }

    .level-option.active {
        background: hsl(var(--shpole-primary) / 0.2);
    }

    .level-option.active:hover {
        background: hsl(var(--shpole-primary) / 0.3);
    }

    .level-number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        font-weight: 700;
        font-size: 0.85rem;
        border-radius: 4px;
        background: hsl(var(--shpole-bg-secondary));
        color: hsl(var(--shpole-text-muted));
    }

    .level-option.active .level-number {
        background: hsl(var(--shpole-primary));
        color: hsl(var(--shpole-bg));
    }

    .level-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: hsl(var(--shpole-text));
    }

    .level-option.active .level-label {
        color: hsl(var(--shpole-primary));
    }

    .stats-filter-btn.has-filter {
        background: hsl(var(--shpole-primary) / 0.15);
        border-color: hsl(var(--shpole-primary));
    }

    .stats-dropdown {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 200px;
    }

    .stat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.25rem 0;
    }

    .stat-label {
        font-size: 0.85rem;
        color: hsl(var(--shpole-text));
        min-width: 90px;
    }

    .stat-label strong {
        color: hsl(var(--shpole-primary));
    }

    .star-buttons {
        display: flex;
        gap: 2px;
    }

    .star-btn {
        background: transparent;
        border: none;
        padding: 0.25rem;
        font-size: 1rem;
        color: hsl(var(--shpole-text-muted));
        cursor: pointer;
        transition: all 0.12s ease;
        border-radius: 4px;
    }

    .star-btn:hover {
        color: hsl(var(--shpole-primary));
        background: hsl(var(--shpole-bg-secondary));
    }

    .star-btn.active {
        color: hsl(var(--shpole-primary));
        background: hsl(var(--shpole-primary) / 0.2);
    }

    /* Filter row for Level and Stats buttons */
    .filter-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    /* Search box styles */
    .search-box-wrapper {
        display: flex;
        align-items: center;
        margin-top: 0.75rem;
        position: relative;
        max-width: 300px;
    }

    .search-input {
        width: 100%;
        padding: 0.5rem 2rem 0.5rem 0.75rem;
        font-size: 0.9rem;
        color: hsl(var(--shpole-text));
        background: hsl(var(--shpole-surface));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 8px;
        outline: none;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    .search-input::placeholder {
        color: hsl(var(--shpole-text-muted));
    }

    .search-input:focus {
        border-color: hsl(var(--shpole-primary));
        box-shadow: 0 0 0 2px hsl(var(--shpole-primary) / 0.2);
    }

    .search-clear {
        position: absolute;
        right: 0.5rem;
        background: none;
        border: none;
        padding: 0.25rem;
        font-size: 0.85rem;
        color: hsl(var(--shpole-text-muted));
        cursor: pointer;
        border-radius: 4px;
        line-height: 1;
    }

    .search-clear:hover {
        color: hsl(var(--shpole-text));
        background: hsl(var(--shpole-bg-secondary));
    }

    /* Search highlight */
    :global(.search-highlight) {
        background: hsl(50, 100%, 50%);
        color: hsl(0, 0%, 10%);
        padding: 0 1px;
        border-radius: 2px;
    }

    /* Floating search button - mobile-first (visible by default, hidden on desktop) */
    .floating-search-btn {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        padding: 0.75rem 1.25rem;
        font-size: 0.95rem;
        font-weight: 600;
        color: hsl(var(--shpole-bg));
        background: hsl(var(--shpole-primary));
        border: none;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 4px 16px hsl(var(--shpole-primary) / 0.4);
        z-index: 100;
        transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
    }

    .floating-search-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px hsl(var(--shpole-primary) / 0.5);
    }

    .floating-search-btn:active {
        transform: translateY(0);
    }

    /* Hide on desktop */
    @media (min-width: 768px) {
        .floating-search-btn {
            display: none;
        }
    }
</style>
