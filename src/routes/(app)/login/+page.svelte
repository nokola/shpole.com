<script lang="ts">
    import { auth } from "$lib/api";
    import { authStore, toastStore } from "$lib/stores";
    import { goto } from "$app/navigation";

    let email = $state("");
    let password = $state("");
    let loading = $state(false);
    let error = $state("");

    async function handleLogin(e: Event) {
        e.preventDefault();

        if (!email || !password) {
            error = "Please enter both email and password";
            return;
        }

        loading = true;
        error = "";

        try {
            const { user, token } = await auth.login(email, password);
            authStore.login(user, token);
            toastStore.show("Welcome back!", "success");

            if (!user.username) {
                goto("/");
            } else {
                goto(`/u/${user.username}`);
            }
        } catch (err: any) {
            error = err.message || "Login failed";
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen flex justify-center px-4">
    <div class="w-full max-w-md">
        <div class="text-center mb-4">
            <h1 class="text-2xl font-bold">Sign In</h1>
        </div>

        <div class="card">
            <form onsubmit={handleLogin} class="space-y-3">
                {#if error}
                    <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {error}
                    </div>
                {/if}

                <div class="form-row">
                    <label for="email" class="label-inline">Email</label>
                    <input
                        type="email"
                        id="email"
                        class="input"
                        placeholder="you@example.com"
                        bind:value={email}
                        disabled={loading}
                    />
                </div>

                <div class="form-row">
                    <label for="password" class="label-inline">Password</label>
                    <input
                        type="password"
                        id="password"
                        class="input"
                        placeholder="••••••••"
                        bind:value={password}
                        disabled={loading}
                    />
                </div>

                <button type="submit" class="btn btn-primary w-full" disabled={loading}>
                    {#if loading}
                        <div class="spinner"></div>
                    {:else}
                        Sign In
                    {/if}
                </button>
            </form>

            <div class="mt-4 text-center">
                <p class="text-sm text-[hsl(var(--shpole-text-muted))]">
                    Don't have an account?
                    <a href="/register" class="font-medium">Sign up</a>
                </p>
            </div>
        </div>
    </div>
</div>

<style>
    .form-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .label-inline {
        min-width: 5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: hsl(var(--shpole-text));
        flex-shrink: 0;
    }

    .form-row .input {
        flex: 1;
    }
</style>
