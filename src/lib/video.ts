async function extractThumbnails(
    src: string,
    count: number,
    width = 160
): Promise<string[]> {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.muted = true;

    await new Promise<void>((resolve) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });

    const height = Math.round(width * (video.videoHeight / video.videoWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    const thumbnails: string[] = [];
    const interval = video.duration / count;

    for (let i = 0; i < count; i++) {
        const time = i * interval + interval / 2;
        video.currentTime = time;

        await new Promise<void>((resolve) => {
            video.addEventListener("seeked", () => resolve(), { once: true });
        });

        ctx.drawImage(video, 0, 0, width, height);
        const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.7);
        });
        thumbnails.push(URL.createObjectURL(blob));
        // thumbnails.push(canvas.toDataURL("image/jpeg", 0.7));
    }

    return thumbnails; // array of data URLs
}

function releaseThumbnails(thumbnails: string[]) {
    thumbnails.forEach(URL.revokeObjectURL);
}

// for server-side thumbnail generation:
// ffmpeg -i input.mp4 -vf "fps=1/3,scale=160:-1,tile=10x1" -frames:v 1 thumbstrip.jpg