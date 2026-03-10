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
        onDrawerDragStart?: () => void;
        onDrawerDrag?: (deltaY: number) => void;
        onDrawerDragEnd?: (velocityY: number) => void;
        isMovesOpen?: boolean;
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
        onDrawerDragStart,
        onDrawerDrag,
        onDrawerDragEnd,
        isMovesOpen = false,
    }: Props = $props();

    // ─── Zoom state ───
    const MIN_PX_PER_SEC = 0.5; // fully zoomed out
    const MAX_PX_PER_SEC = 100; // fully zoomed in for fine scrub
    const DEFAULT_PX_PER_SEC = 4; // default px per second when no manual zoom set
    let pixelsPerSecond = $state<number>(DEFAULT_PX_PER_SEC);

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
    let lastDragY = 0;
    let lastDragTime = 0;
    let dragVelocity = 0; // pixels per ms
    let dragVelocityY = 0; // pixels per ms
    let dragStartTime = 0;
    let isVerticalDragging = $state(false);
    let animationFrameId: number | null = null;
    let isScrubbingExternally = false;

    function beginScrub() {
        if (!isScrubbingExternally) {
            isScrubbingExternally = true;
            onScrubStart?.();
        }
    }

    function endScrub() {
        if (isScrubbingExternally) {
            isScrubbingExternally = false;
            onScrubEnd?.();
        }
    }

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
                endScrub();
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
        isVerticalDragging = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartTime = currentTime;
        lastDragX = e.clientX;
        lastDragY = e.clientY;
        lastDragTime = e.timeStamp;
        dragVelocity = 0;
        dragVelocityY = 0;
    }

    function handlePointerMove(e: PointerEvent) {
        if (!isDragging) return;
        if (activeTouches.size > 1) return; // pinching, skip drag

        const now = e.timeStamp;
        const dt = now - lastDragTime;
        if (dt > 0) {
            const dx_frame = e.clientX - lastDragX;
            const dy_frame = e.clientY - lastDragY;
            dragVelocity = dx_frame / dt;
            dragVelocityY = dy_frame / dt;
            lastDragX = e.clientX;
            lastDragY = e.clientY;
            lastDragTime = now;
        }

        const dx = Math.abs(e.clientX - dragStartX);
        const deltaY = e.clientY - dragStartY;
        const dy = Math.abs(deltaY);

        // Determine if it's a vertical or horizontal gesture if not yet determined
        if (!isVerticalDragging && !containerEl?.hasPointerCapture(e.pointerId)) {
            const threshold = 10;
            if (dy > threshold && dy > dx) {
                isVerticalDragging = true;
                onDrawerDragStart?.();
                containerEl?.setPointerCapture(e.pointerId);
            } else if (dx > threshold && dx > dy) {
                containerEl?.setPointerCapture(e.pointerId);
                beginScrub();
            } else {
                return; // Wait for more movement
            }
        }

        if (isVerticalDragging) {
            onDrawerDrag?.(deltaY);
            return;
        }

        beginScrub();

        const deltaX = e.clientX - dragStartX;
        // Moving finger right = scrolling timeline right = going back in time
        const deltaTime = -deltaX / pixelsPerSecond;
        const newTime = clamp(dragStartTime + deltaTime, 0, duration);
        onSeek(newTime);
    }

    function handlePointerUp(e: PointerEvent) {
        if (!isDragging) return;

        // If the movement stopped or slowed down significantly before releasing, clear velocity
        const timeSinceLastMove = e.timeStamp - lastDragTime;
        if (timeSinceLastMove > 100) {
            dragVelocity = 0;
            dragVelocityY = 0;
        }

        if (isVerticalDragging) {
            isVerticalDragging = false;
            isDragging = false;
            endScrub();
            onDrawerDragEnd?.(dragVelocityY);
            (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
            return;
        }

        isDragging = false;

        if (Math.abs(dragVelocity) > 0.1) {
            startInertia();
        } else {
            endScrub();
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
            if (isDragging) {
                isDragging = false; // cancel any drag
                endScrub();
            }
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
                pixelsPerSecond = clamp(pinchStartPxPerSec * scale, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
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
        pixelsPerSecond = clamp(pixelsPerSecond * zoomFactor, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
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
    style="touch-action: none;"
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
            pixelsPerSecond = clamp(pixelsPerSecond * 0.8, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        }
        if (e.key === "=" || e.key === "+") {
            pixelsPerSecond = clamp(pixelsPerSecond * 1.25, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
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
        <!-- Start-of-video status buttons (Gutter UI) -->
        <div
            class="absolute right-full h-full flex flex-col justify-center pr-8 gap-2.5 transition-all duration-500 ease-in-out"
        >
            <!-- Moves button -->
            <button
                type="button"
                class="flex items-center gap-2 px-3.5 py-2 rounded-[10px] border text-[13px] font-semibold transition-all duration-200 cursor-pointer backdrop-blur-xl shadow-lg active:scale-95 whitespace-nowrap {isMovesOpen
                    ? 'bg-blue-600/20 border-blue-400/40 text-blue-300'
                    : 'bg-white/8 border-white/12 text-white'}"
                onclick={(e) => {
                    e.stopPropagation();
                    onShowMoves?.();
                }}
            >
                <span
                    class="flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-md text-[12px] font-bold transition-all duration-200 {isMovesOpen
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/15 text-white/80'}"
                >
                    {moveCount}
                </span>
                Moves
                <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="transition-transform duration-300 {isMovesOpen ? 'rotate-180' : ''}"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            <!-- Comments & Likes row -->
            <div class="flex gap-1.5">
                <button
                    class="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 border border-white/8 rounded-lg text-[12px] text-white/55 cursor-pointer backdrop-blur-xl hover:bg-white/10 transition-colors"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {commentCount}
                </button>

                <button
                    class="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 border border-white/8 rounded-lg text-[12px] text-white/55 cursor-pointer backdrop-blur-xl hover:bg-white/10 transition-colors"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path
                            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                        />
                    </svg>
                    {likeCount}
                </button>
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
