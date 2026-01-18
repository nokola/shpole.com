<script lang="ts">
    import { onMount, type Snippet } from "svelte";

    /**
     * A reusable dropdown component with open/close behavior.
     *
     * Props:
     * - open: bindable boolean to control open state externally
     * - closeOnSelect: if true, closes when child is clicked (default: false)
     * - align: 'left' | 'right' for dropdown alignment (default: 'left')
     * - disabled: disables the trigger button
     *
     * Slots:
     * - trigger: the button/element that toggles the dropdown
     * - default: the dropdown content
     */

    interface Props {
        open?: boolean;
        closeOnSelect?: boolean;
        align?: "left" | "right";
        disabled?: boolean;
        class?: string;
        children: Snippet;
        trigger: Snippet;
    }

    let {
        open = $bindable(false),
        closeOnSelect = false,
        align = "left",
        disabled = false,
        class: className = "",
        children,
        trigger,
    }: Props = $props();

    function toggle() {
        if (!disabled) {
            open = !open;
        }
    }

    function close() {
        open = false;
    }

    function handleContentClick() {
        if (closeOnSelect) {
            close();
        }
    }

    // Close on Escape key
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && open) {
            close();
        }
    }

    onMount(() => {
        document.addEventListener("keydown", handleKeydown);
        return () => {
            document.removeEventListener("keydown", handleKeydown);
        };
    });
</script>

<div class="dropdown-wrapper {className}">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dropdown-trigger" onclick={toggle}>
        {@render trigger()}
    </div>

    {#if open}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-backdrop" onclick={close}></div>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-content" class:align-right={align === "right"} onclick={handleContentClick}>
            {@render children()}
        </div>
    {/if}
</div>

<style>
    .dropdown-wrapper {
        position: relative;
        display: inline-block;
    }

    .dropdown-trigger {
        cursor: pointer;
    }

    .dropdown-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 99;
    }

    .dropdown-content {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 100;
        min-width: 160px;
        background: hsl(var(--shpole-surface));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 8px;
        box-shadow: 0 4px 12px hsl(0 0% 0% / 0.2);
        padding: 0.35rem;
    }

    .dropdown-content.align-right {
        left: auto;
        right: 0;
    }
</style>
