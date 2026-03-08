// ─── Shared marker types and helpers ───

export interface Marker {
    id: string;
    time: number;
    type: "comment" | "move" | "pause" | "like" | "hide" | "tip";
    text?: string;
    color?: string;
    username?: string;
}

export interface MoveSegment {
    start: number;
    end: number;
    text: string | null;
}

/** Returns an emoji/symbol for the given marker type. */
export function getMarkerSymbol(type: Marker["type"]): string {
    switch (type) {
        case "comment":
            return "💬";
        case "move":
            return "◆";
        case "pause":
            return "⏸";
        case "like":
            return "❤️";
        case "hide":
            return "|";
        case "tip":
            return "💡";
        default:
            return "•";
    }
}

/** Returns a Tailwind text-color class for the given marker (used in class= contexts). */
export function getMarkerColorClass(marker: Marker): string {
    if (marker.color) return marker.color;
    switch (marker.type) {
        case "comment":
            return "text-sky-400";
        case "move":
            return "text-blue-400";
        case "pause":
            return "text-orange-500";
        case "like":
            return "text-rose-500";
        case "hide":
            return "text-blue-400";
        case "tip":
            return "text-amber-400";
        default:
            return "text-white";
    }
}
