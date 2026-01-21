<script lang="ts">
    import { onMount } from "svelte";

    // Props
    interface Props {
        videoUrl: string;
        markers?: Marker[];
        onMarkerAdd?: (marker: Marker) => void;
    }

    let { videoUrl, markers = $bindable([]), onMarkerAdd }: Props = $props();

    // Marker type
    interface Marker {
        id: string;
        time: number;
        type: "comment" | "move" | "pause" | "like";
        text?: string;
    }

    // State
    let videoEl: HTMLVideoElement | null = $state(null);
    let currentTime = $state(0);
    let duration = $state(0);
    let isPlaying = $state(false);
    let isDragging = $state(false);
    let commentText = $state("");

    // Timeline scroll state
    let preciseScrubberEl: HTMLDivElement | null = $state(null);
    let fastScrubberEl: HTMLDivElement | null = $state(null);
    let isAutoScrolling = $state(true);

    // Constants
    const PIXELS_PER_SECOND = 15; // How wide each second is on the timeline
    const MARKER_ICONS: Record<Marker["type"], string> = {
        comment: "💬",
        move: "🏃",
        pause: "⏸",
        like: "❤️",
    };
    const QUICK_REACTIONS = ["🔥", "👏", "🥺"];

    // Computed
    let timelineWidth = $derived(duration * PIXELS_PER_SECOND);
    let playheadPosition = $derived(currentTime * PIXELS_PER_SECOND);

    // Sort markers by time for navigation
    let sortedMarkers = $derived([...markers].sort((a, b) => a.time - b.time));

    // Format time as MM:SS
    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

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
        videoEl.currentTime = Math.max(0, Math.min(time, duration));
    }

    // Handle video events
    function handleTimeUpdate() {
        if (!videoEl || isDragging) return;
        currentTime = videoEl.currentTime;

        // Auto-scroll timeline to keep playhead visible
        if (isAutoScrolling && preciseScrubberEl) {
            const containerWidth = preciseScrubberEl.clientWidth;
            const targetScroll = playheadPosition - containerWidth / 3;
            preciseScrubberEl.scrollLeft = Math.max(0, targetScroll);
        }
    }

    function handleLoadedMetadata() {
        if (!videoEl) return;
        duration = videoEl.duration;
    }

    function handlePlay() {
        isPlaying = true;
        isAutoScrolling = true;
    }

    function handlePause() {
        isPlaying = false;
    }

    // Timeline scrubbing
    function handleTimelineClick(e: MouseEvent, element: HTMLDivElement) {
        const rect = element.getBoundingClientRect();
        const clickX = e.clientX - rect.left + element.scrollLeft;
        const time = clickX / PIXELS_PER_SECOND;
        seekTo(time);
        isAutoScrolling = false;
    }

    function handleScroll() {
        // When user manually scrolls, disable auto-scroll
        if (!isDragging) {
            isAutoScrolling = false;
        }
    }

    // Marker navigation
    function goToPrevMarker() {
        const prevMarker = sortedMarkers.filter((m) => m.time < currentTime - 0.5).pop();
        if (prevMarker) {
            seekTo(prevMarker.time);
        } else if (sortedMarkers.length > 0) {
            seekTo(sortedMarkers[sortedMarkers.length - 1].time);
        }
    }

    function goToNextMarker() {
        const nextMarker = sortedMarkers.find((m) => m.time > currentTime + 0.5);
        if (nextMarker) {
            seekTo(nextMarker.time);
        } else if (sortedMarkers.length > 0) {
            seekTo(sortedMarkers[0].time);
        }
    }

    // Add markers
    function addMarker(type: Marker["type"], text?: string) {
        const newMarker: Marker = {
            id: crypto.randomUUID(),
            time: currentTime,
            type,
            text,
        };
        markers = [...markers, newMarker];
        onMarkerAdd?.(newMarker);
    }

    function addReaction(emoji: string) {
        addMarker("like", emoji);
    }

    function addComment() {
        if (!commentText.trim()) return;
        addMarker("comment", commentText.trim());
        commentText = "";
    }

    function handleCommentKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            addComment();
        }
    }

    // Generate thumbnail placeholder colors based on time position
    function getThumbnailColor(index: number, total: number): string {
        const hue = (index / total) * 360;
        return `hsl(${hue}, 50%, 30%)`;
    }
</script>

<div class="video-view flex flex-col h-dvh bg-[hsl(240_15%_8%)] text-white overflow-hidden">
    <!-- Video Player Section -->
    <div class="relative flex-1 min-h-0 flex items-center justify-center bg-black">
        <video
            bind:this={videoEl}
            src={videoUrl}
            class="w-full h-full object-contain"
            ontimeupdate={handleTimeUpdate}
            onloadedmetadata={handleLoadedMetadata}
            onplay={handlePlay}
            onpause={handlePause}
            playsinline
        >
            <track kind="captions" />
        </video>

        <!-- Play/Pause Overlay -->
        <button
            type="button"
            class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onclick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
        >
            <div class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span class="text-3xl">{isPlaying ? "⏸" : "▶️"}</span>
            </div>
        </button>
    </div>

    <!-- Time Display -->
    <div class="flex items-center justify-center gap-2 py-2 text-lg font-mono bg-[hsl(240_15%_10%)]">
        <span class="text-white">{formatTime(currentTime)}</span>
        <span class="text-white/50">|</span>
        <span class="text-white/70">{formatTime(duration)}</span>
    </div>

    <!-- Fast Scrubber (Markers Only) -->
    <div class="relative bg-[hsl(240_15%_12%)] border-y border-white/10">
        <div class="flex items-center px-2 gap-2">
            <button
                type="button"
                class="p-2 text-white/70 hover:text-white transition-colors"
                onclick={goToPrevMarker}
                aria-label="Previous marker"
            >
                ◀
            </button>

            <div
                bind:this={fastScrubberEl}
                class="flex-1 h-10 overflow-x-auto scrollbar-thin relative"
                onclick={(e) => handleTimelineClick(e, fastScrubberEl!)}
                onscroll={handleScroll}
                role="slider"
                aria-label="Fast marker scrubber"
                aria-valuenow={currentTime}
                aria-valuemin={0}
                aria-valuemax={duration}
                tabindex="0"
            >
                <div class="relative h-full" style="width: {timelineWidth}px; min-width: 100%;">
                    <!-- Playhead -->
                    <div
                        class="absolute top-0 bottom-0 w-0.5 bg-[hsl(var(--shpole-primary))] z-10"
                        style="left: {playheadPosition}px;"
                    ></div>

                    <!-- Markers -->
                    {#each markers as marker}
                        <button
                            type="button"
                            class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-lg hover:scale-125 transition-transform cursor-pointer z-20"
                            style="left: {marker.time * PIXELS_PER_SECOND}px;"
                            onclick={(e) => {
                                e.stopPropagation();
                                seekTo(marker.time);
                            }}
                            aria-label="{marker.type} marker at {formatTime(marker.time)}"
                        >
                            {MARKER_ICONS[marker.type]}
                        </button>
                    {/each}
                </div>
            </div>

            <button
                type="button"
                class="p-2 text-white/70 hover:text-white transition-colors"
                onclick={goToNextMarker}
                aria-label="Next marker"
            >
                ▶
            </button>
        </div>
    </div>

    <!-- Precise Scrubber (Thumbnails) -->
    <div class="bg-[hsl(240_15%_6%)]">
        <div
            bind:this={preciseScrubberEl}
            class="h-16 overflow-x-auto scrollbar-thin relative"
            onclick={(e) => handleTimelineClick(e, preciseScrubberEl!)}
            onscroll={handleScroll}
            role="slider"
            aria-label="Precise thumbnail scrubber"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={duration}
            tabindex="0"
        >
            <div class="relative h-full flex" style="width: {timelineWidth}px; min-width: 100%;">
                <!-- Thumbnail placeholders (colored blocks) -->
                {#each Array(Math.max(1, Math.ceil(duration / 5))) as _, i}
                    <div
                        class="h-full flex-shrink-0"
                        style="width: {5 * PIXELS_PER_SECOND}px; background: {getThumbnailColor(
                            i,
                            Math.ceil(duration / 5),
                        )};"
                    ></div>
                {/each}

                <!-- Playhead -->
                <div
                    class="absolute top-0 bottom-0 w-0.5 bg-[hsl(var(--shpole-primary))] z-10"
                    style="left: {playheadPosition}px;"
                ></div>

                <!-- Progress overlay (played portion) -->
                <div
                    class="absolute inset-y-0 left-0 bg-[hsl(var(--shpole-primary))] opacity-30 pointer-events-none"
                    style="width: {playheadPosition}px;"
                ></div>

                <!-- Markers on thumbnail bar -->
                {#each markers as marker}
                    <button
                        type="button"
                        class="absolute bottom-1 -translate-x-1/2 text-sm opacity-70 hover:opacity-100 cursor-pointer z-20"
                        style="left: {marker.time * PIXELS_PER_SECOND}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            seekTo(marker.time);
                        }}
                        aria-label="{marker.type} marker at {formatTime(marker.time)}"
                    >
                        {MARKER_ICONS[marker.type]}
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <!-- Add Marker Buttons -->
    <div class="flex items-center justify-center gap-4 py-2 bg-[hsl(240_15%_10%)]">
        <button
            type="button"
            class="px-3 py-1 rounded-full text-sm bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1"
            onclick={() => addMarker("pause")}
            aria-label="Add pause marker"
        >
            ⏸ Pause
        </button>
        <button
            type="button"
            class="px-3 py-1 rounded-full text-sm bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1"
            onclick={() => addMarker("move")}
            aria-label="Add move marker"
        >
            🏃 Move
        </button>
    </div>

    <!-- Comment/Reaction Bar -->
    <div class="p-3 bg-[hsl(240_15%_12%)] border-t border-white/10">
        <div class="flex items-center gap-2 bg-[hsl(240_15%_18%)] rounded-full px-4 py-2">
            <input
                type="text"
                placeholder="Drop a comment..."
                class="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 text-sm"
                bind:value={commentText}
                onkeydown={handleCommentKeydown}
            />
            {#each QUICK_REACTIONS as emoji}
                <button
                    type="button"
                    class="text-xl hover:scale-125 transition-transform cursor-pointer"
                    onclick={() => addReaction(emoji)}
                    aria-label="Add {emoji} reaction"
                >
                    {emoji}
                </button>
            {/each}
        </div>
    </div>

    <!-- Marker Navigation -->
    <div class="flex items-center justify-between px-4 py-3 bg-[hsl(240_15%_8%)] border-t border-white/10">
        <button
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
            onclick={goToPrevMarker}
            aria-label="Go to previous marker"
        >
            ◀️ Prev
        </button>
        <span class="text-white/50 text-sm">
            {markers.length} marker{markers.length !== 1 ? "s" : ""}
        </span>
        <button
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
            onclick={goToNextMarker}
            aria-label="Go to next marker"
        >
            Next ▶️
        </button>
    </div>
</div>

<style>
    /* Custom scrollbar for timeline */
    .scrollbar-thin::-webkit-scrollbar {
        height: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
        background: hsl(240 15% 15%);
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background: hsl(280 80% 55%);
        border-radius: 2px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background: hsl(280 80% 65%);
    }
</style>
