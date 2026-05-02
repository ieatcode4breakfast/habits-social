# Modal Inventory & Architecture

This document tracks all modals implemented across the application and defines the standardized patterns for their behavior and structure.

## 1. Modal Taxonomy (Grouped by Similarity)

The application uses three primary categories of modals to handle different levels of complexity and user interaction.

### **Category A: Primary Entity Modals**
*High complexity. Feature headers with back buttons, scrollable content, and multiple interactive sections.*

| Modal Name | File Location | Triggering State | Purpose |
|------------|---------------|------------------|---------|
| **Add Habit** | `app/pages/index.vue` | `showModal` | Form to create a new habit. |
| **Edit Habit** | `app/pages/index.vue` | `showEditModal` | Comprehensive habit editor (title, desc, frequency, sharing). |
| **View Habit Details** | `app/components/HabitDetailsModal.vue` | (Component) | View-only friend habit details & calendar. |
| **Profile Modal** | `app/components/ProfileModal.vue`| (Component) | View/Edit own user profile details. |

### **Category B: Confirmation & Action Modals**
*Medium complexity. Centered cards with an icon, short message, and two primary action buttons (Confirm/Cancel).*

| Modal Name | File Location | Triggering State | Purpose |
|------------|---------------|------------------|---------|
| **Delete Habit** | `app/pages/index.vue` | `showDeleteModal` | Destructive action warning for habit removal. |
| **Unfriend User** | `app/pages/social.vue` | `showUnfriendModal` | Confirmation before removing a friend connection. |
| **Unfriend User** | `app/pages/friends/[id].vue` | `showUnfriendModal` | Confirmation before removing a friend connection. |
| **Add Friend** | `app/pages/social.vue` | `showAddModal` | Post-action success confirmation. |
| **Sharing Update** | `app/pages/index.vue` | `showSharingConfirmModal` | Confirmation for updating habit sharing settings. |
| **Cancel Friend Request** | `app/pages/friends/[id].vue` | `showCancelRequestModal` | Confirmation before cancelling a pending outgoing friend request. |

### **Category C: Selection & Utility Modals**
*Specialized UI. Focus on lists, selection, or specific layout management.*

| Modal Name | File Location | Triggering State | Purpose |
|------------|---------------|------------------|---------|
| **Share Selection** | `app/components/ShareHabitsModal.vue` | `showShareModal` | Batch selection of habits to share with a friend. |
| **Reorder Habits** | `app/pages/index.vue` | `showReorderModal` | Specialized drag-and-drop list for habit ordering. |
| **Avatar Selection** | `app/components/AvatarPicker.vue` | `showAvatarModal` | Avatar grid and refresh actions for profile customization. |

---

## 2. Standardized Implementation Patterns

To maintain a consistent experience, all modals must adhere to the following architectural rules:

### **Structural Requirements**
1.  **Teleportation**: All modals must use `<Teleport to="body">` to avoid Z-index issues and layout nesting constraints.
2.  **Transitions**: Use the standard `Transition` wrapper with `duration-300` for entry and `duration-200` for exit.
3.  **Backdrop**: Use `fixed inset-0 bg-black/80 backdrop-blur-md` for Entity modals, and `bg-black/90` for Confirmation modals to increase focus.
4.  **Sticky Headers (Category A)**: Headers in Primary Entity modals must be sticky (`sticky top-0 z-10 bg-zinc-925`) and separated from the scrollable body content.
5.  **Fixed Action Footers**: Bottom actions should be fixed in a footer (`bg-zinc-925/80 backdrop-blur-md border-t border-zinc-800`) to remain visible during scrolling.
6.  **Action Buttons**: Action buttons in the footer must use a consistent side-by-side flex layout (`flex gap-3`) with `flex-1` classes. Primary actions use solid white (`bg-white text-black`), while secondary/cancel actions use transparent backgrounds (`bg-transparent text-zinc-400`).

### **Navigation & Control**
1.  **Closing Behavior**: Modals should close when:
    *   The backdrop is clicked.
    *   The "Cancel" or "Close" button is clicked.
    *   The Browser "Back" button is pressed (managed via `useModalHistory`).
2.  **Back Button**: Primary Entity modals must include a `ChevronLeft` icon button in the header (aligned left) to dismiss the modal, ensuring consistency with native mobile app patterns.
3.  **Sticky Visibility**: By separating the header and using a sticky container, the title and navigation controls must remain visible regardless of the modal's internal scroll position.

### **Responsiveness**
*   **Mobile**: Category A modals should be full-screen (`h-full w-full`) with `rounded-none`. Body content must use `overflow-y-auto`.
*   **Desktop**: Modals should be centered cards (`h-auto max-w-md`) with `sm:rounded-3xl`.