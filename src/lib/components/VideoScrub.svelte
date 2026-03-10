<script lang="ts">
    import { type Marker, type MoveSegment, getMarkerColorClass, getMarkerSymbol, TYPE_CONFIG } from "$lib/markers";
    import { extractThumbnails, releaseThumbnails } from "$lib/video";

    interface Props {
        videoUrl: string;
        duration: number;
        currentTime: number;
        markers?: Marker[];
        moveSegments?: MoveSegment[];
        showThumbnails?: boolean;
        onSeek: (time: number) => void;
    }

    let {
        videoUrl,
        duration,
        currentTime,
        markers = [],
        moveSegments = [],
        showThumbnails = false,
        onSeek,
    }: Props = $props();

    // ─── Zoom state ───
    const MIN_PX_PER_SEC = 5; // fully zoomed out
    const MAX_PX_PER_SEC = 80; // fully zoomed in for fine scrub
    let pixelsPerSecond = $state(20);

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
    let dragStartX = $state(0);
    let dragStartTime = $state(0);

    function handlePointerDown(e: PointerEvent) {
        // Only handle primary button and single touches
        if (e.button !== 0) return;
        // Skip if pinching
        if (activeTouches.size > 0) return;

        isDragging = true;
        dragStartX = e.clientX;
        dragStartTime = currentTime;

        (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    }

    function handlePointerMove(e: PointerEvent) {
        if (!isDragging) return;
        if (activeTouches.size > 1) return; // pinching, skip drag

        const deltaX = e.clientX - dragStartX;
        // Moving finger right = scrolling timeline right = going back in time
        const deltaTime = -deltaX / pixelsPerSecond;
        const newTime = clamp(dragStartTime + deltaTime, 0, duration);
        onSeek(newTime);
    }

    function handlePointerUp(e: PointerEvent) {
        if (!isDragging) return;
        isDragging = false;
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
        const zoomFactor = 1 - e.deltaY * 0.002;
        pixelsPerSecond = clamp(pixelsPerSecond * zoomFactor, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
    }

    // ─── Visible markers (exclude "hide") ───
    let visibleMarkers = $derived(markers.filter((m) => m.type !== "hide"));

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
        if (e.key === "ArrowLeft") onSeek(clamp(currentTime - 1, 0, duration));
        if (e.key === "ArrowRight") onSeek(clamp(currentTime + 1, 0, duration));
        if (e.key === "-") pixelsPerSecond = clamp(pixelsPerSecond * 0.8, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        if (e.key === "=" || e.key === "+")
            pixelsPerSecond = clamp(pixelsPerSecond * 1.25, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
    }}
>
    <!-- Scrolling inner track -->
    <div
        class="absolute top-0 left-0 h-full will-change-transform"
        style="width: {trackWidth}px; transform: translateX({translateX}px);"
    >
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
                        class="absolute top-[calc(100%+4px)] left-0 w-full text-sm text-white py-0.5 truncate text-center pointer-events-none z-10"
                    >
                        {seg.text}
                    </span>
                {/if}
            </div>
        {/each}

        <!-- Markers -->
        {#each visibleMarkers as marker (marker.id)}
            {@const cfg = TYPE_CONFIG[marker.type] ?? TYPE_CONFIG.comment}
            <button
                type="button"
                class="absolute top-[26px] w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] cursor-pointer z-20 leading-none transition-transform duration-150 ease-in-out hover:scale-125 hover:-translate-x-1/2 -translate-x-1/2 -translate-y-1/2 shadow-md outline-none"
                style="
                    left: {marker.time * pixelsPerSecond}px;
                    background: {cfg.iconBg};
                    border: 1.5px solid {cfg.color};
                    color: white;
                "
                title="{marker.type}: {marker.text}"
                onclick={(e) => {
                    e.stopPropagation();
                    onSeek(marker.time);
                }}
            >
                {cfg.icon}
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
