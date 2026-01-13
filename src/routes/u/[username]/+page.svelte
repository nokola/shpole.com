<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { contributors } from "$lib/api";

    interface ContributorData {
        user: {
            username: string;
            createdDate: string;
        };
        stats: {
            movesContributed: number;
            namesContributed: number;
        };
    }

    let data = $state<ContributorData | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    onMount(async () => {
        try {
            const username = (page.params as { username: string }).username;
            data = await contributors.get(username);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load user";
        } finally {
            loading = false;
        }
    });
</script>

<svelte:head>
    <title>{data?.user?.username || "Contributor"} - Shpole</title>
    <meta name="description" content="Contributor profile on Shpole" />
</svelte:head>

<div class="user-page">
    {#if loading}
        <div class="loading">Loading...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else if data}
        <a href="/" class="back-link">← Back to moves</a>

        <header class="user-header">
            <div class="avatar">
                {data.user.username.charAt(0).toUpperCase()}
            </div>
            <h1>{data.user.username}</h1>
        </header>

        <section class="info-section">
            <div class="info-item">
                <span class="label">Member since</span>
                <span class="value">{formatDate(data.user.createdDate)}</span>
            </div>
        </section>

        <section class="stats-section">
            <h2>Contributions</h2>
            <div class="stats">
                <div class="stat">
                    <span class="stat-value">{data.stats.movesContributed}</span>
                    <span class="stat-label">Moves</span>
                </div>
                <div class="stat">
                    <span class="stat-value">{data.stats.namesContributed}</span>
                    <span class="stat-label">Move Names</span>
                </div>
            </div>
        </section>
    {/if}
</div>

<style>
    .user-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .back-link {
        display: inline-block;
        color: hsl(var(--shpole-text-muted));
        text-decoration: none;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
    }

    .back-link:hover {
        color: hsl(var(--shpole-primary));
    }

    .loading,
    .error {
        text-align: center;
        padding: 3rem;
        color: hsl(var(--shpole-text-muted));
    }

    .error {
        color: hsl(0, 70%, 60%);
    }

    .user-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, hsl(var(--shpole-primary)), hsl(var(--shpole-secondary, 280 70% 50%)));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: 700;
        color: white;
    }

    .user-header h1 {
        font-size: 2rem;
        font-weight: 700;
        margin: 0;
        color: hsl(var(--shpole-text));
    }

    .info-section {
        margin-bottom: 2rem;
        padding: 1rem;
        background: hsl(var(--shpole-bg-secondary));
        border-radius: 0.5rem;
    }

    .info-item {
        display: flex;
        justify-content: space-between;
    }

    .label {
        color: hsl(var(--shpole-text-muted));
    }

    .value {
        color: hsl(var(--shpole-text));
        font-weight: 500;
    }

    .stats-section h2 {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: hsl(var(--shpole-text-muted));
        margin: 0 0 1rem 0;
    }

    .stats {
        display: flex;
        gap: 2rem;
    }

    .stat {
        display: flex;
        flex-direction: column;
    }

    .stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: hsl(var(--shpole-text));
    }

    .stat-label {
        font-size: 0.85rem;
        color: hsl(var(--shpole-text-muted));
    }
</style>
