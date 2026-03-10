<script lang="ts">
	import { type Marker, type Segment, TYPE_CONFIG, fmtShort } from "./player";

	interface Props {
		marker: Marker;
		active: boolean;
		segment?: Segment;
		onclick: () => void;
	}

	let { marker, active, segment, onclick }: Props = $props();

	const cfg = $derived(TYPE_CONFIG[marker.type] ?? TYPE_CONFIG.comment);
	const dotColor = $derived(segment?.color ?? cfg.color);
</script>

<button
	class="flex gap-2.5 p-2.5 rounded-[9px] cursor-pointer w-full text-left items-start transition-all duration-150"
	style="
		background: {active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.02)'};
		border: 1px solid {active ? cfg.color + '44' : 'rgba(255,255,255,0.05)'};
	"
	{onclick}
>
	<!-- Icon -->
	<div
		class="w-7 h-7 flex items-center justify-center shrink-0 leading-none"
		class:rounded-full={marker.type !== "pause"}
		class:rounded-md={marker.type === "pause"}
		style="
			background: {cfg.iconBg};
			border: 1.5px solid {cfg.color};
			font-size: {marker.type === 'like' ? '13px' : '12px'};
		"
	>
		{#if marker.type === "move"}
			<div class="w-2 h-2 rounded-full" style="background: {dotColor};"></div>
		{:else}
			{cfg.icon}
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-[5px] mb-0.5">
			<!-- Type badge -->
			<span
				class="text-[9px] font-bold uppercase tracking-wide"
				style="color: {cfg.color};"
			>
				{cfg.label}
			</span>
			<!-- Time -->
			<span class="text-[9px] font-mono font-semibold" style="color: rgba(255,255,255,0.3);">
				{fmtShort(marker.time)}
			</span>
			<!-- Username -->
			{#if marker.username}
				<span class="text-[9px] ml-auto" style="color: rgba(255,255,255,0.35);">
					@{marker.username}
				</span>
			{/if}
		</div>
		{#if marker.text}
			<p
				class="text-xs m-0 leading-snug"
				style="color: {active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'};"
			>
				{marker.text}
			</p>
		{/if}
	</div>
</button>
