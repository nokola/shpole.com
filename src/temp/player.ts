// types & config
export type MarkerType = "move" | "hide" | "comment" | "tip" | "pause" | "like";

export interface Marker {
	id: string;
	time: number;
	type: MarkerType;
	text?: string;
	username?: string;
}

export interface Segment {
	startTime: number;
	endTime: number;
	label: string;
	color: string;
}

export interface TypeConfig {
	color: string;
	icon: string;
	label: string;
	iconBg: string;
}

export const MOVE_COLORS = ["#6C8EEF", "#E86C8A", "#5CC9A7", "#E8A84C", "#B07CED"];

export const TYPE_CONFIG: Record<string, TypeConfig> = {
	move: { color: "#6C8EEF", icon: "M", label: "Move", iconBg: "#6C8EEF" },
	hide: { color: "#555", icon: "H", label: "Hidden", iconBg: "#555" },
	comment: { color: "#8B9DC3", icon: "💬", label: "Comment", iconBg: "#3A4A6B" },
	tip: { color: "#F0C040", icon: "💡", label: "Tip", iconBg: "#5C4A1A" },
	pause: { color: "#FF6B6B", icon: "⏸", label: "Pause", iconBg: "#5C2020" },
	like: { color: "#FF8C42", icon: "❤️", label: "Like", iconBg: "#5C3018" }
};

export const PX_PER_SEC = 40;

// Build move segments from marker list
export function buildSegments(markers: Marker[], duration: number): Segment[] {
	const sorted = [...markers].sort((a, b) => a.time - b.time);
	const segments: Segment[] = [];
	let colorIdx = 0;
	let current: Segment | null = null;

	for (const m of sorted) {
		if (m.type === "move") {
			if (current) segments.push({ ...current, endTime: m.time });
			current = {
				startTime: m.time,
				endTime: duration,
				label: m.text ?? "",
				color: MOVE_COLORS[colorIdx % MOVE_COLORS.length]
			};
			colorIdx++;
		} else if (m.type === "hide") {
			if (current) {
				segments.push({ ...current, endTime: m.time });
				current = null;
			}
		}
	}
	if (current) segments.push(current);
	return segments;
}

export function fmt(s: number): string {
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	const ms = Math.floor((s % 1) * 10);
	return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
}

export function fmtShort(s: number): string {
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}:${String(sec).padStart(2, "0")}`;
}

export function getSegmentAt(segments: Segment[], t: number): Segment | undefined {
	return segments.find((s) => t >= s.startTime && t < s.endTime);
}
