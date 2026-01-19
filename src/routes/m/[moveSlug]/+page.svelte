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
            { name: "Boundless", subtitle: "Call an exorcist" }, // or: Do you even have bones?
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

    function renderStat(value: number | null, emoji: string): string {
        if (value === null || value === 0) return "–";
        return emoji.repeat(value);
    }

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
</script>

<svelte:head>
    <title>{displayName} - Shpole</title>
    <meta name="description" content="Details about the {displayName} pole dance move" />
</svelte:head>

<div class="max-w-[800px] mx-auto py-12 px-6 text-[hsl(var(--shpole-text))]">
    {#if loading}
        <div class="text-center py-16 text-[hsl(var(--shpole-text-muted))] text-xl">Loading...</div>
    {:else if error}
        <div class="text-center py-16 text-[hsl(0,70%,60%)] text-xl">{error}</div>
    {:else if move}
        <div class="flex flex-col gap-6">
            <a
                href="/"
                class="inline-block text-[hsl(var(--shpole-text-muted))] no-underline text-sm font-medium transition-colors hover:text-[hsl(var(--shpole-primary))]"
                >← Back to moves</a
            >

            <!-- Header Section -->
            <header class="flex flex-col md:flex-row justify-between items-start gap-8">
                <div class="flex-1">
                    <h1 class="text-4xl md:text-5xl font-extrabold mb-4 leading-tight tracking-tight">{displayName}</h1>
                    <div class="flex gap-3 items-center">
                        {#if move.move.MoveTypeName}
                            <span
                                class="px-3 py-1 bg-[hsl(var(--shpole-bg-secondary))] border border-[hsl(var(--shpole-border))] rounded-lg text-sm font-bold text-[hsl(var(--shpole-primary))] uppercase tracking-wider"
                                >{move.move.MoveTypeName}</span
                            >
                        {/if}
                        <span class="text-lg font-bold text-[hsl(var(--shpole-text-muted))]"
                            >Level {move.move.ShpoleLevel ?? "–"}</span
                        >
                    </div>
                </div>
                {#if canEdit}
                    <a
                        href="/m/{move.move.Slug}/edit"
                        class="flex items-center gap-2 bg-[hsl(var(--shpole-bg-secondary))] px-5 py-2.5 rounded-xl text-sm font-bold border border-[hsl(var(--shpole-border))] no-underline transition-all hover:bg-[hsl(var(--shpole-primary))] hover:text-white hover:border-transparent hover:-translate-y-0.5"
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
                            ><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg
                        >
                        <span>Edit</span>
                    </a>
                {/if}
            </header>

            {#if alternateNames.length > 0}
                <div class="text-[0.95rem] leading-relaxed">
                    <span class="text-[hsl(var(--shpole-text-muted))] font-medium mr-2">Also known as:</span>
                    <span class="font-normal">{alternateNames.map((n) => n.MoveName).join(", ")}</span>
                </div>
            {/if}

            <div class="h-px bg-linear-to-r from-[hsl(var(--shpole-border))] to-transparent my-2"></div>

            <!-- Stats Section (Badges on One Row) -->
            <section class="overflow-x-auto">
                <h2 class="text-sm font-bold text-[hsl(var(--shpole-text-muted))] pb-4">
                    Strength, Flexibility, Technique Requirements
                </h2>
                <div class="flex flex-row items-center gap-6 md:gap-12 min-w-max">
                    <!-- Strength -->
                    <div class="shrink-0">
                        {#if move.move.StrengthReq}
                            <div class="flex flex-col items-center gap-3 text-center">
                                <span
                                    class="font-black text-sm md:text-base tracking-widest uppercase"
                                    style="color: {move.move.StrengthReq === 1
                                        ? '#fde047'
                                        : move.move.StrengthReq === 2
                                          ? '#f87171'
                                          : '#60a5fa'}"
                                >
                                    {move.move.StrengthReq === 1
                                        ? "STURDY"
                                        : move.move.StrengthReq === 2
                                          ? "MIGHTY"
                                          : "HEROIC"}
                                </span>
                                <span class="text-xs">{renderStat(move.move.StrengthReq, "💪")}</span>
                            </div>
                        {:else}
                            <div class="flex flex-col items-center gap-2">
                                <span
                                    class="font-black text-sm md:text-base tracking-widest uppercase"
                                    style="color: #fde047"
                                >
                                    Strength
                                </span>
                                <span class="text-xs">—</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Flexibility -->
                    <div class="shrink-0">
                        {#if move.move.FlexibilityReq}
                            <div class="flex flex-col items-center gap-3 text-center">
                                <span
                                    class="font-black text-sm md:text-base tracking-widest uppercase"
                                    style="color: {move.move.FlexibilityReq === 1
                                        ? '#86efac'
                                        : move.move.FlexibilityReq === 2
                                          ? '#38bdf8'
                                          : '#fbbf24'}"
                                >
                                    {move.move.FlexibilityReq === 1
                                        ? "SUPPLE"
                                        : move.move.FlexibilityReq === 2
                                          ? "FLUID"
                                          : "SERPENTINE"}
                                </span>
                                <span class="text-xs">{renderStat(move.move.FlexibilityReq, "🥨")}</span>
                            </div>
                        {:else}
                            <div class="flex flex-col items-center gap-2">
                                <span
                                    class="font-black text-sm md:text-base tracking-widest uppercase"
                                    style="color: #86efac"
                                >
                                    Flexibility
                                </span>
                                <span class="text-xs">—</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Technique -->
                    <div class="shrink-0">
                        {#if move.move.TechniqueReq}
                            <div class="flex flex-col items-center gap-3 text-center">
                                <span
                                    class="font-black text-sm md:text-base tracking-widest uppercase"
                                    style="color: {move.move.TechniqueReq === 1
                                        ? '#93c5fd'
                                        : move.move.TechniqueReq === 2
                                          ? '#cbd5e1'
                                          : '#f59e0b'}"
                                >
                                    {move.move.TechniqueReq === 1
                                        ? "APPRENTICE"
                                        : move.move.TechniqueReq === 2
                                          ? "Adept"
                                          : "VIRTUOSO"}
                                </span>
                                <span class="text-xs">{renderStat(move.move.TechniqueReq, "🎯")}</span>
                            </div>
                        {:else}
                            <div class="flex flex-col items-center gap-2">
                                <span
                                    class="font-black text-sm md:text-base tracking-widest uppercase"
                                    style="color: #93c5fd"
                                >
                                    Technique
                                </span>
                                <span class="text-xs">—</span>
                            </div>
                        {/if}
                    </div>
                </div>
            </section>

            <div class="h-px bg-linear-to-r from-[hsl(var(--shpole-border))] to-transparent my-2"></div>

            <!-- Learning / Info Block -->
            <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">
                <div class="flex flex-col gap-6">
                    {#if move.move.GripTypeId}
                        <div class="flex gap-4 text-[1.05rem]">
                            <span class="text-[hsl(var(--shpole-text-muted))] font-semibold min-w-[120px]">Grip:</span>
                            <div class="flex-1">
                                {#if move.move.GripSlug}
                                    <a
                                        href="/m/{move.move.GripSlug}"
                                        class="text-[hsl(var(--shpole-primary))] no-underline font-semibold hover:underline"
                                        >{move.move.GripName || "Move Link"}</a
                                    >
                                {:else}
                                    <span class="text-[hsl(var(--shpole-text-muted))] italic opacity-60"
                                        >{move.move.GripName || "Reference missing"}</span
                                    >
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div class="flex gap-4 text-[1.05rem]">
                            <span class="text-[hsl(var(--shpole-text-muted))] font-semibold min-w-[120px]">Grip:</span>
                            <span class="text-[hsl(var(--shpole-text-muted))] italic opacity-60">No grip specified</span
                            >
                        </div>
                    {/if}

                    <div class="flex gap-4 text-[1.05rem]">
                        <span class="text-[hsl(var(--shpole-text-muted))] font-semibold min-w-[120px]"
                            >Prerequisites:</span
                        >
                        <div class="flex-1">
                            {#if prerequisites.length > 0}
                                <div class="flex flex-wrap gap-x-4 gap-y-2">
                                    {#each prerequisites as prereq}
                                        <a
                                            href="/m/{prereq.Slug}"
                                            class="text-[hsl(var(--shpole-primary))] no-underline font-semibold hover:underline"
                                            >{prereq.PdcName || prereq.Slug}</a
                                        >
                                    {/each}
                                </div>
                            {:else}
                                <span class="text-[hsl(var(--shpole-text-muted))] italic opacity-60"
                                    >No prerequisites listed</span
                                >
                            {/if}
                        </div>
                    </div>

                    {#if move.move.Info}
                        <div
                            class="mt-8 p-6 bg-[hsl(var(--shpole-bg-secondary))] rounded-2xl border border-[hsl(var(--shpole-border))]"
                        >
                            <p class="text-lg leading-relaxed whitespace-pre-wrap m-0">{move.move.Info}</p>
                        </div>
                    {/if}
                </div>

                <!-- Video Actions -->
                <div class="flex flex-col gap-3">
                    {#if videos.length > 0}
                        {#each videos as video}
                            <a
                                href={video.Url}
                                target="_blank"
                                rel="noopener"
                                class="flex items-center gap-2 text-[hsl(var(--shpole-primary))] no-underline font-bold hover:underline py-2 group"
                            >
                                <span class="text-xl grayscale group-hover:grayscale-0 transition-all">🎬</span>
                                <div class="flex flex-col leading-tight">
                                    <span>Watch Tutorial</span>
                                    {#if video.Credit}
                                        <span class="text-xs font-normal text-[hsl(var(--shpole-text-muted))]"
                                            >by {video.Credit}</span
                                        >
                                    {/if}
                                </div>
                            </a>
                        {/each}
                    {:else}
                        <div class="flex items-center gap-2 py-4 text-[hsl(var(--shpole-text-muted))] opacity-60">
                            <span class="text-xl">📹</span>
                            <span class="text-sm italic">No tutorials yet</span>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Meta / Collapsible Sections -->
            <div class="mt-8 flex flex-col gap-2">
                <!-- Related Moves -->
                <div class="border border-[hsl(var(--shpole-border))] rounded-xl overflow-hidden">
                    <button
                        class="w-full flex items-center gap-3 p-5 bg-transparent border-none cursor-pointer text-[hsl(var(--shpole-text))] text-left transition-colors hover:bg-[hsl(var(--shpole-bg-secondary))]"
                        onclick={() => (showRelated = !showRelated)}
                    >
                        <span class="text-xs transition-transform duration-200 {showRelated ? 'rotate-90' : ''}">▸</span
                        >
                        <span class="font-bold flex-1">Related Moves</span>
                        {#if relatedMoves.length > 0}
                            <span class="text-[hsl(var(--shpole-text-muted))] text-sm">({relatedMoves.length})</span>
                        {/if}
                    </button>
                    {#if showRelated}
                        <div
                            class="px-5 pb-5 pt-0 border-t border-[hsl(var(--shpole-border))] bg-[hsl(var(--shpole-bg-secondary))]"
                        >
                            {#if relatedMoves.length > 0}
                                <ul class="list-none p-0 mt-4 flex flex-col gap-3">
                                    {#each relatedMoves as related}
                                        <li class="text-lg">
                                            <a
                                                href="/m/{related.Slug}"
                                                class="text-[hsl(var(--shpole-primary))] no-underline font-semibold hover:underline"
                                                >{related.PdcName || related.Slug}</a
                                            >
                                            <span class="text-[hsl(var(--shpole-text-muted))] ml-3 text-sm"
                                                >({related.RelationType.replace("_", " ")})</span
                                            >
                                        </li>
                                    {/each}
                                </ul>
                            {:else}
                                <p class="text-[hsl(var(--shpole-text-muted))] italic mt-4">
                                    No related moves added yet.
                                </p>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Competition Codes -->
                <div class="border border-[hsl(var(--shpole-border))] rounded-xl overflow-hidden">
                    <button
                        class="w-full flex items-center gap-3 p-5 bg-transparent border-none cursor-pointer text-[hsl(var(--shpole-text))] text-left transition-colors hover:bg-[hsl(var(--shpole-bg-secondary))]"
                        onclick={() => (showCodes = !showCodes)}
                    >
                        <span class="text-xs transition-transform duration-200 {showCodes ? 'rotate-90' : ''}">▸</span>
                        <span class="font-bold flex-1">Competition Codes</span>
                    </button>
                    {#if showCodes}
                        <div
                            class="px-5 pb-5 pt-0 border-t border-[hsl(var(--shpole-border))] bg-[hsl(var(--shpole-bg-secondary))]"
                        >
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-5">
                                <div class="flex flex-col gap-1">
                                    <span
                                        class="text-[0.65rem] font-bold text-[hsl(var(--shpole-text-muted))] uppercase"
                                        >IPSF</span
                                    >
                                    <span class="text-lg font-bold">{move.move.IpsfCode || "—"}</span>
                                    {#if move.move.IpsfName}<span class="text-xs text-[hsl(var(--shpole-text-muted))]"
                                            >{move.move.IpsfName}</span
                                        >{/if}
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span
                                        class="text-[0.65rem] font-bold text-[hsl(var(--shpole-text-muted))] uppercase"
                                        >POSA</span
                                    >
                                    <span class="text-lg font-bold">{move.move.PosaCode || "—"}</span>
                                    {#if move.move.PosaName}<span class="text-xs text-[hsl(var(--shpole-text-muted))]"
                                            >{move.move.PosaName}</span
                                        >{/if}
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span
                                        class="text-[0.65rem] font-bold text-[hsl(var(--shpole-text-muted))] uppercase"
                                        >PDC</span
                                    >
                                    <span class="text-lg font-bold">{move.move.PdcLevel || "—"}</span>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span
                                        class="text-[0.65rem] font-bold text-[hsl(var(--shpole-text-muted))] uppercase"
                                        >PSO</span
                                    >
                                    <span class="text-lg font-bold">{move.move.PsoLevel || "—"}</span>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>
