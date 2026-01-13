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
    }

    let movesList = $state<Move[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    function renderStars(value: number | null): string {
        if (value === null) return "–";
        return "★".repeat(value) + "☆".repeat(5 - value);
    }

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
        <p class="subtitle">Browse the move database</p>
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
                    <th>Level</th>
                    <th>Strength</th>
                    <th>Flexibility</th>
                    <th>Technique</th>
                </tr>
            </thead>
            <tbody>
                {#each movesList as move}
                    <tr>
                        <td>
                            <a href="/m/{move.Slug}" class="move-link">
                                {move.PdcName || move.Slug}
                            </a>
                        </td>
                        <td class="level">{move.PdcLevel ?? "–"}</td>
                        <td class="stars">{renderStars(move.StrengthReq)}</td>
                        <td class="stars">{renderStars(move.FlexibilityReq)}</td>
                        <td class="stars">{renderStars(move.TechniqueReq)}</td>
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

    .subtitle {
        color: hsl(var(--shpole-text-muted));
        margin: 0;
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
        padding: 0.75rem 1rem;
        font-weight: 600;
        color: hsl(var(--shpole-text-muted));
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid hsl(var(--shpole-border));
    }

    .moves-table td {
        padding: 0.75rem 1rem;
        color: hsl(var(--shpole-text));
    }

    .moves-table tbody tr:hover {
        background: hsl(var(--shpole-bg-secondary));
    }

    .move-link {
        color: hsl(var(--shpole-primary));
        text-decoration: none;
        font-weight: 500;
    }

    .move-link:hover {
        text-decoration: underline;
    }

    .level {
        font-weight: 600;
        text-align: center;
    }

    .stars {
        font-size: 0.85rem;
        letter-spacing: 0.05em;
        color: hsl(var(--shpole-primary));
    }

    @media (max-width: 600px) {
        .moves-table th:nth-child(n + 3),
        .moves-table td:nth-child(n + 3) {
            display: none;
        }
    }
</style>
