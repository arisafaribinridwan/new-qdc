<template>
  <UApp>
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p class="text-sm font-medium text-primary">QRCC Data Center</p>
            <h1 class="text-xl font-semibold">FQMS & F-COST Workflow</h1>
          </div>
          <UBadge color="neutral" variant="subtle">Local-first MVP</UBadge>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-6 py-8">
        <slot />
      </main>
    </div>
  </UApp>
</template>
