# UI Design Patterns

This document outlines the recurring UI and UX patterns used across the Habits Social application to ensure a consistent experience.

## 1. Responsive Layout Phases
The application follows three distinct phases to adapt the layout density across devices:

| Phase | Breakpoint | Layout Behavior |
|-------|------------|-----------------|
| **Mobile** | `< 640px` (`base`) | **Full-Bleed**: Content extends to the viewport edges. Side borders and corner radii are zeroed out to maximize horizontal space. |
| **Tablet** | `≥ 640px` (`sm`) | **Contained**: Content is inset from the viewport edges with standard padding. Containers adopt full borders and a `24px` corner radius. |
| **Desktop** | `≥ 768px` (`md`) | **Multi-Column**: Complex layouts transition from vertical lists to multi-column grids. Item-level spacing and gaps are restored. |

## 2. Design System Tokens
To maintain a consistent aesthetic, follow these standardized visual patterns:

- **Full-Bleed Containers**: Use `rounded-none sm:rounded-2xl` and `border-x-0 sm:border`.
- **Interaction Layer**: Use `hover:bg-white/5` for interactive items to provide feedback without visual clutter.
- **Depth & Recess**: Use `bg-zinc-950` for recessed elements nested within `bg-zinc-925` surfaces to create a sense of depth.

## 3. Layout Constraints
The `default.vue` layout provides the foundational horizontal padding that drives these phases:
```html
<main class="w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8">
  <slot />
</main>
```
- `px-0`: Enables full-bleed on Mobile.
- `sm:px-6`: Insets the "Contained" layout on Tablet.
- `lg:px-8`: Increases white space on large Desktop displays.
