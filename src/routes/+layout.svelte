<script lang="ts">
  import "../app.css";
  import { authStore, themeStore, toastStore, isAuthenticated, needsUsername } from "$lib/stores";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  let theme = $state<"light" | "dark">("dark");
  let authenticated = $state(false);
  let usernameNeeded = $state(false);
  let user = $state<any>(null);
  let toasts = $state<Array<{ id: string; message: string; type: string }>>([]);

  $effect(() => {
    const unsubTheme = themeStore.subscribe((t) => (theme = t));
    const unsubAuth = isAuthenticated.subscribe((v) => (authenticated = v));
    const unsubUsername = needsUsername.subscribe((v) => (usernameNeeded = !!v));
    const unsubToast = toastStore.subscribe((t) => (toasts = t));
    const unsubUser = authStore.subscribe((state) => (user = state.user));

    return () => {
      unsubTheme();
      unsubAuth();
      unsubUsername();
      unsubToast();
      unsubUser();
    };
  });

  $effect(() => {
    // Username setup is optional now
  });

  function logout() {
    authStore.logout();
    userMenuOpen = false;
    goto("/");
  }

  let currentPath = $derived($page.url.pathname);
  let profilePath = $derived(user?.username ? `/u/${user.username}` : "/");

  // User menu dropdown state
  let userMenuOpen = $state(false);

  function toggleUserMenu() {
    userMenuOpen = !userMenuOpen;
  }

  function closeUserMenu() {
    userMenuOpen = false;
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <title>Shpole - Pole Dance Move Database</title>
  <meta
    name="description"
    content="A comprehensive database of pole dance moves with levels, requirements, and tutorials."
  />
</svelte:head>

<!-- Navigation -->
<nav>
  <div class="max-w-4xl px-4 mx-auto py-4">
    <div class="relative h-10">
      <!-- Centered logo (absolute to center on full screen) -->
      <a href="/" class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <img src="/shpole100.png" alt="Shpole" />
      </a>

      <!-- Navigation Links (positioned on the right) -->
      <div class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
        {#if authenticated}
          <!-- User Avatar Dropdown -->
          <div class="relative">
            <button
              class="w-9 h-9 rounded-full bg-linear-to-br from-[hsl(var(--shpole-primary))] to-[hsl(var(--shpole-secondary))] flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:ring-2 hover:ring-[hsl(var(--shpole-primary))] hover:ring-offset-2 hover:ring-offset-[hsl(var(--shpole-bg))]"
              onclick={toggleUserMenu}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
            >
              {user?.username?.charAt(0).toUpperCase() || "?"}
            </button>

            {#if userMenuOpen}
              <!-- Backdrop to close menu when clicking outside -->
              <button
                class="fixed inset-0 z-40 bg-transparent cursor-default"
                onclick={closeUserMenu}
                aria-label="Close menu"
              ></button>

              <!-- Dropdown Menu -->
              <div
                class="absolute right-0 top-12 z-50 w-56 rounded-lg border border-[hsl(var(--shpole-border))] bg-[hsl(var(--shpole-surface))] shadow-xl overflow-hidden"
              >
                <!-- User Info -->
                <div class="px-4 py-3 border-b border-[hsl(var(--shpole-border))]">
                  <p class="font-medium">@{user?.username}</p>
                  <p class="text-sm text-[hsl(var(--shpole-text-muted))] truncate">{user?.email}</p>
                </div>

                <!-- Menu Items -->
                <div class="py-2">
                  <!-- My Collections -->
                  <a
                    href={profilePath}
                    class="w-full px-4 py-2 flex items-center gap-3 hover:bg-[hsl(var(--shpole-bg-secondary))]"
                    onclick={closeUserMenu}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>My Profile</span>
                  </a>

                  <!-- Theme Toggle -->
                  <button
                    class="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[hsl(var(--shpole-bg-secondary))]"
                    onclick={() => {
                      themeStore.toggle();
                    }}
                  >
                    {#if theme === "dark"}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
                          x1="12"
                          y1="21"
                          x2="12"
                          y2="23"
                        /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
                          x1="18.36"
                          y1="18.36"
                          x2="19.78"
                          y2="19.78"
                        /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
                          x1="4.22"
                          y1="19.78"
                          x2="5.64"
                          y2="18.36"
                        /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      <span>Switch to Light Mode</span>
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                      <span>Switch to Dark Mode</span>
                    {/if}
                  </button>

                  <!-- Logout -->
                  <button
                    class="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-[hsl(var(--shpole-bg-secondary))] text-red-400"
                    onclick={logout}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line
                        x1="21"
                        y1="12"
                        x2="9"
                        y2="12"
                      />
                    </svg>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <a href="/login" class="btn btn-ghost btn-small">Login</a>
          <a href="/register" class="btn btn-primary btn-small">Get Started</a>
        {/if}
      </div>
    </div>
  </div>
</nav>

<!-- Main Content -->
<main class="min-h-screen">
  {@render children()}
</main>

<!-- Toast Notifications -->
{#each toasts as toast (toast.id)}
  <div
    class="toast"
    class:border-l-4={true}
    class:border-l-green-500={toast.type === "success"}
    class:border-l-red-500={toast.type === "error"}
    class:border-l-blue-500={toast.type === "info"}
  >
    {toast.message}
    <button
      class="ml-4 text-[hsl(var(--shpole-text-muted))] hover:text-[hsl(var(--shpole-text))]"
      onclick={() => toastStore.dismiss(toast.id)}
    >
      ✕
    </button>
  </div>
{/each}

<!-- Footer -->
<footer class="border-t border-[hsl(var(--shpole-border))] py-8 mt-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 text-center text-[hsl(var(--shpole-text-muted))]">
    <p class="mb-2">Made for pole dancers, by pole dancers 💜</p>
    <p class="text-sm">© 2025 Shpole. All rights reserved.</p>
  </div>
</footer>
