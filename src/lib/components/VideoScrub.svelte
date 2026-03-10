<script lang="ts">
    import { type Marker, type MoveSegment, getMarkerColorClass, getMarkerSymbol } from "$lib/markers";
    import { extractThumbnails, releaseThumbnails } from "$lib/video";

    interface Props {
        videoUrl: string;
        duration: number;
        currentTime: number;
        markers?: Marker[];
        moveSegments?: MoveSegment[];
        showThumbnails?: boolean;
        onSeek: (time: number) => void;
        onScrubStart?: () => void;
        onScrubEnd?: () => void;
        onShowMoves?: () => void;
    }

    let {
        videoUrl,
        duration,
        currentTime,
        markers = [],
        moveSegments = [],
        showThumbnails = false,
        onSeek,
        onScrubStart,
        onScrubEnd,
        onShowMoves,
    }: Props = $props();

    // ─── Zoom state ───
    const MIN_PX_PER_SEC = 0.5; // fully zoomed out
    const MAX_PX_PER_SEC = 100; // fully zoomed in for fine scrub
    let manualPixelsPerSecond = $state<number | null>(null);

    // Initial/Auto-fit pixelsPerSecond calculation
    let autoPixelsPerSecond = $derived.by(() => {
        if (duration > 0 && containerWidth > 0) {
            return clamp(containerWidth / duration, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        }
        return 20; // Sensible default while loading
    });

    let pixelsPerSecond = $derived(manualPixelsPerSecond ?? autoPixelsPerSecond);

    // Reset manual zoom when a new video is loaded
    $effect(() => {
        videoUrl;
        manualPixelsPerSecond = null;
    });

    // ─── Container refs & sizing ───
    let containerEl: HTMLDivElement | null = $state(null);
    let containerWidth = $state(0);

    // Total track width in px
    let trackWidth = $derived(duration * pixelsPerSecond);

    // ─── Translate: position the track so currentTime sits at center ───
    // translateX: the CSS translateX for the inner track.
    // Positive = track shifted right, negative = track shifted left.
    let translateX = $derived.by(() => {
        const center = (containerWidth || 0) / 2;
        const timePos = currentTime * pixelsPerSecond;
        return center - timePos;
    });

    // ─── Time ticks ───
    // Choose an interval so ticks are at least 60px apart
    const TICK_INTERVALS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

    let tickInterval = $derived.by(() => {
        for (const interval of TICK_INTERVALS) {
            if (interval * pixelsPerSecond >= 60) return interval;
        }
        return TICK_INTERVALS[TICK_INTERVALS.length - 1];
    });

    let ticks = $derived.by(() => {
        if (duration <= 0) return [];
        const result: { time: number; x: number }[] = [];
        const count = Math.floor(duration / tickInterval);
        for (let i = 0; i <= count; i++) {
            const t = i * tickInterval;
            result.push({ time: t, x: t * pixelsPerSecond });
        }
        // Add final tick at duration if not already there
        if (result.length === 0 || result[result.length - 1].time < duration - tickInterval * 0.5) {
            result.push({ time: duration, x: duration * pixelsPerSecond });
        }
        return result;
    });

    // ─── Format time ───
    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function formatTime2(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1).padStart(4, "0");
        return `${mins}:${secs}`;
    }

    // ─── Clamp helper ───
    function clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, val));
    }

    // ─── Convert screen X to time ───
    function screenXToTime(clientX: number): number {
        if (!containerEl) return 0;
        const rect = containerEl.getBoundingClientRect();
        // clientX relative to container left
        const relX = clientX - rect.left;
        // relX corresponds to translateX + timePos => timePos = relX - translateX
        const timePos = relX - translateX;
        return clamp(timePos / pixelsPerSecond, 0, duration);
    }

    // ─── Single-finger / mouse drag ───
    let isDragging = $state(false);
    let dragStartX = 0;
    let dragStartY = 0;
    let lastDragX = 0;
    let lastDragTime = 0;
    let dragVelocity = 0; // pixels per ms
    let dragStartTime = 0;
    let animationFrameId: number | null = null;

    function stopInertia() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        dragVelocity = 0;
    }

    function startInertia() {
        let lastTimestamp = performance.now();
        let simulatedTime = currentTime;
        const friction = 0.95;
        const minVelocity = 0.04;

        const loop = (now: number) => {
            const dt = now - lastTimestamp;
            lastTimestamp = now;

            // Moving finger right (v > 0) means going back in time (time decreases)
            const deltaX = dragVelocity * dt;
            const deltaTime = -deltaX / pixelsPerSecond;
            simulatedTime = clamp(simulatedTime + deltaTime, 0, duration);

            onSeek(simulatedTime);

            // Apply friction
            dragVelocity *= friction;

            if (Math.abs(dragVelocity) > minVelocity && simulatedTime > 0 && simulatedTime < duration) {
                animationFrameId = requestAnimationFrame(loop);
            } else {
                animationFrameId = null;
                onScrubEnd?.();
            }
        };
        animationFrameId = requestAnimationFrame(loop);
    }

    function handlePointerDown(e: PointerEvent) {
        // Only handle primary button and single touches
        if (e.button !== 0) return;
        // Skip if pinching
        if (activeTouches.size > 0) return;

        stopInertia();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartTime = currentTime;
        lastDragX = e.clientX;
        lastDragTime = e.timeStamp;
        dragVelocity = 0;
        onScrubStart?.();
    }

    function handlePointerMove(e: PointerEvent) {
        if (!isDragging) return;
        if (activeTouches.size > 1) return; // pinching, skip drag

        // Set pointer capture only after we're sure it's a horizontal movement
        if (containerEl && !containerEl.hasPointerCapture(e.pointerId)) {
            const dx = Math.abs(e.clientX - dragStartX);
            const dy = Math.abs(e.clientY - dragStartY);
            if (dx > 5 && dx > dy) {
                containerEl.setPointerCapture(e.pointerId);
            } else if (dy > 5) {
                isDragging = false;
                return;
            } else {
                return; // Not enough movement yet
            }
        }

        const now = e.timeStamp;
        const dt = now - lastDragTime;
        if (dt > 0) {
            const dx = e.clientX - lastDragX;
            dragVelocity = dx / dt;
            lastDragX = e.clientX;
            lastDragTime = now;
        }

        const deltaX = e.clientX - dragStartX;
        // Moving finger right = scrolling timeline right = going back in time
        const deltaTime = -deltaX / pixelsPerSecond;
        const newTime = clamp(dragStartTime + deltaTime, 0, duration);
        onSeek(newTime);
    }

    function handlePointerUp(e: PointerEvent) {
        if (!isDragging) return;
        isDragging = false;

        // If the movement stopped or slowed down significantly before releasing, clear velocity
        const timeSinceLastMove = e.timeStamp - lastDragTime;
        if (timeSinceLastMove > 100) {
            dragVelocity = 0;
        }

        if (Math.abs(dragVelocity) > 0.1) {
            startInertia();
        } else {
            onScrubEnd?.();
        }

        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    }

    // ─── Pinch-to-zoom ───
    let activeTouches: Map<number, { x: number; y: number }> = $state(new Map());
    let pinchStartDist = $state(0);
    let pinchStartPxPerSec = $state(0);
    let pinchMidTime = $state(0);

    function getTouchDist(touches: Map<number, { x: number; y: number }>): number {
        const pts = [...touches.values()];
        if (pts.length < 2) return 0;
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function handleTouchStart(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }

        if (activeTouches.size === 2) {
            // Starting a pinch
            stopInertia();
            isDragging = false; // cancel any drag
            pinchStartDist = getTouchDist(activeTouches);
            pinchStartPxPerSec = pixelsPerSecond;
            // Compute mid-point time for zoom centering
            const pts = [...activeTouches.values()];
            const midX = (pts[0].x + pts[1].x) / 2;
            pinchMidTime = screenXToTime(midX);
            e.preventDefault();
        }
    }

    function handleTouchMove(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }

        if (activeTouches.size === 2) {
            e.preventDefault();
            const currentDist = getTouchDist(activeTouches);
            if (pinchStartDist > 0) {
                const scale = currentDist / pinchStartDist;
                manualPixelsPerSecond = clamp(pinchStartPxPerSec * scale, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
            }
        }
    }

    function handleTouchEnd(e: TouchEvent) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            activeTouches.delete(e.changedTouches[i].identifier);
        }
        if (activeTouches.size < 2) {
            pinchStartDist = 0;
        }
    }

    // ─── Mouse wheel zoom ───
    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        stopInertia();
        const zoomFactor = 1 - e.deltaY * 0.002;
        manualPixelsPerSecond = clamp(pixelsPerSecond * zoomFactor, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
    }

    // ─── Visible markers ───
    let visibleMarkers = $derived(markers);

    // ─── Counts for status buttons ───
    let moveCount = $derived(markers.filter((m) => m.type === "move").length);
    let commentCount = $derived(markers.filter((m) => m.type === "comment").length);
    let likeCount = $derived(markers.filter((m) => m.type === "like").length);

    // ─── Thumbnails ───
    let thumbnails = $state<string[]>([]);
    let currentThumbCount = $state(0);

    $effect(() => {
        if (!videoUrl || duration <= 0 || !showThumbnails) {
            if (thumbnails.length > 0) {
                releaseThumbnails(thumbnails);
                thumbnails = [];
                currentThumbCount = 0;
            }
            return;
        }

        // Dependency on pixelsPerSecond to trigger re-extraction on zoom
        // but we'll debounce it to avoid constant processing.
        pixelsPerSecond;

        let active = true;
        const timeout = setTimeout(() => {
            // Calculate ideal count based on zoom level
            // We want roughly one thumbnail every REPEAT_PIX pixels of track
            const REPEAT_PIX = 120;
            const idealCount = Math.ceil((duration * pixelsPerSecond) / REPEAT_PIX);
            const count = Math.min(60, Math.max(10, idealCount));

            extractThumbnails(videoUrl, count, 160).then((ts) => {
                if (active) {
                    const oldTs = [...thumbnails];
                    thumbnails = ts;
                    currentThumbCount = count;
                    // Clean up old object URLs
                    setTimeout(() => releaseThumbnails(oldTs), 100);
                } else {
                    releaseThumbnails(ts);
                }
            });
        }, 400); // 400ms debounce

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    });

    // Cleanup thumbnails on unmount
    $effect(() => {
        return () => {
            releaseThumbnails(thumbnails);
        };
    });
</script>

<!-- VideoScrub component -->
<div
    class="relative w-full h-30 overflow-hidden cursor-grab active:cursor-grabbing select-none bg-[#222]"
    style="touch-action: pan-y;"
    bind:this={containerEl}
    bind:clientWidth={containerWidth}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    ontouchcancel={handleTouchEnd}
    onwheel={handleWheel}
    role="slider"
    aria-label="Video timeline scrubber"
    aria-valuenow={Math.round(currentTime)}
    aria-valuemin={0}
    aria-valuemax={Math.round(duration)}
    tabindex="0"
    onkeydown={(e) => {
        if (e.key === "ArrowLeft") {
            stopInertia();
            onSeek(clamp(currentTime - 1, 0, duration));
        }
        if (e.key === "ArrowRight") {
            stopInertia();
            onSeek(clamp(currentTime + 1, 0, duration));
        }
        if (e.key === "-") {
            manualPixelsPerSecond = clamp(pixelsPerSecond * 0.8, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        }
        if (e.key === "=" || e.key === "+") {
            manualPixelsPerSecond = clamp(pixelsPerSecond * 1.25, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        }
    }}
>
    <!-- Scrolling inner track -->
    <div
        class="absolute top-0 left-0 h-full will-change-transform transition-opacity duration-200 {duration > 0 &&
        containerWidth > 0
            ? 'opacity-100'
            : 'opacity-0'}"
        style="width: {trackWidth}px; transform: translateX({translateX}px);"
    >
        <!-- Start-of-video status buttons -->
        <div class="absolute right-full top-0 h-full flex flex-col items-center justify-center pr-8 gap-1.5">
            <button
                type="button"
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full transition-colors whitespace-nowrap shadow-lg active:scale-95"
                onclick={(e) => {
                    e.stopPropagation();
                    onShowMoves?.();
                }}
            >
                Moves ({moveCount})
            </button>
            <div class="flex gap-3 text-white/70">
                <div class="flex items-center gap-1 text-[11px] font-medium leading-none">
                    <span>{getMarkerSymbol("comment")}</span>
                    <span>{commentCount}</span>
                </div>
                <div class="flex items-center gap-1 text-[11px] font-medium leading-none">
                    <span>{getMarkerSymbol("like")}</span>
                    <span>{likeCount}</span>
                </div>
            </div>
        </div>

        <!-- Thumbnails background -->
        {#if showThumbnails}
            <div
                class="absolute top-[36px] bottom-[32px] left-0 right-0 pointer-events-none select-none overflow-hidden"
            >
                {#each thumbnails as thumb, i}
                    {@const interval = duration / currentThumbCount}
                    {@const time = i * interval + interval / 2}
                    <img
                        src={thumb}
                        alt=""
                        class="h-full object-contain absolute top-0 -translate-x-1/2"
                        style="left: {time * pixelsPerSecond}px;"
                    />
                {/each}
            </div>
        {/if}

        <!-- Track background line -->
        <div class="absolute top-[24px] left-0 right-0 h-[4px] bg-white/20 rounded-full z-10"></div>

        <!-- Move segment highlights -->
        {#each moveSegments as seg}
            <div
                class="absolute top-[20px] h-3 bg-blue-400 rounded-sm pointer-events-none z-10"
                style="left: {seg.start * pixelsPerSecond}px; width: {(seg.end - seg.start) * pixelsPerSecond}px;"
            >
                {#if seg.text && (seg.end - seg.start) * pixelsPerSecond > 30}
                    <span
                        class="absolute top-[calc(100%+4px)] left-0 w-full text-sm text-white py-0.5 truncate pointer-events-none z-10"
                    >
                        {seg.text}
                    </span>
                {/if}
            </div>
        {/each}

        <!-- Markers -->
        {#each visibleMarkers as marker (marker.id)}
            <button
                type="button"
                class="absolute top-[14px] -translate-x-1/2 text-sm cursor-pointer bg-transparent border-none p-0.5 z-20 drop-shadow-md transition-transform duration-150 ease-in-out hover:scale-140 hover:-translate-x-1/2 {getMarkerColorClass(
                    marker,
                )}"
                style="left: {marker.time * pixelsPerSecond}px;"
                title="{marker.type}: {marker.text}"
                onclick={(e) => {
                    e.stopPropagation();
                    stopInertia();
                    onSeek(marker.time);
                }}
            >
                {getMarkerSymbol(marker.type)}
            </button>
        {/each}

        <!-- Time ticks & labels -->
        {#each ticks as tick, i}
            <div class="absolute bottom-[16px] -translate-x-px pointer-events-none" style="left: {tick.x}px;">
                <span
                    class="block text-[9px] text-white/40 mt-0.5 -translate-x-1/2 whitespace-nowrap tabular-nums font-[Inter,monospace]"
                    >{formatTime(tick.time)}</span
                >
            </div>
            {#if i < ticks.length - 1}
                <div
                    class="absolute bottom-[21px] w-0.5 h-0.5 bg-white/20 rounded-full -translate-x-1/2 pointer-events-none"
                    style="left: {(tick.x + ticks[i + 1].x) / 2}px;"
                ></div>
            {/if}
        {/each}
    </div>

    <!-- Fixed center playhead line -->
    <div
        class="absolute top-1 left-1/2 w-0.5 bottom-7 bg-white -translate-x-1/2 pointer-events-none z-10 rounded-sm"
    ></div>

    <!-- Current time label at playhead -->
    <div
        class="absolute bottom-[3px] left-1/2 -translate-x-1/2 text-[9px] font-semibold text-white pointer-events-none z-10 tabular-nums font-[Inter,monospace] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
    >
        {formatTime2(currentTime)}
    </div>
</div>
