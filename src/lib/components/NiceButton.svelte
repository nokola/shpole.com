<script lang="ts">
    import { type Snippet } from "svelte";
    import type { HTMLButtonAttributes } from "svelte/elements";

    interface Props extends HTMLButtonAttributes {
        children: Snippet;
        isActive?: boolean;
        size?: "sm" | "md";
    }

    let { children, isActive = false, size = "md", class: className = "", ...rest }: Props = $props();

    let baseClass =
        "flex items-center cursor-pointer backdrop-blur-xl transition-all duration-200 active:scale-95 whitespace-nowrap border";

    let sizeClass = $derived(
        size === "sm"
            ? "gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] shadow-md shadow-black/50"
            : "gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold shadow-lg shadow-black/60",
    );

    let stateClass = $derived(
        isActive
            ? "bg-blue-600/20 border-blue-400/40 text-blue-300"
            : size === "sm"
              ? "bg-black/40 border-white/20 text-white/60 hover:bg-black/60 hover:border-white/30"
              : "bg-black/40 border-white/25 text-white hover:bg-black/50 hover:border-white/30",
    );
</script>

<button type="button" class="{baseClass} {sizeClass} {stateClass} {className}" {...rest}>
    {@render children()}
</button>
