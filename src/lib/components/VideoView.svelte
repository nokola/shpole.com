<script lang="ts">
    import type { Snippet } from "svelte";

    // Props
    interface Props {
        videoUrl: string;
        markers?: Marker[];
        onMarkerAdd?: (marker: Marker) => void;
        children?: Snippet;
    }

    let { videoUrl, markers = $bindable([]), onMarkerAdd, children }: Props = $props();

    // Marker type
    interface Marker {
        id: string;
        time: number;
        type: "comment" | "move" | "pause" | "like";
        text?: string;
    }

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
        <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 to-transparent backdrop-blur-sm">
            <!-- Progress Bar -->
            <div
                class="relative h-1 bg-white/20 cursor-pointer mx-4 mt-3"
                onclick={handleProgressClick}
                role="slider"
                aria-label="Video progress"
                aria-valuenow={currentTime}
                aria-valuemin={0}
                aria-valuemax={duration}
                tabindex="0"
            >
                <!-- Progress Fill -->
                <div class="absolute inset-y-0 left-0 bg-[hsl(280_80%_55%)]" style="width: {progressPercent}%;"></div>
                <!-- Scrubber Thumb -->
                <div
                    class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
                    style="left: {progressPercent}%;"
                ></div>
            </div>

            <!-- Time + Controls Row -->
            <div class="flex items-center justify-between px-4 py-3">
                <!-- Time Display -->
                <div class="text-sm font-mono text-white/80">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                <!-- Playback Controls -->
                <div class="flex items-center gap-4">
                    <!-- Skip Back 10s -->
                    <button
                        type="button"
                        class="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                        onclick={skipBack}
                        aria-label="Skip back 10 seconds"
                    >
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path
                                d="M12.5 3C17.15 3 21.08 6.03 22.47 10.22L20.1 11C19.05 7.81 16.04 5.5 12.5 5.5C10.54 5.5 8.77 6.22 7.38 7.38L10 10H3V3L5.6 5.6C7.45 4 9.85 3 12.5 3M10 12L12.5 14.5L10 17V12M6 11.5V19H8V13.5L6 11.5Z"
                            />
                        </svg>
                    </button>

                    <!-- Play/Pause -->
                    <button
                        type="button"
                        class="w-14 h-14 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        onclick={togglePlay}
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {#if isPlaying}
                            <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                        {:else}
                            <svg class="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        {/if}
                    </button>

                    <!-- Skip Forward 10s -->
                    <button
                        type="button"
                        class="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                        onclick={skipForward}
                        aria-label="Skip forward 10 seconds"
                    >
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path
                                d="M11.5 3C6.85 3 2.92 6.03 1.53 10.22L3.9 11C4.95 7.81 7.96 5.5 11.5 5.5C13.46 5.5 15.23 6.22 16.62 7.38L14 10H21V3L18.4 5.6C16.55 4 14.15 3 11.5 3M14 12L11.5 14.5L14 17V12M18 11.5V19H16V13.5L18 11.5Z"
                            />
                        </svg>
                    </button>
                </div>

                <!-- Spacer to balance layout -->
                <div class="w-16"></div>
            </div>
        </div>
    </div>

    <!-- Additional content slot (div3) - for comments, etc. -->
    {@render children?.()}
</div>
