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
            /* add markers for:
Pole walk
Pirouettes
Bridge bodywave
Plie
Backslide
Carousel spin
Sexy standup
*/
            { id: "0", time: 7.6, end: 59, type: "move", text: "Beginner Heel Sequence" },

            // todo: add "gorgeous" comment at 53.3
            { id: "0.1", time: 53.2, type: "like", text: "😍😍😍" },

            { id: "1", time: 66, end: 146, type: "move", text: "Ankle warm-up" },
            { id: "1.1", time: 146, type: "pause", text: "Try now, then continue" },

            { id: "2", time: 149.8, end: 165, type: "move", text: "Pole walk" },
            { id: "2.1", time: 165, type: "pause", text: "Try now, then continue" },

            { id: "3", time: 169, end: 214, type: "move", text: "Pirouette" },
            // add "watch top hand" at 2:53.9
            { id: "3.01", time: 179, type: "tip", text: "Watch top hand" },

            { id: "3.1", time: 214, type: "pause", text: "Try now, then continue" },

            { id: "4", time: 234.8, end: 262, type: "move", text: "Bridge bodywave" },
            { id: "4.1", time: 262, type: "pause", text: "Try now, then continue" },

            // { id: "0", time: 0, end: 2, type: "move", text: "Pole walk" },
            // { id: "1", time: 1, type: "move", text: "Pirouettes" },
            // { id: "2", time: 2, type: "move", text: "Bridge bodywave" },
            // { id: "3", time: 3, type: "move", text: "Plie" },
            // { id: "4", time: 4, type: "move", text: "Backslide" },
            // { id: "5", time: 5, type: "move", text: "Carousel spin" },
            // { id: "6", time: 6, type: "move", text: "Sexy standup" },

            // { id: "0", time: 0, type: "move", text: "Cup split grip", end: 3 },
            // { id: "21", time: 1, type: "comment", text: "Nice transition!", username: "someone.poles" },
            // { id: "1", time: 5.32, type: "move", text: "Layout (cup grip)", end: 17 },
            // { id: "3", time: 30.23, type: "pause", text: "Practice point: try to hold here" },
            // { id: "6", time: 35.5, type: "tip", text: "Tip: arch back", username: "nikola" },
            // { id: "4", time: 40.12, type: "like", text: "🔥", username: "sarah" },
            // { id: "5", time: 45.12, type: "comment", text: "bye", username: "nokola" },
        ],
        cover: true,
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
