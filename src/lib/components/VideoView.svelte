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
        cover?: boolean;
        children?: Snippet;
    }

    let { videoUrl, duration, markers = $bindable([]), onMarkerAdd, cover = false, children }: Props = $props();

    // State
    let videoEl: HTMLVideoElement | null = $state(null);
    let currentTime = $state(0);
    let isPlaying = $state(false);
    let lastPausedMarkerId = $state<string | null>(null);
    let wasPlayingBeforeScrub = false;

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

    let pendingSeekTime = $state<number | null>(null);
    let isWaitingForRAF = false;
    let lastManualInteractionTime = 0;

    function seekTo(time: number) {
        if (!videoEl) return;
        const clamped = Math.max(0, Math.min(time, duration));

        // Immediate update for responsive scrubbing (UI)
        currentTime = clamped;
        lastManualInteractionTime = Date.now();
        lastPausedMarkerId = null; // Clear trigger when seeking

        // Skip actual seek if it's too close to current position
        if (Math.abs(videoEl.currentTime - clamped) < 0.001) {
            pendingSeekTime = null;
            return;
        }

        pendingSeekTime = clamped;

        if (isWaitingForRAF) return;

        isWaitingForRAF = true;
        requestAnimationFrame(() => {
            isWaitingForRAF = false;
            if (!videoEl || pendingSeekTime === null) return;

            // If browser is still seeking from previous request,
            // the handleSeeked will pick up the latest pendingSeekTime.
            if (videoEl.seeking) return;

            const timeToSeek = pendingSeekTime;
            pendingSeekTime = null;
            videoEl.currentTime = timeToSeek;
        });
    }

    function handleSeeked() {
        if (videoEl && pendingSeekTime !== null && !videoEl.seeking) {
            const timeToSeek = pendingSeekTime;
            pendingSeekTime = null;
            videoEl.currentTime = timeToSeek;
        }
    }

    // Sync current time and handle automated behaviors
    function syncTime(time?: number) {
        if (!videoEl) return;

        // While manually scrubbing or just after manual seek, we treat
        // user interaction as the source of truth to avoid jitter from stale
        // video events. We only allow video updates if playing.
        if (!isPlaying && Date.now() - lastManualInteractionTime < 500) {
            return;
        }

        // Don't let stale video time updates overwrite our precise scrub position
        // during active scrubbing or pending seeks.
        if (pendingSeekTime !== null || videoEl.seeking) return;

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

    // Scrub handlers for VideoScrub component
    function handleScrubStart() {
        wasPlayingBeforeScrub = isPlaying;
        if (isPlaying) videoEl?.pause();
    }

    function handleScrubEnd() {
        if (wasPlayingBeforeScrub) {
            videoEl?.play();
        }
        wasPlayingBeforeScrub = false;
    }

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
        if (!m || m.type === "move") return null;
        return m.text ? m : null;
    });

    // Find current active move name
    let activeMoveName = $derived.by(() => {
        // Find a 'move' marker whose range includes current time
        const activeMove = markers.find(
            (m) => m.type === "move" && currentTime >= m.time && (m.end === undefined || currentTime <= m.end),
        );
        return activeMove?.text || null;
    });

    // Visible markers sorted by time
    let sortedVisibleMarkers = $derived([...markers].sort((a, b) => a.time - b.time));

    // All move segments for highlighting on the timeline
    let moveSegments = $derived.by(() => {
        return markers
            .filter((m) => m.type === "move")
            .map((m) => ({
                start: m.time,
                end: m.end ?? duration,
                text: m.text ?? null,
            }));
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
            class="w-full {cover ? 'h-full object-cover' : 'h-[calc(100%-7.5rem)] object-contain'}"
            ontimeupdate={handleTimeUpdate}
            onloadedmetadata={handleLoadedMetadata}
            ondurationchange={handleDurationChange}
            onloadeddata={handleLoadedMetadata}
            onplay={handlePlay}
            onpause={handlePause}
            onseeked={handleSeeked}
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

        <!-- Status Labels (Center) -->
        <div
            class="absolute bottom-43 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none text-center"
        >
            {#if !isPlaying && playheadMarker?.type === "pause"}
                <div
                    class="text-xl font-bold text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-opacity duration-300"
                >
                    ⏸ Auto-paused
                </div>
            {/if}
            {#if activeMoveName}
                <div
                    class="text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-opacity duration-300"
                >
                    {activeMoveName}
                </div>
            {/if}
        </div>

        <!-- Controls - overlaid at bottom of video section -->
        <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent pb-0 pt-8">
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
            <VideoScrub
                {videoUrl}
                {duration}
                {currentTime}
                {markers}
                {moveSegments}
                onSeek={handleScrub}
                onScrubStart={handleScrubStart}
                onScrubEnd={handleScrubEnd}
            />
        </div>
    </div>

    <!-- Annotations List -->
    <div class="max-w-3xl mx-auto px-6 py-8">
        <h2 class="text-xl font-bold text-gray-900 dark:text-red-400 mb-6 flex items-center gap-2">
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
