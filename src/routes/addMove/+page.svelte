<script lang="ts">
    import { authStore, isAuthenticated } from "$lib/stores";
    import { moves as movesApi } from "$lib/api";
    import { onMount } from "svelte";

    let name = $state("");
    let videoUrl = $state("");
    let level = $state<number | null>(null);
    let loading = $state(false);
    let error = $state<string | null>(null);
    let success = $state(false);

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (!name || !videoUrl) {
            error = "Name and Video URL are required";
            return;
        }

        loading = true;
        error = null;

        try {
            const token = $authStore.token;
            if (!token) throw new Error("Not signed in");

            await movesApi.create(
                {
                    ShpoleName: name,
                    ShpoleLevel: level ?? undefined,
                    videoUrl: videoUrl,
                },
                token,
            );

            success = true;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to add move";
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        if (!$isAuthenticated) {
            // Redirect to login if not authenticated
            window.location.href = "/login?redirect=/addMove";
        }
    });
</script>

<svelte:head>
    <title>Add New Move - Shpole</title>
</svelte:head>

<div class="add-move-page px-4 py-8">
    <div class="max-w-md mx-auto">
        {#if success}
            <div class="success-message">
                <h2>✓ Move submitted!</h2>
                <p>
                    Your move is now in <strong>"Community Drafts"</strong> and will be reviewed by moderators. You'll be
                    notified when it's verified.
                </p>
                <div class="mt-8">
                    <a href="/" class="back-home-btn">Back to Home</a>
                </div>
            </div>
        {:else}
            <h1>Add New Move</h1>

            <form onsubmit={handleSubmit} class="add-move-form">
                {#if error}
                    <div class="error-box">{error}</div>
                {/if}

                <div class="form-group">
                    <label for="name">Move Name <span class="required">*</span></label>
                    <input
                        type="text"
                        id="name"
                        bind:value={name}
                        placeholder="e.g. Jade Split"
                        required
                        disabled={loading}
                    />
                </div>

                <div class="form-group">
                    <label for="video">Video URL <span class="required">*</span></label>
                    <input
                        type="url"
                        id="video"
                        bind:value={videoUrl}
                        placeholder="e.g. https://www.instagram.com/p/..."
                        required
                        disabled={loading}
                    />
                    <p class="hint">No video = no proof it exists!</p>
                </div>

                <div class="form-group">
                    <span class="field-label">Estimated Level (Optional)</span>
                    <div class="level-pips">
                        {#each [1, 2, 3, 4, 5] as l}
                            <button
                                type="button"
                                class="level-pip"
                                class:active={level === l}
                                onclick={() => (level = level === l ? null : l)}
                                disabled={loading}
                            >
                                {l}
                            </button>
                        {/each}
                    </div>
                </div>

                <button type="submit" class="submit-btn" disabled={loading}>
                    {loading ? "Submitting..." : "Add Move"}
                </button>
            </form>
        {/if}
    </div>
</div>

<style>
    .add-move-page {
        background: hsl(var(--shpole-bg));
        min-height: 100vh;
    }

    h1 {
        font-size: 2rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
        color: hsl(var(--shpole-text));
    }

    .add-move-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    label,
    .field-label {
        font-weight: 600;
        font-size: 0.9rem;
        color: hsl(var(--shpole-text));
    }

    .required {
        color: hsl(0, 70%, 60%);
    }

    input {
        padding: 0.75rem;
        border-radius: 8px;
        border: 1px solid hsl(var(--shpole-border));
        background: hsl(var(--shpole-surface));
        color: hsl(var(--shpole-text));
        font-size: 1rem;
        outline: none;
    }

    input:focus {
        border-color: hsl(var(--shpole-primary));
    }

    input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .hint {
        font-size: 0.8rem;
        color: hsl(var(--shpole-text-muted));
        font-style: italic;
    }

    .level-pips {
        display: flex;
        gap: 0.5rem;
    }

    .level-pip {
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: 1px solid hsl(var(--shpole-border));
        background: hsl(var(--shpole-surface));
        color: hsl(var(--shpole-text-muted));
        cursor: pointer;
        font-weight: 700;
    }

    .level-pip:hover:not(:disabled) {
        border-color: hsl(var(--shpole-primary));
        color: hsl(var(--shpole-primary));
    }

    .level-pip.active {
        background: hsl(var(--shpole-primary));
        color: hsl(var(--shpole-bg));
        border-color: hsl(var(--shpole-primary));
    }

    .submit-btn {
        margin-top: 1rem;
        padding: 1rem;
        background: hsl(var(--shpole-primary));
        color: hsl(var(--shpole-bg));
        border: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 1.1rem;
        cursor: pointer;
    }

    .submit-btn:hover:not(:disabled) {
        opacity: 0.9;
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .error-box {
        padding: 0.75rem;
        background: hsl(0, 70%, 95%);
        color: hsl(0, 70%, 40%);
        border: 1px solid hsl(0, 70%, 90%);
        border-radius: 8px;
        font-size: 0.9rem;
    }

    .success-message {
        text-align: center;
        padding: 2rem;
        background: hsl(var(--shpole-surface));
        border-radius: 12px;
        border: 1px solid hsl(var(--shpole-border));
    }

    .success-message h2 {
        color: #22c55e;
        margin-bottom: 1rem;
    }

    .success-message p {
        line-height: 1.6;
        color: hsl(var(--shpole-text));
    }

    .back-home-btn {
        display: inline-block;
        padding: 0.8rem 1.5rem;
        background: hsl(var(--shpole-primary));
        color: hsl(var(--shpole-bg));
        text-decoration: none;
        font-weight: 700;
        border-radius: 8px;
    }
</style>
