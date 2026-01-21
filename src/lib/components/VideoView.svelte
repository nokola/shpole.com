<script lang="ts">
    import type { Snippet } from "svelte";

    // Marker type
    interface Marker {
        id: string;
        time: number;
        type: "comment" | "move" | "pause" | "like";
        text?: string;
    }

    // Props
    interface Props {
        videoUrl: string;
        markers?: Marker[];
        onMarkerAdd?: (marker: Marker) => void;
        children?: Snippet;
    }

    let { videoUrl, markers = $bindable([]), onMarkerAdd, children }: Props = $props();

    // State
    let videoEl: HTMLVideoElement | null = $state(null);
    let currentTime = $state(0);
    let duration = $state(0);
    let isPlaying = $state(false);

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
        if (!videoEl) return;
        currentTime = videoEl.currentTime;
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

    // Find active marker (within 1 second of current time)
    let activeMarker = $derived(markers.find((m) => m.text && Math.abs(m.time - currentTime) < 1) || null);

    // Marker colors by type
    function getMarkerColor(type: Marker["type"]): string {
        switch (type) {
            case "comment":
                return "bg-sky-400";
            case "move":
                return "bg-violet-500";
            case "pause":
                return "bg-amber-400";
            case "like":
                return "bg-rose-500";
            default:
                return "bg-white";
        }
    }

    // Marker icons/symbols by type
    function getMarkerSymbol(type: Marker["type"]): string {
        switch (type) {
            case "comment":
                return "💬";
            case "move":
                return "🎯";
            case "pause":
                return "⏸";
            case "like":
                return "❤️";
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

        <!-- Controls - overlaid at bottom of video section -->
        <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-4 pb-4 pt-8">
            <!-- Active Marker Comment Bubble -->
            {#if activeMarker}
                {@const markerPercent = duration > 0 ? (activeMarker.time / duration) * 100 : 0}
                <div class="relative w-full mb-2">
                    <!-- Comment bubble positioned at marker -->
                    <div
                        class="absolute bottom-0 -translate-x-1/2 max-w-[80%] min-w-0"
                        style="left: clamp(10%, {markerPercent}%, 90%);"
                    >
                        <div
                            class="relative bg-white/95 text-gray-800 text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
                        >
                            {activeMarker.text}
                            <!-- Notch pointing down -->
                            <div
                                class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white/95"
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
                        class="absolute inset-y-0 left-0 bg-white rounded-full"
                        style="width: {progressPercent}%;"
                    ></div>

                    <!-- Annotation Markers -->
                    {#each markers as marker (marker.id)}
                        {@const markerPercent = duration > 0 ? (marker.time / duration) * 100 : 0}
                        <button
                            type="button"
                            class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-sm cursor-pointer hover:scale-150 transition-transform z-10 drop-shadow-md"
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
                        class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg z-20"
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
                    aria-label="Add annotation"
                >
                    Add Annotation
                </button>
            </div>
        </div>
    </div>

    <!-- Additional content slot (div3) - for comments, etc. -->
    {@render children?.()}
</div>
