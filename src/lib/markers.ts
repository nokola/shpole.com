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

export interface TypeConfig {
    color: string;
    icon: string;
    label: string;
    iconBg: string;
}

export const TYPE_CONFIG: Record<string, TypeConfig> = {
    move: { color: "#6C8EEF", icon: "M", label: "Move", iconBg: "#6C8EEF" },
    hide: { color: "#555", icon: "H", label: "Hidden", iconBg: "#555" },
    comment: { color: "#8B9DC3", icon: "💬", label: "Comment", iconBg: "#3A4A6B" },
    tip: { color: "#F0C040", icon: "💡", label: "Tip", iconBg: "#5C4A1A" },
    pause: { color: "#FF6B6B", icon: "⏸", label: "Pause", iconBg: "#5C2020" },
    like: { color: "#FF8C42", icon: "❤️", label: "Like", iconBg: "#5C3018" }
};

/** Returns an emoji/symbol for the given marker type. */
export function getMarkerSymbol(type: Marker["type"]): string {
    return TYPE_CONFIG[type]?.icon ?? TYPE_CONFIG.comment.icon;
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

