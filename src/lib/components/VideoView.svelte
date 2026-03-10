<script lang="ts">
    import type { Snippet } from "svelte";
    import VideoScrub from "./VideoScrub.svelte";
    import MovesDrawer from "./MovesDrawer.svelte";
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
    let drawerProgress = $state(0);
    let isDrawerDragging = $state(false);
    let startDrawerProgress = 0;

    // Physics variables
    let drawerRafId: number | null = null;
    let drawerVelocity = 0; // progress / frame
    let drawerTarget: number | null = null;

    function startDrawerPhysics(target: number | null, initialVelocity: number) {
        if (drawerRafId !== null) {
            cancelAnimationFrame(drawerRafId);
        }
        drawerTarget = target;
        drawerVelocity = initialVelocity;
        let lastTime = performance.now();

        // Critical damped spring or slightly under-damped.
        const stiffness = 0.05;
        const damping = 0.7;
        const friction = 0.95;

        function loop(time: number) {
            const dt = Math.min(time - lastTime, 32);
            let frames = dt / 16.666;
            if (frames < 0.1) frames = 0.1;
            lastTime = time;

            for (let i = 0; i < Math.max(1, Math.floor(frames)); i++) {
                if (drawerTarget !== null) {
                    const force = (drawerTarget - drawerProgress) * stiffness;
                    drawerVelocity += force;
                    drawerVelocity *= damping;
                } else {
                    drawerVelocity *= friction;
                }
                drawerProgress += drawerVelocity;

                // Hard boundary collisions for satisfying shut
                if (drawerProgress <= 0) {
                    drawerProgress = 0;
                    drawerVelocity = 0;
                } else if (drawerProgress >= 1) {
                    drawerProgress = 1;
                    drawerVelocity = 0;
                }
            }

            if (drawerTarget !== null) {
                if (Math.abs(drawerProgress - drawerTarget) < 0.0005 && Math.abs(drawerVelocity) < 0.0005) {
                    drawerProgress = drawerTarget;
                    drawerRafId = null;
                    return;
                }
            } else {
                if (Math.abs(drawerVelocity) < 0.0001) {
                    drawerRafId = null;
                    return;
                }
            }

            drawerRafId = requestAnimationFrame(loop);
        }
        drawerRafId = requestAnimationFrame(loop);
    }

    let isMovesMode = $derived(drawerProgress > 0.5);
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
        startDrawerPhysics(isMovesMode ? 0 : 1, 0);
    }

    function handleDrawerDragStart() {
        if (drawerRafId !== null) {
            cancelAnimationFrame(drawerRafId);
            drawerRafId = null;
        }
        startDrawerProgress = drawerProgress;
        isDrawerDragging = true;
    }

    function handleDrawerDrag(deltaY: number) {
        if (!outerContainerEl) return;
        const totalHeight = outerContainerEl.clientHeight;
        const maxDrawerDelta = totalHeight * 0.55;
        // deltaY is positive when moving down
        // 1.0 progress is fully open (moved up)
        const deltaProgress = -deltaY / maxDrawerDelta;
        drawerProgress = Math.max(0, Math.min(1, startDrawerProgress + deltaProgress));
    }

    function handleDrawerDragEnd(velocityY: number = 0) {
        isDrawerDragging = false;

        if (!outerContainerEl) return;
        const totalHeight = outerContainerEl.clientHeight;
        const maxDrawerDelta = totalHeight * 0.55;

        // Velocity from px/ms to progress/ms
        let vy = -velocityY / maxDrawerDelta;

        // Convert velocity to per-frame velocity for the physics engine
        const frameVelocity = vy * 16.666;

        // amplify throwing velocity for extra satisfying effect
        const amplifiedVelocity = frameVelocity * 1.5;

        // pure inertia
        startDrawerPhysics(null, amplifiedVelocity);
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
<div class="w-full h-full overflow-hidden flex flex-col" bind:this={outerContainerEl}>
    <!-- Video + Controls section - dynamic height based on drawer -->
    <div
        class="relative w-full bg-black text-white flex flex-col overflow-hidden"
        style="height: {100 - drawerProgress * 55}dvh;"
    >
        <div class="relative flex-1 min-h-0 w-full overflow-hidden">
            <video
                bind:this={videoEl}
                src={videoUrl + "#t=0.001"}
                class="w-full h-full transition-all duration-500 {cover && !isMovesMode
                    ? 'absolute inset-0 object-cover'
                    : 'object-contain'}"
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
                onclick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
            ></button>
        </div>

        <!-- Controls - overlaid or stacked at bottom -->
        <div
            class="{cover && !isMovesMode
                ? 'absolute bottom-0 left-0 right-0'
                : 'relative'} bg-linear-to-t from-black/80 to-transparent"
        >
            <!-- Floating Labels Stack (Status + Comments) -->
            <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2 pb-4 pointer-events-none w-full"
            >
                <!-- Active Marker Comment Bubble -->
                {#if activeMarker}
                    <div class="flex items-center gap-1.5 z-40">
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

                <!-- Status Labels (Pause / Move Name) -->
                <div class="flex flex-col items-center gap-1 text-center">
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
            </div>

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
                onDrawerDragStart={handleDrawerDragStart}
                onDrawerDrag={handleDrawerDrag}
                onDrawerDragEnd={handleDrawerDragEnd}
                isMovesOpen={isMovesMode}
            />
        </div>
    </div>

    <MovesDrawer progress={drawerProgress} isDragging={isDrawerDragging} {moves} onSeek={seekTo} />

    <!-- Additional content slot (div3) - for comments, etc. -->
    <div class="relative z-0">
        {@render children?.()}
    </div>
</div>
