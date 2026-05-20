<template>
  <div class="min-h-screen bg-muted text-default">
    <header class="border-b border-default bg-default">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p class="text-sm font-medium text-primary">QRCC Data Center</p>
          <h1 class="text-xl font-semibold">FQMS & F-COST Workflow</h1>
        </div>
        <UBadge color="neutral" variant="subtle">Local-first MVP</UBadge>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <slot />
    </main>
  </div>
</template>
