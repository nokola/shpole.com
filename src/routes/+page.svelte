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

    let movesList = $state<Move[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    function renderStars(value: number | null): string {
        if (value === null) return "–";
        return "★".repeat(value) + "☆".repeat(5 - value);
    }

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

        // Sort alphabetically by name
        rows.sort((a, b) => a.name.localeCompare(b.name));
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
    <title>Shpole - Pole Dance Move Database</title>
    <meta
        name="description"
        content="A comprehensive database of pole dance moves with levels, requirements, and tutorials."
    />
</svelte:head>

<div class="moves-page">
    <header class="page-header">
        <h1>Pole Dance Moves</h1>
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
                    <th>Name</th>
                    <th>Lvl</th>
                    <th>Str</th>
                    <th>Flex</th>
                    <th>Tech</th>
                </tr>
            </thead>
            <tbody>
                {#each flattenedMoves() as row}
                    <tr class:secondary={!row.isPrimary}>
                        <td class="name-cell">
                            <a href="/m/{row.slug}" class="move-link">
                                {row.name}{#if row.primaryName}
                                    <span class="primary-ref">&nbsp;({row.primaryName})</span>{/if}
                            </a>
                        </td>
                        <td class="level">{row.level ?? "–"}</td>
                        <td class="stars">{renderStars(row.strength)}</td>
                        <td class="stars">{renderStars(row.flexibility)}</td>
                        <td class="stars">{renderStars(row.technique)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .moves-page {
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .page-header {
        margin-bottom: 2rem;
    }

    .page-header h1 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 0.5rem 0;
        color: hsl(var(--shpole-text));
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

    .stars {
        font-size: 0.8rem;
        letter-spacing: 0.02em;
        color: hsl(var(--shpole-primary));
        text-align: center;
    }

    .name-cell {
        line-height: 1.3;
    }

    .secondary .move-link {
        font-weight: 400;
    }

    .primary-ref {
        font-weight: 400;
        opacity: 0.8;
    }
</style>
