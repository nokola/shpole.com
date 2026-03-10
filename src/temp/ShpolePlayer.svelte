<script lang="ts">
	import { type Marker, type MarkerType, TYPE_CONFIG, buildSegments, getSegmentAt } from "./player";
	import ScrollingTimeline from "./ScrollingTimeline.svelte";
	import MarkerListItem from "./MarkerListItem.svelte";

	interface Props {
		markers?: Marker[];
		duration?: number;
	}

	let { markers = defaultMarkers(), duration = 50.0 }: Props = $props();

	let currentTime = $state(0);
	let isPlaying = $state(false);
	let panelOpen = $state(true);
	let filterType = $state<"all" | MarkerType>("all");
	let playInterval: ReturnType<typeof setInterval> | null = null;

	const segments = $derived(buildSegments(markers, duration));
	const activeSegment = $derived(getSegmentAt(segments, currentTime));

	// Panel markers (no "hide")
	const panelMarkers = $derived.by(() => {
		const visible = markers.filter((m) => m.type !== "hide");
		if (filterType === "all") return visible;
		return visible.filter((m) => m.type === filterType);
	});

	// Counts per type
	const counts = $derived.by(() => {
		const c: Record<string, number> = { all: 0, move: 0, comment: 0, tip: 0, pause: 0, like: 0 };
		for (const m of markers) {
			if (m.type === "hide") continue;
			c.all++;
			if (c[m.type] !== undefined) c[m.type]++;
		}
		return c;
	});

	const FILTER_TABS: { key: "all" | MarkerType; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "move", label: "Moves" },
		{ key: "comment", label: "Comments" },
		{ key: "tip", label: "Tips" },
		{ key: "pause", label: "Pauses" },
		{ key: "like", label: "Likes" }
	];

	const visibleTabs = $derived(FILTER_TABS.filter((t) => counts[t.key] > 0));

	// Playback effect
	$effect(() => {
		if (isPlaying) {
			playInterval = setInterval(() => {
				currentTime += 0.1;
				if (currentTime >= duration) {
					currentTime = 0;
					isPlaying = false;
				}
			}, 100);
		}
		return () => {
			if (playInterval) clearInterval(playInterval);
		};
	});

	function seek(t: number) {
		currentTime = Math.max(0, Math.min(t, duration));
	}

	function togglePlay() {
		isPlaying = !isPlaying;
	}

	function togglePanel() {
		panelOpen = !panelOpen;
	}

	function setFilter(key: "all" | MarkerType) {
		filterType = key;
		if (!panelOpen) panelOpen = true;
	}

	function pillColor(key: string, isActive: boolean): string {
		const cfg = TYPE_CONFIG[key];
		if (!isActive) return "rgba(255,255,255,0.04)";
		if (key === "all") return "rgba(255,255,255,0.12)";
		return (cfg?.color ?? "#fff") + "30";
	}

	function pillBorder(key: string, isActive: boolean): string {
		const cfg = TYPE_CONFIG[key];
		if (!isActive) return "1px solid rgba(255,255,255,0.06)";
		if (key === "all") return "1px solid rgba(255,255,255,0.15)";
		return `1px solid ${(cfg?.color ?? "#fff")}55`;
	}

	function defaultMarkers(): Marker[] {
		return [
			{ id: "0", time: 0, type: "move", text: "Cup split grip" },
			{ id: "21", time: 1, type: "comment", text: "Nice transition!", username: "someone.poles" },
			{ id: "10", time: 3, type: "hide" },
			{ id: "1", time: 5.32, type: "move", text: "Layout (cup grip)" },
			{ id: "2", time: 15.12, type: "comment", text: "Nice transition!", username: "someone.poles" },
			{ id: "11", time: 17, type: "hide" },
			{ id: "3", time: 30.23, type: "pause", text: "Practice point: try to hold here" },
			{ id: "6", time: 35.5, type: "tip", text: "Tip: arch back", username: "nikola" },
			{ id: "4", time: 40.12, type: "like", text: "🔥", username: "sarah" },
			{ id: "5", time: 45.12, type: "comment", text: "bye", username: "nokola" }
		];
	}
</script>

<div class="w-full max-w-[420px] mx-auto rounded-[20px] overflow-hidden shadow-2xl" style="background: #111119;">
	<!-- Video area -->
	<div
		class="w-full relative overflow-hidden flex items-center justify-center"
		style="aspect-ratio: 9/13; background: linear-gradient(180deg, #221632 0%, #16101e 50%, #111119 100%);"
	>
		<!-- Fake pole -->
		<div
			class="absolute left-1/2 top-0 bottom-0 -translate-x-1/2"
			style="width: 2.5px; background: linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.06));"
		></div>

		<!-- Current move HUD -->
		{#if activeSegment}
			<div class="absolute bottom-3.5 left-3.5 right-3.5 flex items-center gap-[7px]">
				<div
					class="w-[7px] h-[7px] rounded-full shrink-0"
					style="background: {activeSegment.color}; box-shadow: 0 0 10px {activeSegment.color}88;"
				></div>
				<span class="text-[13px] font-semibold text-white" style="text-shadow: 0 2px 8px rgba(0,0,0,0.7);">
					{activeSegment.label}
				</span>
			</div>
		{/if}

		<!-- Play/Pause button -->
		<button
			class="absolute inset-0 bg-transparent border-none cursor-pointer flex items-center justify-center"
			onclick={togglePlay}
		>
			{#if !isPlaying}
				<div class="w-[52px] h-[52px] rounded-full flex items-center justify-center" style="background: rgba(0,0,0,0.4); backdrop-filter: blur(6px);">
					<svg width="20" height="24" viewBox="0 0 20 24" fill="none">
						<path d="M2 1L18 12L2 23V1Z" fill="white" />
					</svg>
				</div>
			{/if}
		</button>
	</div>

	<!-- Scrolling timeline -->
	<div class="pt-2.5 pb-0.5">
		<ScrollingTimeline
			{duration}
			{currentTime}
			{markers}
			{segments}
			onseek={seek}
		/>
	</div>

	<!-- Panel toggle + filter pills -->
	<div class="px-3.5 pt-1.5">
		<!-- Toggle header -->
		<button
			class="w-full flex items-center justify-between py-1.5 bg-transparent border-none cursor-pointer"
			onclick={togglePanel}
		>
			<span class="text-xs font-semibold" style="color: rgba(255,255,255,0.6);">
				Markers ({counts.all})
			</span>
			<svg
				width="14" height="14" viewBox="0 0 16 16" fill="none"
				class="transition-transform duration-200"
				class:rotate-180={panelOpen}
				style="opacity: 0.35;"
			>
				<path d="M4 6L8 10L12 6" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

		<!-- Filter pills -->
		{#if panelOpen}
			<div class="flex gap-1 pb-2 overflow-x-auto" style="scrollbar-width: none;">
				{#each visibleTabs as tab (tab.key)}
					{@const isActive = filterType === tab.key}
					<button
						class="text-[10px] font-semibold px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 transition-all duration-150"
						style="
							color: {isActive ? '#fff' : 'rgba(255,255,255,0.4)'};
							background: {pillColor(tab.key, isActive)};
							border: {pillBorder(tab.key, isActive)};
						"
						onclick={() => setFilter(tab.key)}
					>
						{tab.label}
						<span class="text-[9px] font-mono opacity-60">{counts[tab.key]}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Expandable panel -->
	<div
		class="overflow-hidden transition-all duration-300"
		style="max-height: {panelOpen ? '300px' : '0px'};"
	>
		<div class="px-3.5 pb-3.5 overflow-y-auto max-h-[284px] flex flex-col gap-[5px]">
			{#each panelMarkers as m (m.id)}
				{@const seg = segments.find((s) => s.label === m.text && s.startTime === m.time)}
				{@const isNearby = Math.abs(m.time - currentTime) < 2}
				<MarkerListItem
					marker={m}
					active={isNearby}
					segment={seg}
					onclick={() => seek(m.time)}
				/>
			{/each}

			{#if panelMarkers.length === 0}
				<div class="py-5 text-center text-xs" style="color: rgba(255,255,255,0.25);">
					No markers of this type
				</div>
			{/if}
		</div>
	</div>

	<div class="h-1.5"></div>
</div>
