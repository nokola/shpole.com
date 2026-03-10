<script lang="ts">
	import { type Marker, type Segment, PX_PER_SEC, TYPE_CONFIG, fmt, fmtShort } from "./player";

	interface Props {
		duration: number;
		currentTime: number;
		markers: Marker[];
		segments: Segment[];
		onseek: (time: number) => void;
	}

	let { duration, currentTime, markers, segments, onseek }: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let containerW = $state(390);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartTime = 0;

	const totalPx = $derived(duration * PX_PER_SEC);
	const stripOffset = $derived((containerW / 2) - currentTime * PX_PER_SEC);

	const overlayMarkers = $derived(markers.filter((m) => m.type !== "move" && m.type !== "pause"));
	const pauseMarkers = $derived(markers.filter((m) => m.type === "pause"));

	// Ticks every 1s
	const ticks = $derived(Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i));

	// ResizeObserver
	$effect(() => {
		if (!containerEl) return;
		const ro = new ResizeObserver(([e]) => {
			containerW = e.contentRect.width;
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	function onpointerdown(e: PointerEvent) {
		dragging = true;
		dragStartX = e.clientX;
		dragStartTime = currentTime;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!dragging) return;
		const dx = dragStartX - e.clientX;
		const dt = dx / PX_PER_SEC;
		onseek(Math.max(0, Math.min(duration, dragStartTime + dt)));
	}

	function onpointerup() {
		dragging = false;
	}

	function isSegActive(seg: Segment): boolean {
		return currentTime >= seg.startTime && currentTime < seg.endTime;
	}

	function segProgress(seg: Segment): number {
		return ((currentTime - seg.startTime) / (seg.endTime - seg.startTime)) * 100;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={containerEl}
	class="relative w-full overflow-hidden select-none"
	class:cursor-grabbing={dragging}
	class:cursor-grab={!dragging}
	style="touch-action: none;"
	onpointerdown={onpointerdown}
	onpointermove={onpointermove}
	onpointerup={onpointerup}
	onpointercancel={onpointerup}
>
	<!-- Sliding strip -->
	<div
		class="relative"
		style="width: {totalPx}px; transform: translateX({stripOffset}px); transition: {dragging ? 'none' : 'transform 0.08s linear'};"
	>
		<!-- Row 1: Move labels -->
		<div class="relative h-[22px] mb-0.5">
			{#each segments as seg, i (i)}
				{@const left = seg.startTime * PX_PER_SEC}
				{@const width = (seg.endTime - seg.startTime) * PX_PER_SEC}
				{@const active = isSegActive(seg)}
				<div
					class="absolute top-0 h-[22px] flex items-center justify-center pointer-events-none"
					style="left: {left}px; width: {width}px;"
				>
					<span
						class="text-[10px] font-medium whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-200 px-2 py-0.5 rounded-[5px]"
						class:font-bold={active}
						style="
							max-width: {width - 4}px;
							color: {active ? '#fff' : 'rgba(255,255,255,0.45)'};
							background: {active ? seg.color + 'CC' : seg.color + '28'};
						"
					>
						{seg.label}
					</span>
				</div>
			{/each}
		</div>

		<!-- Row 2: Segment bar -->
		<div class="relative h-[30px] rounded-[5px]" style="background: rgba(255,255,255,0.04);">
			<!-- Colored segments -->
			{#each segments as seg, i (i)}
				{@const left = seg.startTime * PX_PER_SEC}
				{@const width = (seg.endTime - seg.startTime) * PX_PER_SEC}
				{@const active = isSegActive(seg)}
				<div
					class="absolute top-0 h-full rounded-[5px] overflow-hidden transition-colors duration-200"
					style="left: {left}px; width: {width}px; background: {seg.color}33;"
				>
					{#if active}
						<div
							class="absolute top-0 left-0 h-full"
							style="
								width: {segProgress(seg)}%;
								background: {seg.color}BB;
								transition: {dragging ? 'none' : 'width 0.08s linear'};
							"
						></div>
					{/if}
				</div>
			{/each}

			<!-- Pause markers: dashed stripe -->
			{#each pauseMarkers as m (m.id)}
				<div
					class="absolute top-0 w-[3px] h-full pointer-events-none z-[3]"
					style="
						left: {m.time * PX_PER_SEC - 1}px;
						background: repeating-linear-gradient(180deg, {TYPE_CONFIG.pause.color} 0px, {TYPE_CONFIG.pause.color} 3px, transparent 3px, transparent 6px);
					"
				></div>
			{/each}

			<!-- Overlay icons (comment, tip, like) -->
			{#each overlayMarkers as m (m.id)}
				{@const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.comment}
				<div
					class="absolute top-1/2 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] pointer-events-none z-[4] leading-none"
					style="
						left: {m.time * PX_PER_SEC}px;
						transform: translate(-50%, -50%);
						background: {cfg.iconBg};
						border: 1.5px solid {cfg.color};
					"
				>
					{cfg.icon}
				</div>
			{/each}

			<!-- Pause badge above bar -->
			{#each pauseMarkers as m (m.id)}
				<div
					class="absolute -top-[11px] text-[9px] font-bold whitespace-nowrap pointer-events-none z-[5] px-[5px] py-px rounded tracking-wide"
					style="
						left: {m.time * PX_PER_SEC}px;
						transform: translateX(-50%);
						background: {TYPE_CONFIG.pause.iconBg};
						border: 1.5px solid {TYPE_CONFIG.pause.color};
						color: {TYPE_CONFIG.pause.color};
					"
				>
					⏸ PAUSE
				</div>
			{/each}
		</div>

		<!-- Row 3: Ticks -->
		<div class="relative h-[18px] mt-[3px]">
			{#each ticks as t (t)}
				{@const isMajor = t % 5 === 0}
				<div
					class="absolute flex flex-col items-center"
					style="left: {t * PX_PER_SEC}px; transform: translateX(-50%);"
				>
					<div
						style="
							width: 1px;
							height: {isMajor ? 6 : 3}px;
							background: {isMajor ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'};
							margin-bottom: 1px;
						"
					></div>
					{#if isMajor}
						<span class="text-[8px] font-mono" style="color: rgba(255,255,255,0.28);">
							{fmtShort(t)}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Fixed center playhead -->
	<div class="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 z-10 pointer-events-none w-0">
		<!-- Vertical line -->
		<div
			class="absolute left-1/2 -translate-x-1/2 bottom-0 rounded-sm"
			style="top: 22px; width: 2px; background: #fff; box-shadow: 0 0 8px rgba(0,0,0,0.5);"
		></div>
		<!-- Triangle -->
		<div
			class="absolute left-1/2 -translate-x-1/2"
			style="
				top: 19px;
				width: 0; height: 0;
				border-left: 5px solid transparent;
				border-right: 5px solid transparent;
				border-top: 6px solid #fff;
				filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
			"
		></div>
	</div>

	<!-- Current time badge -->
	<div
		class="absolute left-1/2 top-0 -translate-x-1/2 z-[11] pointer-events-none whitespace-nowrap font-mono text-[10px] font-bold px-[7px] py-0.5 rounded"
		style="background: #fff; color: #1a1a2e; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"
	>
		{fmt(currentTime)}
	</div>
</div>
