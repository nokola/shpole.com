<script lang="ts">
    import type { Marker } from "$lib/markers";

    interface Props {
        moves: Marker[];
        progress: number;
        isDragging: boolean;
        onSeek: (time: number) => void;
    }

    let { moves, progress, isDragging, onSeek }: Props = $props();

    // Format time as MM:SS
    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
</script>

<!-- 
    The container height is driven strictly by progress.
    We use opacity and visibility to hide it when closed.
-->
<div
    class="relative w-full bg-linear-to-b from-[#111118] to-[#0a0a0f] rounded-t-[20px] overflow-hidden z-5"
    style="height: {progress * 55}dvh;
           opacity: {progress > 0.01 ? 1 : 0};
           visibility: {progress > 0.01 ? 'visible' : 'hidden'};
           pointer-events: {progress > 0.1 ? 'auto' : 'none'};
           transition: {!isDragging ? 'height 450ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms' : 'none'};"
>
    <!-- Border handled as an absolute line to avoid layout shifts -->
    {#if progress > 0}
        <div class="absolute top-0 left-0 right-0 h-px bg-white/8 z-10"></div>
    {/if}

    <!-- Content area with internal padding that doesn't affect container height -->
    <div class="w-full h-full overflow-y-auto px-5 pt-8 pb-10">
        <!-- Drag indicator - simplified -->
        <div class="absolute top-3 left-1/2 -translate-x-1/2 w-9 h-1 bg-white/15 rounded-full"></div>

        <h3 class="text-white/45 text-[11px] font-semibold uppercase tracking-[1.5px] mb-4">In this video</h3>

        <div class="flex flex-col gap-2">
            {#each moves as move, i}
                <button
                    type="button"
                    class="flex items-center gap-3 bg-white/4 border border-white/6 rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:bg-white/8 text-left w-full active:scale-[0.98]"
                    onclick={() => onSeek(move.time)}
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
