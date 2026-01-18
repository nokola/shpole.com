<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { moves as movesApi, type MoveDetail } from "$lib/api";
    import { authStore, toastStore, currentUser } from "$lib/stores";

    let slug = $derived((page.params as { moveSlug: string }).moveSlug);

    let loading = $state(true);
    let saving = $state(false);
    let error = $state<string | null>(null);

    let moveData = $state<any>(null);
    let names = $state<Array<{ MoveName: string; Source: string }>>([]);
    let moveTypes = $state<Array<{ Id: number; Name: string }>>([]);
    let allMoves = $state<Array<{ Id: number; PdcName: string | null; ShpoleName: string }>>([]);

    onMount(async () => {
        // Redirect if not authorized
        // if ($currentUser?.role !== "moderator" && $currentUser?.role !== "admin") {
        //     goto(`/m/${slug}`);
        //     return;
        // }

        try {
            const [moveRes, typesRes, listRes] = await Promise.all([
                movesApi.get(slug),
                movesApi.getTypes(),
                movesApi.getSimpleList(),
            ]);

            moveData = { ...moveRes.move };
            names = (moveRes.names || []).map((n) => ({ MoveName: n.MoveName, Source: n.Source || "online" }));
            moveTypes = typesRes.types;
            allMoves = listRes.moves;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load data";
        } finally {
            loading = false;
        }
    });

    function addName() {
        names = [...names, { MoveName: "", Source: "online" }];
    }

    function removeName(index: number) {
        names = names.filter((_, i) => i !== index);
    }

    async function handleSave() {
        if (!moveData || saving) return;

        saving = true;
        try {
            const token = $authStore.token;
            if (!token) throw new Error("Not authenticated");

            // Ensure ShpoleName is always included in the names list as source: online (and first)
            const filteredNames = names.filter(
                (n) => n.MoveName && n.MoveName.toLowerCase() !== moveData.ShpoleName.toLowerCase(),
            );
            const finalNames = moveData.ShpoleName
                ? [{ MoveName: moveData.ShpoleName, Source: "online" }, ...filteredNames]
                : filteredNames;

            await movesApi.update(
                moveData.Id,
                {
                    ...moveData,
                    names: finalNames,
                },
                token,
            );

            toastStore.show("Move updated successfully", "success");
            goto(`/m/${slug}`);
        } catch (e) {
            toastStore.show(e instanceof Error ? e.message : "Failed to update move", "error");
        } finally {
            saving = false;
        }
    }

    const levels = [1, 2, 3, 4, 5, 6];
    const shpoleLevels = [1, 2, 3, 4, 5];
    const starRatings = [1, 2, 3, 4, 5];
</script>

<svelte:head>
    <title>Edit {moveData?.PdcName || "Move"} - Shpole</title>
</svelte:head>

<div class="edit-page">
    {#if loading}
        <div class="loading">Loading move data...</div>
    {:else if error}
        <div class="error">{error}</div>
        <a href="/m/{slug}" class="back-link">← Back to move</a>
    {:else}
        <header class="edit-header">
            <a href="/m/{slug}" class="back-link">← Cancel</a>
            <h1>Edit Move</h1>
        </header>

        <form
            onsubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
            class="edit-form"
        >
            <!-- Primary Info -->
            <section class="form-section">
                <h2>Primary Information</h2>
                <div class="grid-2">
                    <div class="field">
                        <label for="shpoleName">Official Name (Shpole)</label>
                        <input type="text" id="shpoleName" bind:value={moveData.ShpoleName} placeholder="e.g. Jade" />
                    </div>
                    <div class="field">
                        <label for="pdcName">PDC Name</label>
                        <input type="text" id="pdcName" bind:value={moveData.PdcName} placeholder="e.g. Jade Split" />
                    </div>
                    <div class="field">
                        <label for="moveType">Move Type</label>
                        <select id="moveType" bind:value={moveData.MoveTypeId}>
                            <option value={null}>Select Type...</option>
                            {#each moveTypes as type}
                                <option value={type.Id}>{type.Name}</option>
                            {/each}
                        </select>
                    </div>
                </div>
            </section>

            <!-- Also Known As -->
            <section class="form-section">
                <h2>Alternative Names</h2>
                <div class="names-list">
                    {#each names as name, i}
                        <div class="name-row">
                            <input type="text" bind:value={name.MoveName} placeholder="Alternative name" />
                            <select bind:value={name.Source}>
                                <option value="online">Online/Common</option>
                                <option value="pdc">PDC</option>
                                <option value="ipsf">IPSF</option>
                                <option value="posa">POSA</option>
                            </select>
                            <button
                                type="button"
                                class="remove-btn"
                                onclick={() => removeName(i)}
                                aria-label="Remove name">×</button
                            >
                        </div>
                    {/each}
                    <button type="button" class="add-btn" onclick={addName}>+ Add Name</button>
                </div>
            </section>

            <!-- Requirements -->
            <section class="form-section">
                <h2>Requirements & Levels</h2>
                <div class="grid-reqs">
                    <div class="field">
                        <label for="shpoleLevel">Shpole Level</label>
                        <div class="radio-group">
                            {#each shpoleLevels as l}
                                <label class="radio-item" class:selected={moveData.ShpoleLevel === l}>
                                    <input
                                        type="radio"
                                        name="shpoleLevel"
                                        value={l}
                                        bind:group={moveData.ShpoleLevel}
                                    />
                                    {l}
                                </label>
                            {/each}
                        </div>
                    </div>
                    <div class="field">
                        <label for="pdcLevel">PDC Level (1-6)</label>
                        <select id="pdcLevel" bind:value={moveData.PdcLevel}>
                            <option value={null}>None</option>
                            {#each levels as l}
                                <option value={l}>Level {l}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <div class="grid-stars">
                    <div class="field">
                        <span class="field-label">Strength</span>
                        <div class="star-rating">
                            {#each starRatings as r}
                                <button
                                    type="button"
                                    class="star"
                                    class:active={moveData.StrengthReq >= r}
                                    onclick={() => (moveData.StrengthReq = r)}>★</button
                                >
                            {/each}
                        </div>
                    </div>
                    <div class="field">
                        <span class="field-label">Flexibility</span>
                        <div class="star-rating">
                            {#each starRatings as r}
                                <button
                                    type="button"
                                    class="star"
                                    class:active={moveData.FlexibilityReq >= r}
                                    onclick={() => (moveData.FlexibilityReq = r)}>★</button
                                >
                            {/each}
                        </div>
                    </div>
                    <div class="field">
                        <span class="field-label">Technique</span>
                        <div class="star-rating">
                            {#each starRatings as r}
                                <button
                                    type="button"
                                    class="star"
                                    class:active={moveData.TechniqueReq >= r}
                                    onclick={() => (moveData.TechniqueReq = r)}>★</button
                                >
                            {/each}
                        </div>
                    </div>
                </div>
            </section>

            <!-- Competition Data -->
            <section class="form-section">
                <h2>Competition Data</h2>
                <div class="grid-2">
                    <div class="field">
                        <label for="ipsfCode">IPSF Code</label>
                        <input type="text" id="ipsfCode" bind:value={moveData.IpsfCode} placeholder="e.g. F12" />
                    </div>
                    <div class="field">
                        <label for="posaCode">POSA Code</label>
                        <input type="text" id="posaCode" bind:value={moveData.PosaCode} />
                    </div>
                    <div class="field">
                        <label for="ipsfName">IPSF Name</label>
                        <input type="text" id="ipsfName" bind:value={moveData.IpsfName} />
                    </div>
                    <div class="field">
                        <label for="posaName">POSA Name</label>
                        <input type="text" id="posaName" bind:value={moveData.PosaName} />
                    </div>
                </div>
            </section>

            <!-- Content & Classification -->
            <section class="form-section">
                <h2>Content & Classification</h2>
                <div class="field">
                    <label for="info">Description / Info (Markdown)</label>
                    <textarea
                        id="info"
                        bind:value={moveData.Info}
                        rows="5"
                        placeholder="Detailed description of the move..."
                    ></textarea>
                </div>
                <div class="grid-2">
                    <div class="field">
                        <label for="gripType">Grip Reference</label>
                        <select id="gripType" bind:value={moveData.GripTypeId}>
                            <option value={null}>None</option>
                            {#each allMoves as m}
                                {#if m.Id !== moveData.Id}
                                    <option value={m.Id}>{m.ShpoleName}</option>
                                {/if}
                            {/each}
                        </select>
                    </div>
                    <div class="field checkbox-field">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                checked={!!moveData.IsInvert}
                                onchange={(e) => (moveData.IsInvert = e.currentTarget.checked ? 1 : 0)}
                            />
                            Is Inverted Move?
                        </label>
                    </div>
                </div>
                <div class="field">
                    <label for="thumb">Thumbnail URL (IPFS or direct)</label>
                    <input type="text" id="thumb" bind:value={moveData.ThumbnailUrl} placeholder="ipfs://..." />
                </div>
                <div class="field">
                    <label for="status">Verification Status</label>
                    <select id="status" bind:value={moveData.Status}>
                        <option value={0}>Draft</option>
                        <option value={1}>Reviewing</option>
                        <option value={2}>Verified</option>
                    </select>
                </div>
            </section>

            <div class="actions">
                <button type="submit" class="save-btn" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    {/if}
</div>

<style>
    .edit-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .edit-header {
        margin-bottom: 2rem;
    }

    .edit-header h1 {
        font-size: 2rem;
        font-weight: 800;
        margin-top: 0.5rem;
    }

    .back-link {
        color: hsl(var(--shpole-text-muted));
        text-decoration: none;
        font-size: 0.9rem;
    }

    .back-link:hover {
        color: hsl(var(--shpole-primary));
    }

    .edit-form {
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
    }

    .form-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        background: hsl(var(--shpole-surface));
        padding: 1.5rem;
        border-radius: 1rem;
        border: 1px solid hsl(var(--shpole-border));
    }

    .form-section h2 {
        font-size: 1.1rem;
        font-weight: 700;
        color: hsl(var(--shpole-primary));
        margin: 0;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .field label,
    .field-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: hsl(var(--shpole-text-muted));
    }

    input[type="text"],
    select,
    textarea {
        background: hsl(var(--shpole-bg-secondary));
        border: 1px solid hsl(var(--shpole-border));
        padding: 0.75rem;
        border-radius: 0.5rem;
        color: hsl(var(--shpole-text));
        font-family: inherit;
        font-size: 0.95rem;
    }

    input:focus,
    select:focus,
    textarea:focus {
        outline: none;
        border-color: hsl(var(--shpole-primary));
        box-shadow: 0 0 0 2px hsla(var(--shpole-primary), 0.2);
    }

    .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .grid-reqs {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1.5rem;
    }

    .radio-group {
        display: flex;
        gap: 0.5rem;
    }

    .radio-item {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 40px;
        background: hsl(var(--shpole-bg-secondary));
        border: 1px solid hsl(var(--shpole-border));
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }

    .radio-item input {
        display: none;
    }

    .radio-item.selected {
        background: hsl(var(--shpole-primary));
        color: white;
        border-color: transparent;
    }

    .grid-stars {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }

    .star-rating {
        display: flex;
        gap: 0.25rem;
    }

    .star {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: hsl(var(--shpole-border));
        cursor: pointer;
        padding: 0;
        transition: color 0.1s;
    }

    .star.active {
        color: hsl(var(--shpole-primary));
    }

    .name-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .add-btn {
        background: none;
        border: 1px dashed hsl(var(--shpole-border));
        color: hsl(var(--shpole-primary));
        padding: 0.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 500;
        font-size: 0.9rem;
    }

    .add-btn:hover {
        background: hsla(var(--shpole-primary), 0.05);
        border-style: solid;
    }

    .remove-btn {
        background: hsla(0, 70%, 50%, 0.1);
        color: hsl(0, 70%, 50%);
        border: none;
        width: 38px;
        border-radius: 0.5rem;
        font-size: 1.25rem;
        cursor: pointer;
    }

    .checkbox-field {
        justify-content: center;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.95rem;
        color: hsl(var(--shpole-text));
    }

    .checkbox-label input {
        width: 20px;
        height: 20px;
        accent-color: hsl(var(--shpole-primary));
    }

    .actions {
        margin-top: 1rem;
        margin-bottom: 4rem;
    }

    .save-btn {
        width: 100%;
        background: hsl(var(--shpole-primary));
        color: white;
        border: none;
        padding: 1rem;
        border-radius: 0.75rem;
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 12px hsla(var(--shpole-primary), 0.3);
        transition: all 0.2s;
    }

    .save-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px hsla(var(--shpole-primary), 0.4);
    }

    .save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    @media (max-width: 600px) {
        .grid-2,
        .grid-reqs,
        .grid-stars {
            grid-template-columns: 1fr;
        }
    }
</style>
