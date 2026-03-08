<script lang="ts">
    import type { Snippet } from "svelte";
    import VideoScrub from "./VideoScrub.svelte";
    import { type Marker, getMarkerColorClass, getMarkerSymbol } from "$lib/markers";

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

    // Ensure duration is captured if video is already ready
    $effect(() => {
        if (videoEl && videoEl.duration > 0 && !isNaN(videoEl.duration)) {
            duration = videoEl.duration;
        }
    });

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
                (m) =>
                    m.type === "pause" &&
                    Math.abs(m.time - currentTime) < 0.25 &&
                    m.id !== lastPausedMarkerId,
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

    // Scrub handler for VideoScrub component
    function handleScrub(time: number) {
        seekTo(time);
    }

    // Skip forward/back
    function skipBack() {
        seekTo(currentTime - 10);
    }

    function skipForward() {
        seekTo(currentTime + 10);
    }

    // Find the marker currently under the playhead (within 1 second)
    let playheadMarker = $derived(markers.find((m) => Math.abs(m.time - currentTime) < 1) || null);

    // Find active marker for the comment bubble (within 1 second of current time)
    let activeMarker = $derived.by(() => {
        const m = playheadMarker;
        if (!m || m.type === "move" || m.type === "hide") return null;
        if (m.type === "pause") return m.text ? m : null;
        return m.text ? m : null;
    });

    // Find current active move name
    let activeMoveName = $derived.by(() => {
        // Find the latest marker of type 'move' or 'hide' that has already happened
        const lastRelevantMarker = [...markers]
            .filter((m) => (m.type === "move" || m.type === "hide") && m.time <= currentTime)
            .sort((a, b) => b.time - a.time)[0];

        if (lastRelevantMarker?.type === "move") {
            return lastRelevantMarker.text;
        }
        return null;
    });

    // Visible markers sorted by time (excluding 'hide' markers)
    let sortedVisibleMarkers = $derived([...markers].filter((m) => m.type !== "hide").sort((a, b) => a.time - b.time));

    // All move segments for highlighting on the timeline
    let moveSegments = $derived.by(() => {
        if (duration <= 0) return [];
        const sorted = [...markers]
            .filter((m) => m.type === "move" || m.type === "hide")
            .sort((a, b) => a.time - b.time);

        const segments: { start: number; end: number; text: string | null }[] = [];
        let currentStartTime: number | null = null;
        let currentText: string | null = null;

        for (const m of sorted) {
            if (m.type === "move") {
                if (currentStartTime !== null) {
                    segments.push({ start: currentStartTime, end: m.time, text: currentText });
                }
                currentStartTime = m.time;
                currentText = m.text || null;
            } else if (m.type === "hide") {
                if (currentStartTime !== null) {
                    segments.push({ start: currentStartTime, end: m.time, text: currentText });
                    currentStartTime = null;
                    currentText = null;
                }
            }
        }
        if (currentStartTime !== null) {
            segments.push({ start: currentStartTime, end: duration, text: currentText });
        }
        return segments;
    });
</script>

<!-- Outer scrollable container (div1) -->
<div class="w-full h-full overflow-y-auto">
    <!-- Video + Controls section - exactly viewport height (div2) -->
    <div class="relative w-full h-dvh bg-black text-white">
        <!-- Video - fills entire section -->
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
            class="absolute inset-0 cursor-pointer"
            onclick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
        ></button>

        <!-- Status Labels (Bottom Left) -->
        <div class="absolute bottom-40 left-6 flex flex-col gap-1 pointer-events-none">
            {#if activeMoveName}
                <div
                    class="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-opacity duration-300"
                >
                    {activeMoveName}
                </div>
            {/if}
            {#if !isPlaying && playheadMarker?.type === "pause"}
                <div
                    class="text-xl font-bold text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-opacity duration-300"
                >
                    ⏸ Auto-paused
                </div>
            {/if}
        </div>

        <!-- Controls - overlaid at bottom of video section -->
        <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-4 pb-4 pt-8">
            <!-- Active Marker Comment Bubble -->
            {#if activeMarker}
                <div class="flex justify-center items-center gap-1.5 mb-0.5 z-40">
                    <!-- User Avatar (Initials) -->
                    <div
                        class="w-6 h-6 flex items-center justify-center rounded-full bg-black/70 border border-white text-[10px] font-bold text-white shadow-lg shrink-0"
                    >
                        {getInitials(activeMarker.username)}
                    </div>
                    <!-- Comment Bubble -->
                    <div class="bg-black/70 text-white text-sm px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                        {activeMarker.text}
                    </div>
                </div>
            {/if}

            <!-- VideoScrub Timeline -->
            <VideoScrub {duration} {currentTime} {markers} {moveSegments} {isPlaying} onSeek={handleScrub} />

            <!-- Controls Row -->
            <div class="flex items-center justify-between mt-3">
                <!-- Left: Play/Pause + Time -->
                <div class="flex items-center gap-3">
                    <!-- Play/Pause -->
                    <button
                        type="button"
                        class="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        onclick={togglePlay}
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {#if isPlaying}
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                        {:else}
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        {/if}
                    </button>

                    <!-- Time Display -->
                    <div class="text-sm text-white/90">
                        {formatTime(currentTime)}
                        <span class="text-white/50">/ {formatTime(duration)}</span>
                    </div>
                </div>

                <!-- Right: Add Annotation Button -->
                <button
                    type="button"
                    class="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
                    aria-label="Add Comment"
                >
                    Add Comment
                </button>
            </div>
        </div>
    </div>

    <!-- Annotations List -->
    <div class="max-w-3xl mx-auto px-6 py-8">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
            Annotations
            <span class="text-sm font-normal text-gray-500">({sortedVisibleMarkers.length})</span>
        </h2>

        <div class="space-y-1">
            {#each sortedVisibleMarkers as marker (marker.id)}
                <button
                    type="button"
                    class="w-full flex items-start gap-4 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group text-left"
                    onclick={() => seekTo(marker.time)}
                >
                    <!-- Time Badge -->
                    <span
                        class="text-xs font-mono font-bold px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 min-w-14 text-center group-hover:bg-blue-600 group-hover:text-white transition-colors"
                    >
                        {formatTime(marker.time)}
                    </span>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-sm {getMarkerColorClass(marker)}">
                                {getMarkerSymbol(marker.type)}
                            </span>
                            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                                {marker.type}
                            </span>
                        </div>

                        {#if marker.text}
                            <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                {marker.text}
                            </p>
                        {/if}

                        {#if marker.username}
                            <span class="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                                — {marker.username}
                            </span>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
    </div>

    <!-- Additional content slot (div3) - for comments, etc. -->
    {@render children?.()}
</div>
