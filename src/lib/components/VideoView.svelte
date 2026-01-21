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
    }

    function handleLoadedMetadata() {
        if (!videoEl) return;
        duration = videoEl.duration;
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
</script>

<!-- Outer scrollable container (div1) -->
<div class="w-full">
    <!-- Video + Controls section - exactly viewport height (div2) -->
    <div class="relative w-full h-dvh bg-black text-white">
        <!-- Video - fills entire section -->
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

        <!-- Tap to play/pause overlay -->
        <button
            type="button"
            class="absolute inset-0 cursor-pointer"
            onclick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
        ></button>

        <!-- Controls - overlaid at bottom of video section -->
        <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-4 pb-4 pt-8">
            <!-- Progress Bar -->
            <button
                type="button"
                class="relative w-full h-1 bg-white/30 cursor-pointer rounded-full"
                onclick={handleProgressClick}
                aria-label="Video progress: {formatTime(currentTime)} of {formatTime(duration)}"
            >
                <!-- Progress Fill -->
                <div class="absolute inset-y-0 left-0 bg-white rounded-full" style="width: {progressPercent}%;"></div>
                <!-- Scrubber Thumb -->
                <div
                    class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
                    style="left: {progressPercent}%;"
                ></div>
            </button>

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
