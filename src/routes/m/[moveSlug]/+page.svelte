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
            { name: "Fierce", subtitle: "This is where strength grows" },
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
            { name: "Supple", subtitle: "Soft entry, solid hold" },
            { name: "Fluid", subtitle: "Bending the rules slightly" },
            { name: "Serpentine", subtitle: "Okay noodle queen" },
            { name: "Ethereal", subtitle: "Do you even have bones?" },
            { name: "Boundless", subtitle: "Call an exorcist!" },
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

    let backToMoves = $state<HTMLAnchorElement | null>(null);
    // Scroll down a bit on mount so "Back to moves" is half visible
    onMount(() => {
        setTimeout(() => {
            backToMoves?.scrollIntoView({ behavior: "instant" });
        }, 50);
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

    // Get the featured subtitle from the highest stat (strength > flex > tech if tied)
    let featuredSubtitle = $derived(() => {
        const str = move?.move.StrengthReq ?? 0;
        const flex = move?.move.FlexibilityReq ?? 0;
        const tech = move?.move.TechniqueReq ?? 0;

        if (str === 0 && flex === 0 && tech === 0) return "";

        // Find the max value
        const max = Math.max(str, flex, tech);

        // Priority: strength > flex > tech when tied
        if (str === max) return strengthInfo.subtitle;
        if (flex === max) return flexInfo.subtitle;
        return techInfo.subtitle;
    });

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

<div class="max-w-150 mx-auto px-4 py-4 pb-12 text-[hsl(var(--shpole-text))]">
    {#if loading}
        <div class="text-center py-16 text-[hsl(var(--shpole-text-muted))] text-xl">Loading...</div>
    {:else if error}
        <div class="text-center py-16 text-red-400 text-xl">{error}</div>
    {:else if move}
        <!-- Header Row -->
        <div class="flex justify-between items-center mb-3">
            <a
                bind:this={backToMoves}
                href="/"
                class="text-[hsl(var(--shpole-text-muted))] no-underline text-sm font-medium transition-colors hover:text-[hsl(var(--shpole-primary))]"
            >
                ← Back to moves
            </a>
            {#if canEdit}
                <a
                    href="/m/{move.move.Slug}/edit"
                    class="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--shpole-bg-secondary))] border border-[hsl(var(--shpole-border))] text-[hsl(var(--shpole-text))] no-underline transition-all hover:bg-[hsl(var(--shpole-primary))] hover:text-white hover:border-transparent"
                    title="Edit move"
                >
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
        <h1 class="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight m-0 mb-2">
            {displayName}
        </h1>

        <!-- Type Badge + Level -->
        <div class="flex items-center gap-3 flex-wrap mb-2">
            {#if move.move.MoveTypeName}
                <span
                    class="inline-block px-2.5 py-0.5 bg-amber-500 rounded-full text-[0.7rem] font-bold uppercase tracking-wide text-black"
                >
                    {move.move.MoveTypeName}
                </span>
            {/if}
            <span class="text-sm text-[hsl(var(--shpole-text))]">
                Level {move.move.ShpoleLevel ?? "–"}
            </span>
        </div>

        {#if featuredSubtitle()}
            <p class="text-sm text-[hsl(var(--shpole-text-muted))] m-0 pt-1 mb-2">
                {featuredSubtitle()}
            </p>
        {/if}

        <!-- Also Known As -->
        {#if alternateNames.length > 0}
            <p class="text-sm text-[hsl(var(--shpole-text-muted))] m-0 mb-2 leading-snug">
                Also known as: <span class="text-[hsl(var(--shpole-text))]"
                    >{alternateNames.map((n) => n.MoveName).join(", ")}</span
                >
            </p>
        {/if}

        <!-- Compact Stats Row -->
        {#if hasStats}
            <div
                class="bg-[hsl(var(--shpole-bg-secondary))] border border-[hsl(var(--shpole-border))] rounded-xl px-2 py-3 mb-4"
            >
                <!-- Stats Columns with Separators -->
                <div class="flex items-center justify-center gap-4">
                    {#if (move.move.StrengthReq ?? 0) > 0}
                        <div class="flex flex-col items-center gap-0.5">
                            <span class="text-xs leading-none">{strengthInfo.emojis}</span>
                            <span
                                class="text-[0.65rem] font-bold uppercase tracking-wide pt-1"
                                style="color: {strengthInfo.color}">{strengthInfo.name}</span
                            >
                        </div>
                    {/if}
                    {#if (move.move.StrengthReq ?? 0) > 0 && ((move.move.FlexibilityReq ?? 0) > 0 || (move.move.TechniqueReq ?? 0) > 0)}
                        <div class="w-px h-8 bg-[hsl(var(--shpole-border))] opacity-40"></div>
                    {/if}
                    {#if (move.move.FlexibilityReq ?? 0) > 0}
                        <div class="flex flex-col items-center gap-0.5">
                            <span class="text-xs leading-none">{flexInfo.emojis}</span>
                            <span
                                class="text-[0.65rem] font-bold uppercase tracking-wide pt-1"
                                style="color: {flexInfo.color}">{flexInfo.name}</span
                            >
                        </div>
                    {/if}
                    {#if (move.move.FlexibilityReq ?? 0) > 0 && (move.move.TechniqueReq ?? 0) > 0}
                        <div class="w-px h-8 bg-[hsl(var(--shpole-border))] opacity-40"></div>
                    {/if}
                    {#if (move.move.TechniqueReq ?? 0) > 0}
                        <div class="flex flex-col items-center gap-0.5">
                            <span class="text-xs leading-none">{techInfo.emojis}</span>
                            <span
                                class="text-[0.65rem] font-bold uppercase tracking-wide pt-1"
                                style="color: {techInfo.color}">{techInfo.name}</span
                            >
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- Video Thumbnail -->
        {#if videos.length > 0}
            <div class="mt-3 mb-4">
                <a
                    href={videos[0].Url}
                    target="_blank"
                    rel="noopener"
                    class="relative block w-full aspect-video rounded-xl overflow-hidden bg-[hsl(var(--shpole-bg-secondary))] group"
                >
                    {#if firstVideoThumbnail}
                        <img
                            src={firstVideoThumbnail}
                            alt="{displayName} tutorial"
                            class="w-full h-full object-cover"
                        />
                    {:else}
                        <div
                            class="w-full h-full bg-linear-to-br from-[hsl(var(--shpole-bg-secondary))] to-[hsl(var(--shpole-bg))]"
                        ></div>
                    {/if}
                    <div
                        class="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all group-hover:bg-[hsl(var(--shpole-primary))] group-hover:scale-110"
                    >
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
                <a
                    href={videos[0].Url}
                    target="_blank"
                    rel="noopener"
                    class="flex items-center justify-center gap-1.5 mt-2 text-[hsl(var(--shpole-text-primary))] text-sm"
                    style="text-decoration: none"
                >
                    🎬<span class="underline">Watch Tutorial</span>
                    {#if videos[0].Credit}
                        <span class="text-[hsl(var(--shpole-text-muted))]">&nbsp;by {videos[0].Credit}</span>
                    {/if}
                </a>
                {#if videos.length > 1}
                    <div class="mt-1">
                        {#each videos.slice(1) as video}
                            <a
                                href={video.Url}
                                target="_blank"
                                rel="noopener"
                                class="block text-[hsl(var(--shpole-primary))] no-underline font-semibold text-sm hover:underline"
                            >
                                🎬 More tutorials
                                {#if video.Credit}
                                    <span class="font-normal text-[hsl(var(--shpole-text-muted))] text-xs"
                                        >by {video.Credit}</span
                                    >
                                {/if}
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Description/Info -->
        {#if move.move.Info}
            <div
                class="bg-[hsl(var(--shpole-bg-secondary))] border border-[hsl(var(--shpole-border))] rounded-xl p-3 my-3"
            >
                <p class="m-0 text-sm leading-relaxed whitespace-pre-wrap">{move.move.Info}</p>
            </div>
        {/if}

        <!-- Key Info Section -->
        <div class="my-6">
            <h3 class="text-[0.7rem] font-bold uppercase tracking-widest text-[hsl(var(--shpole-text-muted))] m-0 mb-2">
                KEY INFO
            </h3>
            <div class="flex flex-col gap-1">
                {#if !move.move.MoveTypeName?.toLowerCase().includes("grip")}
                    <div class="flex gap-4 text-sm leading-snug">
                        <span class="min-w-28 text-[hsl(var(--shpole-text))]">Grip</span>
                        <span class="flex-1">
                            {#if move.move.GripSlug}
                                <a
                                    href="/m/{move.move.GripSlug}"
                                    class="text-[hsl(var(--shpole-primary))] no-underline hover:underline"
                                >
                                    {move.move.GripName || "Move Link"}
                                </a>
                            {:else if move.move.GripName}
                                <span class="text-[hsl(var(--shpole-text))]">{move.move.GripName}</span>
                            {:else}
                                <span class="text-[hsl(var(--shpole-text-muted))]">—</span>
                            {/if}
                        </span>
                    </div>
                {/if}
                <div class="flex gap-4 text-sm leading-snug">
                    <span class="min-w-28 text-[hsl(var(--shpole-text))]">Prerequisites</span>
                    <span class="flex-1">
                        {#if prerequisites.length > 0}
                            {#each prerequisites as prereq, i}
                                <a
                                    href="/m/{prereq.Slug}"
                                    class="text-[hsl(var(--shpole-primary))] no-underline hover:underline"
                                >
                                    {prereq.PdcName || prereq.Slug}
                                </a>{#if i < prerequisites.length - 1},
                                {/if}
                            {/each}
                        {:else}
                            <span class="text-[hsl(var(--shpole-text-muted))]">—</span>
                        {/if}
                    </span>
                </div>
                <div class="flex gap-4 text-sm leading-snug">
                    <span class="min-w-28 text-[hsl(var(--shpole-text))]">Leads to</span>
                    <span class="flex-1">
                        <span class="text-[hsl(var(--shpole-text-muted))]">—</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- Collapsible Sections -->
        <div class="flex flex-col mt-2">
            <!-- Related Moves -->
            <div class="border-t border-[hsl(var(--shpole-border))]">
                <button
                    class="w-full flex items-center gap-2 py-2.5 bg-transparent border-none cursor-pointer text-[hsl(var(--shpole-text))] text-left"
                    onclick={() => (showRelated = !showRelated)}
                >
                    <span class="text-xs transition-transform duration-200 {showRelated ? 'rotate-90' : ''}">▶</span>
                    <span class="font-medium text-sm">Related Moves</span>
                    {#if relatedMoves.length > 0}
                        <span class="text-[hsl(var(--shpole-text-muted))] text-xs">({relatedMoves.length})</span>
                    {:else}
                        <span class="text-[hsl(var(--shpole-text-muted))] text-xs opacity-80">(none)</span>
                    {/if}
                </button>
                {#if showRelated}
                    <div class="pb-3">
                        {#if relatedMoves.length > 0}
                            <ul class="list-none p-0 m-0 flex flex-col gap-1.5 pl-5">
                                {#each relatedMoves as related}
                                    <li class="text-sm">
                                        <a
                                            href="/m/{related.Slug}"
                                            class="text-[hsl(var(--shpole-primary))] no-underline hover:underline"
                                        >
                                            {related.PdcName || related.Slug}
                                        </a>
                                        <span class="text-[hsl(var(--shpole-text-muted))] text-xs ml-1">
                                            ({related.RelationType.replace("_", " ")})
                                        </span>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-[hsl(var(--shpole-text-muted))] text-sm m-0 pl-5">
                                No related moves added yet.
                            </p>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Competition Codes -->
            <div class="border-t border-[hsl(var(--shpole-border))]">
                <button
                    class="w-full flex items-center gap-2 py-2.5 bg-transparent border-none cursor-pointer text-[hsl(var(--shpole-text))] text-left"
                    onclick={() => (showCodes = !showCodes)}
                >
                    <span class="text-xs transition-transform duration-200 {showCodes ? 'rotate-90' : ''}">▶</span>
                    <span class="font-medium text-sm">Competition Codes</span>
                </button>
                {#if showCodes}
                    <div class="pb-3 pl-5">
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div class="flex flex-col gap-0.5">
                                <span class="text-[0.65rem] font-bold uppercase text-[hsl(var(--shpole-text-muted))]"
                                    >IPSF</span
                                >
                                <span class="text-base font-bold">{move.move.IpsfCode || "—"}</span>
                                {#if move.move.IpsfName}
                                    <span class="text-xs text-[hsl(var(--shpole-text-muted))]"
                                        >{move.move.IpsfName}</span
                                    >
                                {/if}
                            </div>
                            <div class="flex flex-col gap-0.5">
                                <span class="text-[0.65rem] font-bold uppercase text-[hsl(var(--shpole-text-muted))]"
                                    >POSA</span
                                >
                                <span class="text-base font-bold">{move.move.PosaCode || "—"}</span>
                                {#if move.move.PosaName}
                                    <span class="text-xs text-[hsl(var(--shpole-text-muted))]"
                                        >{move.move.PosaName}</span
                                    >
                                {/if}
                            </div>
                            <div class="flex flex-col gap-0.5">
                                <span class="text-[0.65rem] font-bold uppercase text-[hsl(var(--shpole-text-muted))]"
                                    >PDC</span
                                >
                                <span class="text-base font-bold">{move.move.PdcLevel || "—"}</span>
                            </div>
                            <div class="flex flex-col gap-0.5">
                                <span class="text-[0.65rem] font-bold uppercase text-[hsl(var(--shpole-text-muted))]"
                                    >PSO</span
                                >
                                <span class="text-base font-bold">{move.move.PsoLevel || "—"}</span>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>
