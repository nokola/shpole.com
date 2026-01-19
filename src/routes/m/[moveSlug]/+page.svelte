<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { moves as movesApi, type MoveDetail } from "$lib/api";
    import { currentUser } from "$lib/stores";

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

    type MoveStat = {
        label: string;
        emoji: string;
        baseColor: string;
        levels: {
            name: string;
            subtitle: string;
        }[];
    };

    const strengthStat: MoveStat = {
        label: "Strength",
        emoji: "💪",
        baseColor: "#f87171", // red
        levels: [
            { name: "Untested", subtitle: "So it begins" },
            { name: "Sturdy", subtitle: "You can hold this" },
            { name: "Fierce", subtitle: "Look at you!" },
            { name: "Valiant", subtitle: "Oh you're strong strong" },
            { name: "Heroic", subtitle: "Your muscles have muscles" },
            { name: "Epic", subtitle: "Gravity asked nicely" },
        ],
    };

    const flexStat: MoveStat = {
        label: "Flexibility",
        emoji: "🥨",
        baseColor: "#4ade80", // green
        levels: [
            { name: "Untested", subtitle: "Let's get bendy" },
            { name: "Supple", subtitle: "Warm-up complete" },
            { name: "Fluid", subtitle: "Wait, since when?!" },
            { name: "Serpentine", subtitle: "Okay noodle queen" },
            { name: "Ethereal", subtitle: "That's illegal" },
            { name: "Boundless", subtitle: "Call an exorcist" },
        ],
    };

    const techStat: MoveStat = {
        label: "Technique",
        emoji: "🎯",
        baseColor: "#60a5fa", // blue
        levels: [
            { name: "Untested", subtitle: "The journey begins" },
            { name: "Apprentice", subtitle: "Everyone starts here" },
            { name: "Adept", subtitle: "The instructions make sense now" },
            { name: "Artisan", subtitle: "You make it look easy" },
            { name: "Virtuoso", subtitle: "Okay now you're showing off" },
            { name: "Sovereign", subtitle: "The pole learns from you" },
        ],
    };

    function getStatInfo(stat: MoveStat, value: number | null) {
        if (value === null || value === 0) {
            return { emojis: "", name: "—", subtitle: "", color: "hsl(var(--shpole-text-muted))" };
        }
        const level = stat.levels[Math.min(value, stat.levels.length - 1)];
        return {
            emojis: stat.emoji.repeat(value),
            name: level.name,
            subtitle: level.subtitle,
            color: stat.baseColor,
        };
    }

    let move = $state<MoveDetail | null>(null);
    let names = $state<MoveName[]>([]);
    let videos = $state<Video[]>([]);
    let prerequisites = $state<Prerequisite[]>([]);
    let relatedMoves = $state<RelatedMove[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Collapsible states
    let showCodes = $state(false);
    let showRelated = $state(false);

    async function loadMove(slug: string) {
        loading = true;
        try {
            const data = await movesApi.get(slug);
            move = data;
            names = data.names || [];
            videos = data.videos || [];
            prerequisites = data.prerequisites || [];
            relatedMoves = data.relatedMoves || [];
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load move";
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        const slug = (page.params as { moveSlug: string }).moveSlug;
        if (slug) {
            loadMove(slug);
        }
    });

    let displayName = $derived(move?.move.ShpoleName || move?.move.Slug || "Move");

    // Filter out the main display name from "Also Known As" to avoid duplication
    let alternateNames = $derived(names.filter((n) => n.MoveName !== displayName));

    let canEdit = $derived($currentUser?.role === "moderator" || $currentUser?.role === "admin");

    // Computed stat info
    let strengthInfo = $derived(getStatInfo(strengthStat, move?.move.StrengthReq ?? null));
    let flexInfo = $derived(getStatInfo(flexStat, move?.move.FlexibilityReq ?? null));
    let techInfo = $derived(getStatInfo(techStat, move?.move.TechniqueReq ?? null));

    // Check if we have ANY stats to show
    let hasStats = $derived(
        (move?.move.StrengthReq ?? 0) > 0 || (move?.move.FlexibilityReq ?? 0) > 0 || (move?.move.TechniqueReq ?? 0) > 0,
    );

    // Get YouTube thumbnail from video URL
    function getYouTubeThumbnail(url: string): string | null {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
        if (match) {
            return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
        }
        return null;
    }

    let firstVideoThumbnail = $derived(videos.length > 0 ? getYouTubeThumbnail(videos[0].Url) : null);
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
        <!-- Header Row -->
        <div class="header-row">
            <a href="/" class="back-link">← Back to moves</a>
            {#if canEdit}
                <a href="/m/{move.move.Slug}/edit" class="edit-btn" title="Edit move">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                </a>
            {/if}
        </div>

        <!-- Move Title -->
        <h1 class="move-title">{displayName}</h1>

        <!-- Type Badge + Level -->
        <div class="badges-row">
            {#if move.move.MoveTypeName}
                <span class="type-badge">{move.move.MoveTypeName}</span>
            {/if}
            <span class="level-text">Level {move.move.ShpoleLevel ?? "–"}</span>
        </div>

        <!-- Also Known As -->
        {#if alternateNames.length > 0}
            <p class="also-known-as">
                Also known as: {alternateNames.map((n) => n.MoveName).join(", ")}
            </p>
        {/if}

        <!-- Compact Stats Row -->
        {#if hasStats}
            <div class="stats-section">
                <div class="stats-emojis">
                    {#if (move.move.StrengthReq ?? 0) > 0}
                        <span class="emoji-group">{strengthInfo.emojis}</span>
                    {/if}
                    {#if (move.move.FlexibilityReq ?? 0) > 0}
                        <span class="emoji-group">{flexInfo.emojis}</span>
                    {/if}
                    {#if (move.move.TechniqueReq ?? 0) > 0}
                        <span class="emoji-group">{techInfo.emojis}</span>
                    {/if}
                </div>
                <div class="stats-names">
                    {#if (move.move.StrengthReq ?? 0) > 0}
                        <span class="stat-name" style="color: {strengthInfo.color}">{strengthInfo.name}</span>
                    {/if}
                    {#if (move.move.FlexibilityReq ?? 0) > 0}
                        <span class="stat-name" style="color: {flexInfo.color}">{flexInfo.name}</span>
                    {/if}
                    {#if (move.move.TechniqueReq ?? 0) > 0}
                        <span class="stat-name" style="color: {techInfo.color}">{techInfo.name}</span>
                    {/if}
                </div>
                <div class="stats-subtitles">
                    {#if (move.move.StrengthReq ?? 0) > 0}
                        <span>{strengthInfo.subtitle}</span>
                    {/if}
                    {#if (move.move.FlexibilityReq ?? 0) > 0}
                        <span>{flexInfo.subtitle}</span>
                    {/if}
                    {#if (move.move.TechniqueReq ?? 0) > 0}
                        <span>{techInfo.subtitle}</span>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- Video Thumbnail -->
        {#if videos.length > 0}
            <div class="video-section">
                <a href={videos[0].Url} target="_blank" rel="noopener" class="video-thumbnail-link">
                    {#if firstVideoThumbnail}
                        <img src={firstVideoThumbnail} alt="{displayName} tutorial" class="video-thumbnail" />
                    {:else}
                        <div class="video-placeholder"></div>
                    {/if}
                    <div class="play-button">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </div>
                </a>
                <a href={videos[0].Url} target="_blank" rel="noopener" class="watch-link">
                    🎬 Watch Tutorial
                    {#if videos[0].Credit}
                        <span class="credit">by {videos[0].Credit}</span>
                    {/if}
                </a>
                {#if videos.length > 1}
                    <div class="more-videos">
                        {#each videos.slice(1) as video}
                            <a href={video.Url} target="_blank" rel="noopener" class="watch-link secondary">
                                🎬 More tutorials
                                {#if video.Credit}
                                    <span class="credit">by {video.Credit}</span>
                                {/if}
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Description/Info -->
        {#if move.move.Info}
            <div class="info-box">
                <p>{move.move.Info}</p>
            </div>
        {/if}

        <!-- Key Info Section -->
        <div class="key-info">
            <div class="info-row">
                <span class="info-label">Grip</span>
                <span class="info-value">
                    {#if move.move.GripSlug}
                        <a href="/m/{move.move.GripSlug}">{move.move.GripName || "Move Link"}</a>
                    {:else if move.move.GripName}
                        <span class="muted">{move.move.GripName}</span>
                    {:else}
                        <span class="muted">—</span>
                    {/if}
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">Prerequisites</span>
                <span class="info-value">
                    {#if prerequisites.length > 0}
                        {#each prerequisites as prereq, i}
                            <a href="/m/{prereq.Slug}">{prereq.PdcName || prereq.Slug}</a
                            >{#if i < prerequisites.length - 1},
                            {/if}
                        {/each}
                    {:else}
                        <span class="muted">—</span>
                    {/if}
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">Leads to</span>
                <span class="info-value">
                    <span class="muted">—</span>
                </span>
            </div>
        </div>

        <!-- Collapsible Sections -->
        <div class="collapsibles">
            <!-- Related Moves -->
            <div class="collapsible">
                <button class="collapsible-header" onclick={() => (showRelated = !showRelated)}>
                    <span class="chevron" class:open={showRelated}>▸</span>
                    <span class="collapsible-title">Related Moves</span>
                    {#if relatedMoves.length > 0}
                        <span class="count">({relatedMoves.length})</span>
                    {/if}
                </button>
                {#if showRelated}
                    <div class="collapsible-content">
                        {#if relatedMoves.length > 0}
                            <ul>
                                {#each relatedMoves as related}
                                    <li>
                                        <a href="/m/{related.Slug}">{related.PdcName || related.Slug}</a>
                                        <span class="relation-type">({related.RelationType.replace("_", " ")})</span>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="empty">No related moves added yet.</p>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Competition Codes -->
            <div class="collapsible">
                <button class="collapsible-header" onclick={() => (showCodes = !showCodes)}>
                    <span class="chevron" class:open={showCodes}>▸</span>
                    <span class="collapsible-title">Competition Codes</span>
                </button>
                {#if showCodes}
                    <div class="collapsible-content">
                        <div class="codes-grid">
                            <div class="code-item">
                                <span class="code-label">IPSF</span>
                                <span class="code-value">{move.move.IpsfCode || "—"}</span>
                                {#if move.move.IpsfName}
                                    <span class="code-name">{move.move.IpsfName}</span>
                                {/if}
                            </div>
                            <div class="code-item">
                                <span class="code-label">POSA</span>
                                <span class="code-value">{move.move.PosaCode || "—"}</span>
                                {#if move.move.PosaName}
                                    <span class="code-name">{move.move.PosaName}</span>
                                {/if}
                            </div>
                            <div class="code-item">
                                <span class="code-label">PDC</span>
                                <span class="code-value">{move.move.PdcLevel || "—"}</span>
                            </div>
                            <div class="code-item">
                                <span class="code-label">PSO</span>
                                <span class="code-value">{move.move.PsoLevel || "—"}</span>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .move-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 1rem 1rem 3rem;
        color: hsl(var(--shpole-text));
    }

    .loading,
    .error {
        text-align: center;
        padding: 4rem 1rem;
        font-size: 1.25rem;
    }

    .error {
        color: hsl(0, 70%, 60%);
    }

    /* Header */
    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .back-link {
        color: hsl(var(--shpole-text-muted));
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 500;
        transition: color 0.2s;
    }

    .back-link:hover {
        color: hsl(var(--shpole-primary));
    }

    .edit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: hsl(var(--shpole-bg-secondary));
        border: 1px solid hsl(var(--shpole-border));
        color: hsl(var(--shpole-text));
        text-decoration: none;
        transition: all 0.2s;
    }

    .edit-btn:hover {
        background: hsl(var(--shpole-primary));
        color: white;
        border-color: transparent;
    }

    /* Title */
    .move-title {
        font-size: 2rem;
        font-weight: 800;
        line-height: 1.2;
        margin: 0 0 0.5rem;
        letter-spacing: -0.02em;
    }

    @media (min-width: 640px) {
        .move-title {
            font-size: 2.5rem;
        }
    }

    /* Badges */
    .badges-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
    }

    .type-badge {
        display: inline-block;
        padding: 0.25rem 0.625rem;
        background: hsl(var(--shpole-bg-secondary));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: hsl(var(--shpole-primary));
    }

    .level-text {
        font-size: 0.95rem;
        font-weight: 600;
        color: hsl(var(--shpole-text-muted));
    }

    /* Also Known As */
    .also-known-as {
        font-size: 0.875rem;
        color: hsl(var(--shpole-text-muted));
        font-style: italic;
        margin: 0 0 1rem;
        line-height: 1.5;
    }

    /* Stats Section */
    .stats-section {
        background: hsl(var(--shpole-bg-secondary));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 0.75rem;
        padding: 0.875rem 1rem;
        margin: 1rem 0;
    }

    .stats-emojis {
        display: flex;
        gap: 1rem;
        justify-content: center;
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
    }

    .emoji-group {
        letter-spacing: 0.1em;
    }

    .stats-names {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        flex-wrap: wrap;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
    }

    .stat-name::after {
        content: "•";
        margin-left: 0.5rem;
        color: hsl(var(--shpole-text-muted));
        opacity: 0.5;
    }

    .stat-name:last-child::after {
        content: "";
    }

    .stats-subtitles {
        display: flex;
        gap: 0.25rem;
        justify-content: center;
        flex-wrap: wrap;
        font-size: 0.7rem;
        color: hsl(var(--shpole-text-muted));
        font-style: italic;
        text-align: center;
    }

    .stats-subtitles span::after {
        content: "•";
        margin: 0 0.35rem;
        opacity: 0.5;
    }

    .stats-subtitles span:last-child::after {
        content: "";
    }

    /* Video Section */
    .video-section {
        margin: 1.25rem 0;
    }

    .video-thumbnail-link {
        position: relative;
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 0.75rem;
        overflow: hidden;
        background: hsl(var(--shpole-bg-secondary));
    }

    .video-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .video-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, hsl(var(--shpole-bg-secondary)) 0%, hsl(var(--shpole-bg)) 100%);
    }

    .play-button {
        position: absolute;
        bottom: 0.75rem;
        right: 0.75rem;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: all 0.2s;
    }

    .video-thumbnail-link:hover .play-button {
        background: hsl(var(--shpole-primary));
        transform: scale(1.1);
    }

    .watch-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
        color: hsl(var(--shpole-primary));
        text-decoration: none;
        font-weight: 600;
        font-size: 0.95rem;
    }

    .watch-link:hover {
        text-decoration: underline;
    }

    .watch-link .credit {
        font-weight: 400;
        color: hsl(var(--shpole-text-muted));
        font-size: 0.8rem;
    }

    .watch-link.secondary {
        display: block;
        font-size: 0.85rem;
    }

    .more-videos {
        margin-top: 0.25rem;
    }

    /* Info Box */
    .info-box {
        background: hsl(var(--shpole-bg-secondary));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 0.75rem;
        padding: 1rem;
        margin: 1rem 0;
    }

    .info-box p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        white-space: pre-wrap;
    }

    /* Key Info */
    .key-info {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin: 1.5rem 0;
    }

    .info-row {
        display: flex;
        gap: 1rem;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .info-label {
        min-width: 100px;
        font-weight: 600;
        color: hsl(var(--shpole-text-muted));
    }

    .info-value {
        flex: 1;
    }

    .info-value a {
        color: hsl(var(--shpole-primary));
        text-decoration: none;
        font-weight: 500;
    }

    .info-value a:hover {
        text-decoration: underline;
    }

    .info-value .muted {
        color: hsl(var(--shpole-text-muted));
        opacity: 0.6;
    }

    /* Collapsibles */
    .collapsibles {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1.5rem;
    }

    .collapsible {
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 0.75rem;
        overflow: hidden;
    }

    .collapsible-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.875rem 1rem;
        background: transparent;
        border: none;
        cursor: pointer;
        color: hsl(var(--shpole-text));
        text-align: left;
        transition: background 0.2s;
    }

    .collapsible-header:hover {
        background: hsl(var(--shpole-bg-secondary));
    }

    .chevron {
        font-size: 0.75rem;
        transition: transform 0.2s;
    }

    .chevron.open {
        transform: rotate(90deg);
    }

    .collapsible-title {
        flex: 1;
        font-weight: 600;
    }

    .count {
        color: hsl(var(--shpole-text-muted));
        font-size: 0.85rem;
    }

    .collapsible-content {
        padding: 0 1rem 1rem;
        background: hsl(var(--shpole-bg-secondary));
        border-top: 1px solid hsl(var(--shpole-border));
    }

    .collapsible-content ul {
        list-style: none;
        padding: 0;
        margin: 0.75rem 0 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .collapsible-content li {
        font-size: 0.95rem;
    }

    .collapsible-content li a {
        color: hsl(var(--shpole-primary));
        text-decoration: none;
        font-weight: 500;
    }

    .collapsible-content li a:hover {
        text-decoration: underline;
    }

    .relation-type {
        color: hsl(var(--shpole-text-muted));
        font-size: 0.8rem;
        margin-left: 0.5rem;
    }

    .empty {
        color: hsl(var(--shpole-text-muted));
        font-style: italic;
        margin: 0.75rem 0 0;
        font-size: 0.9rem;
    }

    /* Codes Grid */
    .codes-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-top: 0.75rem;
    }

    @media (min-width: 480px) {
        .codes-grid {
            grid-template-columns: repeat(4, 1fr);
        }
    }

    .code-item {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .code-label {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        color: hsl(var(--shpole-text-muted));
    }

    .code-value {
        font-size: 1.1rem;
        font-weight: 700;
    }

    .code-name {
        font-size: 0.7rem;
        color: hsl(var(--shpole-text-muted));
    }
</style>
