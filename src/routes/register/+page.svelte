<script lang="ts">
    import { auth } from "$lib/api";
    import { authStore, toastStore } from "$lib/stores";
    import { goto } from "$app/navigation";

    let email = $state("");
    let password = $state("");
    let confirmPassword = $state("");
    let loading = $state(false);
    let error = $state("");

    async function handleRegister(e: Event) {
        e.preventDefault();

        if (!email || !password) {
            error = "Please enter both email and password";
            return;
        }

        if (password !== confirmPassword) {
            error = "Passwords do not match";
            return;
        }

        if (password.length < 6) {
            error = "Password must be at least 6 characters";
            return;
        }

        loading = true;
        error = "";

        try {
            const { user, token } = await auth.register(email, password);
            authStore.login(user, token);
            toastStore.show("Account created!", "success");
            goto("/");
        } catch (err: any) {
            error = err.message || "Registration failed";
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen flex justify-center px-4">
    <div class="w-full max-w-md">
        <div class="text-center mb-4">
            <h1 class="text-2xl font-bold">Join🥳</h1>
        </div>

        <div class="card">
            <form onsubmit={handleRegister} class="space-y-3">
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
                        placeholder="At least 6 characters"
                        bind:value={password}
                        disabled={loading}
                    />
                </div>

                <div class="form-row">
                    <label for="confirmPassword" class="label-inline">Confirm</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        class="input"
                        placeholder="••••••••"
                        bind:value={confirmPassword}
                        disabled={loading}
                    />
                </div>

                <button type="submit" class="btn btn-primary w-full" disabled={loading}>
                    {#if loading}
                        <div class="spinner"></div>
                    {:else}
                        Create Account
                    {/if}
                </button>
            </form>

            <div class="mt-4 text-center">
                <p class="text-sm text-[hsl(var(--shpole-text-muted))]">
                    Already have an account?
                    <a href="/login" class="text-[hsl(var(--shpole-primary))] hover:underline">Sign in</a>
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
