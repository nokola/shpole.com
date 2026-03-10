<script lang="ts">
    import type { Snippet } from "svelte";
    import ScrollingTimeline from "./ScrollingTimeline.svelte";
    import MarkerListItem from "./MarkerListItem.svelte";
    import {
        type Marker,
        type MarkerType,
        type Segment,
        TYPE_CONFIG,
        buildSegments,
        getSegmentAt,
        getMarkerColorClass,
        getMarkerSymbol,
        fmt,
        fmtShort,
    } from "$lib/markers";

    // Props
    interface Props {
        videoUrl: string;
        duration: number;
        markers?: Marker[];
        onMarkerAdd?: (marker: Marker) => void;
        children?: Snippet;
    }

    let { videoUrl, duration, markers = $bindable([]), onMarkerAdd, children }: Props = $props();

    // State
    let videoEl: HTMLVideoElement | null = $state(null);
    let currentTime = $state(0);
    let isPlaying = $state(false);
    let lastPausedMarkerId = $state<string | null>(null);
    let panelOpen = $state(true);
    let filterType = $state<"all" | MarkerType>("all");

    // Derived
    const segments = $derived(buildSegments(markers, duration));
    const activeSegment = $derived(getSegmentAt(segments, currentTime));

    // Panel markers (no "hide")
    const panelMarkers = $derived.by(() => {
        const visible = markers.filter((m) => m.type !== "hide");
        const filtered = filterType === "all" ? visible : visible.filter((m) => m.type === filterType);
        return [...filtered].sort((a, b) => a.time - b.time);
    });

    // Counts per type
    const counts = $derived.by(() => {
        const c: Record<string, number> = { all: 0, move: 0, comment: 0, tip: 0, pause: 0, like: 0 };
        for (const m of markers) {
            if (m.type === "hide") continue;
            c.all++;
            if (c[m.type] !== undefined) c[m.type]++;
        }
        return c;
    });

    const FILTER_TABS: { key: "all" | MarkerType; label: string }[] = [
        { key: "all", label: "All" },
        { key: "move", label: "Moves" },
        { key: "comment", label: "Comments" },
        { key: "tip", label: "Tips" },
        { key: "pause", label: "Pauses" },
        { key: "like", label: "Likes" },
    ];

    const visibleTabs = $derived(FILTER_TABS.filter((t) => counts[t.key] > 0));

    // Ensure duration is captured if video is already ready
    $effect(() => {
        if (videoEl && videoEl.duration > 0 && !isNaN(videoEl.duration)) {
            duration = videoEl.duration;
        }
    });

    // Video controls
    function togglePlay() {
        if (!videoEl) return;
        if (isPlaying) {
            videoEl.pause();
        } else {
            videoEl.play();
        }
    }

    function seekTo(time: number) {
        if (!videoEl) return;
        const clamped = Math.max(0, Math.min(time, duration));
        videoEl.currentTime = clamped;
        currentTime = clamped; // Immediate update for responsive scrubbing
        lastPausedMarkerId = null; // Clear trigger when seeking
    }

    // Sync current time and handle automated behaviors
    function syncTime(time?: number) {
        if (!videoEl) return;
        currentTime = time ?? videoEl.currentTime;

        // Auto-pause logic
        if (isPlaying) {
            const pauseMarker = markers.find(
                (m) => m.type === "pause" && Math.abs(m.time - currentTime) < 0.25 && m.id !== lastPausedMarkerId,
            );

            if (pauseMarker) {
                videoEl.pause();
                lastPausedMarkerId = pauseMarker.id;
            }
        }

        // Check duration in case events missed it
        if (duration === 0 && videoEl.duration > 0 && !isNaN(videoEl.duration)) {
            duration = videoEl.duration;
        }
    }

    function handleTimeUpdate() {
        syncTime();
    }

    function handleLoadedMetadata() {
        if (!videoEl) return;
        if (videoEl.duration > 0 && !isNaN(videoEl.duration)) {
            duration = videoEl.duration;
        }
    }

    function handleDurationChange() {
        if (!videoEl) return;
        if (videoEl.duration > 0 && !isNaN(videoEl.duration)) {
            duration = videoEl.duration;
        }
    }

    function handlePlay() {
        isPlaying = true;
    }

    function handlePause() {
        isPlaying = false;
    }

    // High-precision frame updates for smoother scrubbing/playback
    $effect(() => {
        if (isPlaying && videoEl && "requestVideoFrameCallback" in videoEl) {
            let handle: number;
            const callback = (_now: number, metadata: { mediaTime: number }) => {
                if (videoEl) {
                    syncTime(metadata.mediaTime);
                    handle = (videoEl as any).requestVideoFrameCallback(callback);
                }
            };
            handle = (videoEl as any).requestVideoFrameCallback(callback);
            return () => {
                if (videoEl && "cancelVideoFrameCallback" in videoEl) {
                    (videoEl as any).cancelVideoFrameCallback(handle);
                }
            };
        }
    });

    // UI helpers
    function setFilter(key: "all" | MarkerType) {
        filterType = key;
        if (!panelOpen) panelOpen = true;
    }

    function pillColor(key: string, isActive: boolean): string {
        const cfg = TYPE_CONFIG[key];
        if (!isActive) return "rgba(255,255,255,0.04)";
        if (key === "all") return "rgba(255,255,255,0.12)";
        return (cfg?.color ?? "#fff") + "30";
    }

    function pillBorder(key: string, isActive: boolean): string {
        const cfg = TYPE_CONFIG[key];
        if (!isActive) return "1px solid rgba(255,255,255,0.06)";
        if (key === "all") return "1px solid rgba(255,255,255,0.15)";
        return `1px solid ${cfg?.color ?? "#fff"}55`;
    }

    // Find the marker currently under the playhead (within 1 second)
    let playheadMarker = $derived(markers.find((m) => Math.abs(m.time - currentTime) < 1) || null);

    // Find active marker for the comment bubble (within 1 second of current time)
    let activeMarker = $derived.by(() => {
        const m = playheadMarker;
        if (!m || m.type === "move" || m.type === "hide") return null;
        return m.text ? m : null;
    });

    // Initials helper
    function getInitials(name?: string): string {
        if (!name) return "U";
        return name
            .split(/\s+/)
            .filter((part) => part.length > 0)
            .map((part) => part[0].toUpperCase())
            .join("")
            .slice(0, 2);
    }
</script>

<!-- Outer scrollable container (div1) -->
<div class="w-full h-full overflow-y-auto bg-[#111119]">
    <!-- Video section - exactly viewport height minus some room if needed (div2) -->
    <div class="relative w-full h-dvh bg-black text-white flex flex-col">
        <!-- Video - fills available space -->
        <div class="flex-1 relative overflow-hidden flex items-center justify-center">
            <video
                bind:this={videoEl}
                src={videoUrl}
                class="w-full h-full object-contain"
                ontimeupdate={handleTimeUpdate}
                onloadedmetadata={handleLoadedMetadata}
                ondurationchange={handleDurationChange}
                onloadeddata={handleLoadedMetadata}
                onplay={handlePlay}
                onpause={handlePause}
                playsinline
                preload="metadata"
            >
                <track kind="captions" />
            </video>

            <!-- Tap to play/pause overlay -->
            <button
                type="button"
                class="absolute inset-0 cursor-pointer flex items-center justify-center"
                onclick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
            >
                {#if !isPlaying}
                    <div
                        class="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                        <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                            <path d="M2 1L18 12L2 23V1Z" fill="white" />
                        </svg>
                    </div>
                {/if}
            </button>

            <!-- Current move HUD (Bottom Left) -->
            {#if activeSegment}
                <div class="absolute bottom-4 left-4 right-4 flex items-center gap-2 pointer-events-none">
                    <div
                        class="w-2 h-2 rounded-full shrink-0"
                        style="background: {activeSegment.color}; box-shadow: 0 0 10px {activeSegment.color}88;"
                    ></div>
                    <span class="text-sm font-semibold text-white drop-shadow-lg">
                        {activeSegment.label}
                    </span>
                </div>
            {/if}

            <!-- Comment Bubble (Center-ish) -->
            {#if activeMarker}
                <div
                    class="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 z-40 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl pointer-events-none"
                >
                    <div
                        class="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white shrink-0"
                    >
                        {getInitials(activeMarker.username)}
                    </div>
                    <div class="text-white text-sm whitespace-nowrap">
                        {activeMarker.text}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Timeline section -->
        <div class="pt-4 pb-2 bg-[#111119]">
            <ScrollingTimeline {duration} {currentTime} {markers} {segments} onseek={seekTo} />
        </div>
    </div>

    <!-- Panel Content -->
    <div class="max-w-2xl mx-auto px-4 pb-12">
        <!-- Panel toggle + filter pills -->
        <div class="pt-4">
            <!-- Toggle header -->
            <button
                class="w-full flex items-center justify-between py-2 bg-transparent border-none cursor-pointer"
                onclick={() => (panelOpen = !panelOpen)}
            >
                <span class="text-sm font-semibold text-white/60">
                    Markers ({counts.all})
                </span>
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    class="transition-transform duration-200 {panelOpen ? 'rotate-180' : ''}"
                    style="opacity: 0.35;"
                >
                    <path
                        d="M4 6L8 10L12 6"
                        stroke="white"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </button>

            <!-- Filter pills -->
            {#if panelOpen}
                <div class="flex gap-2 pb-4 overflow-x-auto scrollbar-none">
                    {#each visibleTabs as tab (tab.key)}
                        {@const isActive = filterType === tab.key}
                        <button
                            class="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-all duration-150"
                            style="
                                color: {isActive ? '#fff' : 'rgba(255,255,255,0.4)'};
                                background: {pillColor(tab.key, isActive)};
                                border: {pillBorder(tab.key, isActive)};
                            "
                            onclick={() => setFilter(tab.key)}
                        >
                            {tab.label}
                            <span class="text-[10px] font-mono opacity-50">{counts[tab.key]}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Markers list -->
        {#if panelOpen}
            <div class="flex flex-col gap-2">
                {#each panelMarkers as m (m.id)}
                    {@const seg = segments.find((s) => s.label === m.text && s.startTime === m.time)}
                    {@const isNearby = Math.abs(m.time - currentTime) < 2}
                    <MarkerListItem marker={m} active={isNearby} segment={seg} onclick={() => seekTo(m.time)} />
                {/each}

                {#if panelMarkers.length === 0}
                    <div class="py-12 text-center text-sm text-white/20">No markers of this type</div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Additional content slot -->
    <div class="max-w-3xl mx-auto">
        {@render children?.()}
    </div>
</div>
