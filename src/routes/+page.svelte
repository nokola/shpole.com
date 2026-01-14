<script lang="ts">
    import { onMount } from "svelte";
    import { authStore, isAuthenticated } from "$lib/stores";
    import { moves as movesApi } from "$lib/api";

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
        primaryName: string | null; // For alt names, shows the PDC name
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
    // Flatten moves to display each name (PDC + alternatives) on its own row
    let flattenedMoves = $derived(() => {
        const rows: DisplayRow[] = [];
        const seenNames = new Set<string>();

        for (const move of movesList) {
            const primaryName = move.PdcName || move.Slug;

            // Add primary name row
            if (!seenNames.has(primaryName.toLowerCase())) {
                seenNames.add(primaryName.toLowerCase());
                rows.push({
                    name: primaryName,
                    primaryName: null,
                    slug: move.Slug,
                    level: move.PdcLevel,
                    strength: move.StrengthReq,
                    flexibility: move.FlexibilityReq,
                    technique: move.TechniqueReq,
                    isPrimary: true,
                });
            }

            // Add alternative name rows
            if (move.AlsoKnownAs) {
                const altNames = move.AlsoKnownAs.split(", ")
                    .map((n) => n.trim())
                    .filter((n) => n);
                for (const altName of altNames) {
                    if (!seenNames.has(altName.toLowerCase())) {
                        seenNames.add(altName.toLowerCase());
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

    // Grouped moves: primary moves with alt names in the same cell
    let groupedMoves = $derived(() => {
        const rows: GroupedRow[] = [];

        for (const move of movesList) {
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

    onMount(async () => {
        try {
            const data = await movesApi.list();
            movesList = data.moves;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load moves";
        } finally {
            loading = false;
        }
    });
</script>

<svelte:head>
    <title>Shpole - Pole Dance Tutorials Database</title>
    <meta
        name="description"
        content="A comprehensive database of pole dance moves with levels, requirements, and tutorials."
    />
</svelte:head>

<div class="moves-page px-2">
    <header class="pl-1 pb-4 text-center">
        <h1>Pole Moves</h1>
        <div>
            <p class="text-sm text-[hsl(var(--shpole-text-muted))]">
                LVL = 1..6 (Intro to Advanced)
                <br />
                STR/FLEX/TECH = 1..5 (Beginner to Expert)
                <br />
                <b>NAME</b> = Primary Name, ALT = Alternative Name
            </p>
        </div>
        <button class="view-toggle" onclick={() => (useFlattenedMoves = !useFlattenedMoves)}>
            {useFlattenedMoves ? "📝 Flattened View" : "📋 Grouped View"}
        </button>
    </header>

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
                {#if useFlattenedMoves}
                    {#each flattenedMoves() as row}
                        <tr class:secondary={!row.isPrimary}>
                            <td class="leading-5 text-sm">
                                <a href="/m/{row.slug}" class="move-link">
                                    {row.name}{#if row.primaryName}
                                        <span class="primary-ref">&nbsp;({row.primaryName})</span>{/if}
                                </a>
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
                {:else}
                    {#each groupedMoves() as row}
                        <tr>
                            <td class="leading-5 text-sm">
                                <a href="/m/{row.slug}" class="move-link">{row.name}</a>
                                {#if row.altNames.length > 0}
                                    <div class="alt-names">
                                        {row.altNames.join(", ")}
                                    </div>
                                {/if}
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
        font-size: 0.7rem;
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
        text-align: center;
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
        font-size: 0.7rem;
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

    .primary-ref {
        font-weight: 400;
        opacity: 0.8;
    }

    .alt-names {
        font-size: 0.75rem;
        font-weight: 400;
        color: hsl(var(--shpole-text-muted));
        margin-top: 0.1rem;
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
</style>
