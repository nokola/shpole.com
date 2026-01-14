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

<div class="min-h-screen flex justify-center py-3 px-4">
    <div class="w-full max-w-md">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold gradient-text mb-2">Sign In</h1>
        </div>

        <div class="card">
            <form onsubmit={handleLogin} class="space-y-6">
                {#if error}
                    <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                        {error}
                    </div>
                {/if}

                <div>
                    <label for="email" class="label">Email</label>
                    <input
                        type="email"
                        id="email"
                        class="input"
                        placeholder="you@example.com"
                        bind:value={email}
                        disabled={loading}
                    />
                </div>

                <div>
                    <label for="password" class="label">Password</label>
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

            <div class="mt-6 text-center">
                <p class="text-[hsl(var(--shpole-text-muted))]">
                    Don't have an account?
                    <a href="/register" class="font-medium">Sign up</a>
                </p>
            </div>
        </div>
    </div>
</div>
