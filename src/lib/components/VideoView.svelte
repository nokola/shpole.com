<script lang="ts">
    import type { Snippet } from "svelte";

    // Marker type
    interface Marker {
        id: string;
        time: number;
        type: "comment" | "move" | "pause" | "like" | "hide";
        text?: string;
        color?: string;
        username?: string;
    }

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

    // Bubble positioning
    let bubbleContainerEl: HTMLDivElement | null = $state(null);
    let bubbleEl: HTMLDivElement | null = $state(null);
    let containerWidth = $state(0);
    let bubbleWidth = $state(0);

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
        videoEl.currentTime = Math.max(0, Math.min(time, duration));
        lastPausedMarkerId = null; // Clear trigger when seeking
    }

    // Handle video events
    function handleTimeUpdate() {
        if (!videoEl) return;
        currentTime = videoEl.currentTime;

        // Auto-pause logic
        if (isPlaying) {
            const pauseMarker = markers.find(
                (m) =>
                    m.type === "pause" &&
                    Math.abs(m.time - currentTime) < 0.25 && // Typical timeupdate interval
                    m.id !== lastPausedMarkerId,
            );

            if (pauseMarker) {
                videoEl.pause();
                lastPausedMarkerId = pauseMarker.id;
            }
        }

        // Fallback: also check duration here in case loadedmetadata didn't fire
        if (duration === 0 && videoEl.duration > 0 && !isNaN(videoEl.duration)) {
            duration = videoEl.duration;
        }
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

    // Progress bar scrubbing
    function handleProgressClick(e: MouseEvent) {
        const target = e.currentTarget as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        seekTo(percent * duration);
    }

    // Skip forward/back
    function skipBack() {
        seekTo(currentTime - 10);
    }

    function skipForward() {
        seekTo(currentTime + 10);
    }

    // Progress percentage
    let progressPercent = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);

    // Find the marker currently under the playhead (within 1 second)
    let playheadMarker = $derived(markers.find((m) => Math.abs(m.time - currentTime) < 1) || null);

    // Find active marker for the comment bubble (within 1 second of current time)
    let activeMarker = $derived.by(() => {
        const m = playheadMarker;
        if (!m || m.type === "move" || m.type === "hide" || m.type === "pause") return null;
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

    // Bubble positioning calculations
    let bubblePosition = $derived.by(() => {
        if (!activeMarker || containerWidth === 0) {
            return { left: 0, notchPercent: 50 };
        }
        const markerPercent = duration > 0 ? (activeMarker.time / duration) * 100 : 0;
        const markerPx = (markerPercent / 100) * containerWidth;
        const halfBubble = bubbleWidth / 2;
        const marginPx = 14;
        const idealLeft = markerPx - halfBubble;
        const clampedLeft = Math.max(-marginPx, Math.min(containerWidth - bubbleWidth + marginPx, idealLeft));
        const notchPx = markerPx - clampedLeft;
        const notchPercent = bubbleWidth > 0 ? (notchPx / bubbleWidth) * 100 : 50;
        return {
            left: clampedLeft,
            notchPercent: Math.max(8, Math.min(92, notchPercent)),
        };
    });

    // Marker colors by type
    function getMarkerColor(marker: Marker): string {
        if (marker.color) return marker.color;
        switch (marker.type) {
            case "comment":
                return "text-sky-400";
            case "move":
                return "text-blue-400";
            case "pause":
                return "text-orange-500";
            case "like":
                return "text-rose-500";
            case "hide":
                return "text-blue-400";
            default:
                return "text-white";
        }
    }

    // Marker icons/symbols by type
    function getMarkerSymbol(type: Marker["type"]): string {
        switch (type) {
            case "comment":
                return "💬";
            case "move":
                return "◆";
            case "pause":
                return "⏸";
            case "like":
                return "❤️";
            case "hide":
                return "|";
            default:
                return "•";
        }
    }
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
                <div
                    class="relative w-full mb-2 h-8 z-40"
                    bind:this={bubbleContainerEl}
                    bind:clientWidth={containerWidth}
                >
                    <!-- Comment bubble positioned at marker -->
                    <div
                        bind:this={bubbleEl}
                        bind:clientWidth={bubbleWidth}
                        class="absolute bottom-0"
                        style="left: {bubblePosition.left}px;"
                    >
                        <div
                            class="relative bg-white/95 text-gray-800 text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
                        >
                            <div>{activeMarker.text}</div>
                            {#if activeMarker.username}
                                <div class="text-[10px] text-gray-500 font-medium mt-0.5">
                                    — {activeMarker.username}
                                </div>
                            {/if}
                            <!-- Notch pointing down at marker -->
                            <div
                                class="absolute top-full -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white/95"
                                style="left: {bubblePosition.notchPercent}%;"
                            ></div>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Progress Bar Container -->
            <div class="relative w-full h-6 flex items-center">
                <!-- Progress Bar Track -->
                <div
                    class="relative w-full h-1 bg-white/30 cursor-pointer rounded-full"
                    onclick={handleProgressClick}
                    onkeydown={(e) => {
                        if (e.key === "ArrowLeft") seekTo(currentTime - 5);
                        if (e.key === "ArrowRight") seekTo(currentTime + 5);
                    }}
                    role="slider"
                    aria-label="Video progress"
                    aria-valuenow={Math.round(progressPercent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    tabindex="0"
                >
                    <!-- Progress Fill -->
                    <div
                        class="absolute inset-y-0 left-0 bg-white rounded-full z-10"
                        style="width: {progressPercent}%;"
                    ></div>

                    <!-- Move Highlights -->
                    {#each moveSegments as seg}
                        <div
                            class="absolute top-1/2 -translate-y-1/2 bg-blue-400 rounded-full h-2"
                            style="left: {(seg.start / duration) * 100}%; width: {((seg.end - seg.start) / duration) *
                                100}%;"
                        >
                            {#if seg.text}
                                <span
                                    class="absolute bottom-full mb-1.5 left-0 text-[9px] text-white bg-black/50 px-1.5 py-0.5 rounded-[4px] font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full pointer-events-none backdrop-blur-[2px]"
                                >
                                    {seg.text}
                                </span>
                            {/if}
                        </div>
                    {/each}

                    <!-- Annotation Markers -->
                    {#each markers as marker (marker.id)}
                        {@const markerPercent = duration > 0 ? (marker.time / duration) * 100 : 0}
                        <button
                            type="button"
                            class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-sm cursor-pointer hover:scale-150 transition-transform z-20 drop-shadow-md {getMarkerColor(
                                marker,
                            )}"
                            style="left: {markerPercent}%;"
                            title="{marker.type}: {marker.text || formatTime(marker.time)}"
                            onclick={(e) => {
                                e.stopPropagation();
                                seekTo(marker.time);
                            }}
                        >
                            {getMarkerSymbol(marker.type)}
                        </button>
                    {/each}

                    <!-- Scrubber Thumb -->
                    <div
                        class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg z-30"
                        style="left: {progressPercent}%;"
                    ></div>
                </div>
            </div>

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

    <!-- Additional content slot (div3) - for comments, etc. -->
    {@render children?.()}
</div>
