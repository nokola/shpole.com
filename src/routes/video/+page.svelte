<script lang="ts">
    import VideoView from "$lib/components/VideoView.svelte";

    // Hard-coded sample video URL for testing
    // Using a freely available sample video
    const videoUrl = "/CupGripPencil.mp4";

    // Sample markers for testing
    let markers = $state([
        { id: "1", time: 5, type: "move" as const, text: "Opening pose" },
        { id: "2", time: 15, type: "comment" as const, text: "Nice transition!" },
        { id: "3", time: 30, type: "pause" as const },
        { id: "4", time: 45, type: "like" as const, text: "🔥" },
        { id: "5", time: 60, type: "move" as const, text: "Spin sequence" },
    ]);

    function handleMarkerAdd(marker: { id: string; time: number; type: string; text?: string }) {
        console.log("New marker added:", marker);
    }
</script>

<svelte:head>
    <title>Video Annotation Test | Shpole</title>
    <meta name="description" content="Test page for the video annotation component" />
</svelte:head>

<div class="h-dvh w-full">
    <VideoView {videoUrl} bind:markers onMarkerAdd={handleMarkerAdd} />
</div>
