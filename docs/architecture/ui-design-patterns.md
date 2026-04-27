# UI Design Patterns

This document outlines the recurring UI and UX patterns used across the Habits Social application to ensure a consistent experience.

## 1. Full-Bleed Mobile Cards
To maximize horizontal real estate on small devices, main content containers transition from a "contained card" on desktop to a "full-bleed" layout on mobile.

### Behavior
- **Breakpoint:** `sm` (640px)
- **Mobile (< 640px):** Containers stretch to the edge of the viewport. Side borders are removed, and corner radii are zeroed out.
- **Desktop (≥ 640px):** Containers become "cards" with internal padding from the main layout, full borders, and a `24px` (`rounded-2xl`) corner radius.

### Implementation Pattern (Tailwind)
When creating a new major content section, use the following class pattern:
```html
<div class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none border-y border-x-0 sm:border border-zinc-800/80 shadow-2xl">
  <!-- Content -->
</div>
```

### Layout Constraints
The `default.vue` layout supports this by removing horizontal padding on mobile:
```html
<main class="w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8">
  <slot />
</main>
```
