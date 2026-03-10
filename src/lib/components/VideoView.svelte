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
    let outerContainerEl: HTMLDivElement | null = $state(null);
    let currentTime = $state(0);
    let isMovesMode = $state(false);
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

    function handleShowMoves() {
        isMovesMode = !isMovesMode;
        // No longer scrolling to top, the panel slides in.
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

    let moves = $derived(markers.filter((m) => m.type === "move"));
</script>

<!-- Outer scrollable container (div1) -->
<div class="w-full h-full overflow-hidden" bind:this={outerContainerEl}>
    <!-- Video + Controls section - exactly viewport height (div2) -->
    <div
        class="relative w-full bg-black text-white transition-[height] duration-500 ease-in-out {isMovesMode
            ? 'h-[45dvh]'
            : 'h-dvh'}"
    >
        <!-- Video - fills entire section -->
        <video
            bind:this={videoEl}
            src={videoUrl}
            class="w-full transition-all duration-500 {isMovesMode
                ? 'h-full object-contain pb-2'
                : cover
                  ? 'h-full object-cover'
                  : 'h-[calc(100%-7.5rem)] object-contain'}"
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
            class="absolute inset-0 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-6"
            onclick={() => {
                if (isMovesMode) {
                    isMovesMode = false;
                } else {
                    togglePlay();
                }
            }}
            aria-label={isMovesMode ? "Close moves list" : isPlaying ? "Pause" : "Play"}
        ></button>

        <!-- Status Labels (Center) -->
        <div
            class="absolute {isMovesMode
                ? 'bottom-32'
                : 'bottom-43'} left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none text-center"
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
                onShowMoves={handleShowMoves}
                isMovesOpen={isMovesMode}
            />
        </div>
    </div>

    <!-- Moves panel — slides up from bottom -->
    <div
        class="absolute bottom-0 left-0 right-0 h-[55%] bg-linear-to-b from-[#111118] to-[#0a0a0f] border-t border-white/8 rounded-t-[20px] overflow-y-auto z-5 px-0 pt-5 pb-10 transition-transform duration-450"
        style="transform: {isMovesMode
            ? 'translateY(0)'
            : 'translateY(100%)'}; transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);"
    >
        <!-- Drag indicator -->
        <div class="w-9 h-1 bg-white/15 rounded-full mx-auto mb-5"></div>

        <div class="px-5">
            <h3 class="text-white/45 text-[11px] font-semibold uppercase tracking-[1.5px] mb-4">Moves in this video</h3>

            <div class="flex flex-col gap-2">
                {#each moves as move, i}
                    <button
                        type="button"
                        class="flex items-center gap-3 bg-white/4 border border-white/6 rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:bg-white/8 text-left w-full active:scale-[0.98]"
                        onclick={() => seekTo(move.time)}
                    >
                        <!-- Move number -->
                        <div
                            class="w-8 h-8 rounded-lg bg-blue-600/12 border border-blue-600/20 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0"
                        >
                            {i + 1}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="text-white text-sm font-semibold leading-tight">
                                {move.text}
                            </div>
                            <div class="text-white/35 text-[11px] mt-0.5">Beginner</div>
                        </div>

                        <!-- Jump to timestamp -->
                        <div class="flex items-center gap-1 text-white/40 text-xs shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {formatTime(move.time)}
                        </div>
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <!-- Additional content slot (div3) - for comments, etc. -->
    <div class="relative z-0">
        {@render children?.()}
    </div>
</div>
