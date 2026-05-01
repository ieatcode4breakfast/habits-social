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
| **View Habit Details** | `app/pages/social.vue` | `showHabitModal` | View-only friend habit details & calendar. |
| **View Habit Details** | `app/pages/friends/[id].vue`| `showModal` | View-only friend habit details & calendar. |
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

### **Category C: Selection & Utility Modals**
*Specialized UI. Focus on lists, selection, or specific layout management.*

| Modal Name | File Location | Triggering State | Purpose |
|------------|---------------|------------------|---------|
| **Share Selection** | `app/pages/social.vue` | `showShareModal` | Batch selection of habits to share with a friend. |
| **Share Selection** | `app/pages/friends/[id].vue` | `showShareModal` | Batch selection of habits to share with a friend. |
| **Reorder Habits** | `app/pages/index.vue` | `showReorderModal` | Specialized drag-and-drop list for habit ordering. |

---

## 2. Standardized Implementation Patterns

To maintain a consistent experience, all modals must adhere to the following architectural rules:

### **Structural Requirements**
1.  **Teleportation**: All modals must use `<Teleport to="body">` to avoid Z-index issues and layout nesting constraints.
2.  **Transitions**: Use the standard `Transition` wrapper with `duration-300` for entry and `duration-200` for exit.
3.  **Backdrop**: Use `fixed inset-0 bg-black/80 backdrop-blur-md` for Entity modals, and `bg-black/90` for Confirmation modals to increase focus.

### **Navigation & Control**
1.  **Closing Behavior**: Modals should close when:
    *   The backdrop is clicked.
    *   The "Cancel" or "Close" button is clicked.
    *   The Browser "Back" button is pressed (managed via `useModalHistory`).
2.  **Back Button**: Primary Entity modals must include a `ChevronLeft` icon button in the header (aligned left) to dismiss the modal, ensuring consistency with native mobile app patterns.

### **Responsiveness**
*   **Mobile**: Modals should be full-screen (`h-full w-full`) with `rounded-none`.
*   **Desktop**: Modals should be centered cards (`h-auto max-w-md`) with `sm:rounded-3xl`.
