<script lang="ts">
    import VideoView from "$lib/components/VideoView.svelte";
    import type { VideoInfo } from "$lib/video";

    const videoMeix: VideoInfo = {
        id: "meix",
        title: "Beginner Heels Elements",
        description: "Description",
        url: "/Meix_final_small.mp4",
        thumbnail: "/Meix_final_small.jpg",
        duration: 474.261924,
        markers: [
            { id: "0", time: 0, type: "move" as const, text: "Cup split grip" },
            { id: "21", time: 1, type: "comment" as const, text: "Nice transition!", username: "someone.poles" },
            { id: "10", time: 3, type: "hide" as const },
            { id: "1", time: 5.32, type: "move" as const, text: "Layout (cup grip)" },
            { id: "2", time: 15.12, type: "comment" as const, text: "Nice transition!", username: "someone.poles" },
            { id: "11", time: 17, type: "hide" as const },
            { id: "3", time: 30.23, type: "pause" as const, text: "Practice point: try to hold here" },
            { id: "6", time: 35.5, type: "tip" as const, text: "Tip: arch back", username: "nikola" },
            { id: "4", time: 40.12, type: "like" as const, text: "🔥", username: "sarah" },
            { id: "5", time: 45.12, type: "comment" as const, text: "bye", username: "nokola" },
        ],
        cover: false,
    };

    function handleMarkerAdd(marker: { id: string; time: number; type: string; text?: string }) {
        console.log("New marker added:", marker);
    }
</script>

<svelte:head>
    <title>Video Annotation Test | Shpole</title>
    <meta name="description" content="Test page for the video annotation component" />
</svelte:head>

<div class="fixed inset-0 w-screen h-dvh">
    <!-- <VideoView {videoUrl} duration={45.138186} bind:markers onMarkerAdd={handleMarkerAdd} /> -->
    <VideoView
        videoUrl={videoMeix.url}
        duration={videoMeix.duration}
        markers={videoMeix.markers}
        cover={videoMeix.cover}
        onMarkerAdd={handleMarkerAdd}
    />
</div>
