<script lang="ts">
  import "../app.css";
  import { themeStore } from "$lib/stores";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    const unsub = themeStore.subscribe((t) => {
      if (typeof window !== "undefined") {
        document.documentElement.classList.toggle("dark", t === "dark");
      }
    });
    return unsub;
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

{@render children()}
