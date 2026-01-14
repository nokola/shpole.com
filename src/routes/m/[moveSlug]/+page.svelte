<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { moves as movesApi } from "$lib/api";

    interface MoveDetail {
        Id: number;
        Slug: string;
        PdcName: string | null;
        PdcLevel: number | null;
        IpsfCode: string | null;
        IpsfName: string | null;
        PosaCode: string | null;
        PosaName: string | null;
        StrengthReq: number | null;
        FlexibilityReq: number | null;
        TechniqueReq: number | null;
        Info: string | null;
        MoveTypeName: string | null;
    }

    interface MoveName {
        MoveName: string;
        Source: string | null;
    }

    interface Video {
        Url: string;
        Credit: string | null;
        TimeStart: number | null;
        TimeEnd: number | null;
    }

    interface Prerequisite {
        Slug: string;
        PdcName: string | null;
    }

    interface RelatedMove {
        Slug: string;
        PdcName: string | null;
        RelationType: string;
    }

    let move = $state<MoveDetail | null>(null);
    let names = $state<MoveName[]>([]);
    let videos = $state<Video[]>([]);
    let prerequisites = $state<Prerequisite[]>([]);
    let relatedMoves = $state<RelatedMove[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    function renderStars(value: number | null): string {
        if (value === null) return "–";
        return `${value}★`;
    }

    onMount(async () => {
        try {
            const slug = (page.params as { moveSlug: string }).moveSlug;
            const data = await movesApi.get(slug);
            move = data.move;
            names = data.names || [];
            videos = data.videos || [];
            prerequisites = data.prerequisites || [];
            relatedMoves = data.relatedMoves || [];
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load move";
        } finally {
            loading = false;
        }
    });

    let displayName = $derived(move?.PdcName || move?.Slug || "Move");

    // Filter out the main display name from "Also Known As" to avoid duplication
    let alternateNames = $derived(names.filter((n) => n.MoveName !== displayName));
</script>

<svelte:head>
    <title>{displayName} - Shpole</title>
    <meta name="description" content="Details about the {displayName} pole dance move" />
</svelte:head>

<div class="move-page">
    {#if loading}
        <div class="loading">Loading...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if move}
        <a href="/" class="back-link">← Back to moves</a>

        <header class="move-header">
            <h1>{displayName}</h1>
            {#if move.MoveTypeName}
                <span class="move-type">{move.MoveTypeName}</span>
            {/if}
        </header>

        {#if alternateNames.length > 0}
            <section class="section">
                <h2>Also Known As</h2>
                <ul class="names-list">
                    {#each alternateNames as name}
                        <li>
                            {name.MoveName}
                            {#if name.Source}
                                <span class="source">({name.Source})</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        <section class="section">
            <h2>Requirements</h2>
            <div class="requirements">
                <div class="req-item">
                    <span class="req-label">Level</span>
                    <span class="req-value">{move.PdcLevel ?? "–"}</span>
                </div>
                <div class="req-item">
                    <span class="req-label">Strength</span>
                    <span class="req-stars">{renderStars(move.StrengthReq)}</span>
                </div>
                <div class="req-item">
                    <span class="req-label">Flexibility</span>
                    <span class="req-stars">{renderStars(move.FlexibilityReq)}</span>
                </div>
                <div class="req-item">
                    <span class="req-label">Technique</span>
                    <span class="req-stars">{renderStars(move.TechniqueReq)}</span>
                </div>
            </div>
        </section>

        {#if move.IpsfCode || move.PosaCode}
            <section class="section">
                <h2>Competition Codes</h2>
                <div class="codes">
                    {#if move.IpsfCode}
                        <div class="code-item">
                            <span class="code-org">IPSF:</span>
                            {move.IpsfCode}
                            {#if move.IpsfName}– {move.IpsfName}{/if}
                        </div>
                    {/if}
                    {#if move.PosaCode}
                        <div class="code-item">
                            <span class="code-org">POSA:</span>
                            {move.PosaCode}
                            {#if move.PosaName}– {move.PosaName}{/if}
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        {#if move.Info}
            <section class="section">
                <h2>Description</h2>
                <div class="info">{move.Info}</div>
            </section>
        {/if}

        {#if prerequisites.length > 0}
            <section class="section">
                <h2>Prerequisites</h2>
                <ul class="move-list">
                    {#each prerequisites as prereq}
                        <li>
                            <a href="/m/{prereq.Slug}">{prereq.PdcName || prereq.Slug}</a>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if relatedMoves.length > 0}
            <section class="section">
                <h2>Related Moves</h2>
                <ul class="move-list">
                    {#each relatedMoves as related}
                        <li>
                            <a href="/m/{related.Slug}">{related.PdcName || related.Slug}</a>
                            <span class="relation-type">({related.RelationType.replace("_", " ")})</span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if videos.length > 0}
            <section class="section">
                <h2>Videos</h2>
                <ul class="videos-list">
                    {#each videos as video}
                        <li>
                            <a href={video.Url} target="_blank" rel="noopener">{video.Url}</a>
                            {#if video.Credit}
                                <span class="credit">– {video.Credit}</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}
    {/if}
</div>

<style>
    .move-page {
        max-width: 700px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .back-link {
        display: inline-block;
        color: hsl(var(--shpole-text-muted));
        text-decoration: underline;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
    }

    .back-link:hover {
        color: hsl(var(--shpole-primary));
    }

    .loading,
    .error {
        text-align: center;
        padding: 3rem;
        color: hsl(var(--shpole-text-muted));
    }

    .error {
        color: hsl(0, 70%, 60%);
    }

    .move-header {
        margin-bottom: 2rem;
    }

    .move-header h1 {
        font-size: 2.5rem;
        font-weight: 700;
        margin: 0 0 0.5rem 0;
        color: hsl(var(--shpole-text));
    }

    .move-type {
        display: inline-block;
        background: hsl(var(--shpole-bg-secondary));
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.85rem;
        color: hsl(var(--shpole-text-muted));
    }

    .section {
        margin-bottom: 2rem;
    }

    .section h2 {
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: hsl(var(--shpole-text-muted));
        margin: 0 0 0.75rem 0;
    }

    .names-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .names-list li {
        padding: 0.25rem 0;
        color: hsl(var(--shpole-text));
    }

    .source {
        color: hsl(var(--shpole-text-muted));
        font-size: 0.85rem;
    }

    .requirements {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 1rem;
    }

    .req-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .req-label {
        font-size: 0.75rem;
        color: hsl(var(--shpole-text-muted));
        text-transform: uppercase;
    }

    .req-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: hsl(var(--shpole-text));
    }

    .req-stars {
        color: hsl(var(--shpole-primary));
        font-size: 1rem;
        letter-spacing: 0.1em;
    }

    .codes {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .code-item {
        color: hsl(var(--shpole-text));
    }

    .code-org {
        font-weight: 600;
    }

    .info {
        color: hsl(var(--shpole-text));
        line-height: 1.6;
        white-space: pre-wrap;
    }

    .move-list,
    .videos-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .move-list li,
    .videos-list li {
        padding: 0.5rem 0;
    }

    .move-list a,
    .videos-list a {
        color: hsl(var(--shpole-primary));
        text-decoration: none;
    }

    .move-list a:hover,
    .videos-list a:hover {
        text-decoration: underline;
    }

    .relation-type,
    .credit {
        color: hsl(var(--shpole-text-muted));
        font-size: 0.85rem;
    }
</style>
