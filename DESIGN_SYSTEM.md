# Planview Design System

This document outlines the core design language, UI/UX philosophy, and technical foundations for the Planview application. The design system is engineered to provide a **"pixel-perfect," psychologically safe, and fluid** experience, blending modern B2B SaaS trends with human-centric consumer aesthetics. It is built strictly on the robust, accessible foundation of **shadcn/ui**.

---

## 1. Design Philosophy

Our interface is built on two intersecting pillars:

### 1.1 Fluid Interfaces
Interactions should feel like physical extensions of the user's intent. The UI must be:
- **Responsive:** Zero perceived latency. Immediate visual feedback upon interaction.
- **Interruptible:** Users can stop animations mid-transition (e.g., closing a modal while it opens).
- **Natural Motion:** Utilizing spring physics and ease-out curves instead of linear timing. Elements have "weight."
- **Glassmorphism (Liquid Glass):** Using blurred backgrounds (`backdrop-filter: blur(12px)`) and semi-transparent layers to establish spatial depth and hierarchy without overwhelming the user.

### 1.2 Psychological Safety
The UI must foster a "safe to explore" environment. Users should never feel penalized for mistakes.
- **Error Forgiveness:** Actions are easily reversible. Destructive actions require explicit, localized confirmation.
- **Non-Punitive Feedback:** Error states are descriptive, helpful, and emotionally neutral. Never use aggressive reds or harsh language.
- **Cognitive Load Reduction:** "Bento Box" modular layouts break complex data down. Progressive disclosure reveals advanced features only when needed.

---

## 2. Foundations

Our foundations rely on a robust set of CSS variables (mapped in `globals.css`), Tailwind CSS v4, and the **shadcn/ui** component architecture.

### 2.1 Color Palette (Adaptive Theming)
We use a semantic token system strictly aligned with `shadcn/ui` conventions, ensuring perfect contrast in both Light and Dark modes.

*   **Backgrounds:**
    *   `--background`: Base app background (`#09090b` Dark / `#ffffff` Light).
    *   `--surface` / `--panel-bg`: Elevated containers.
    *   `--glass-bg`: Semi-transparent overlays for depth (`rgba(9, 9, 11, 0.8)`).
*   **Foregrounds (Text):**
    *   `--foreground`: Primary text (`#fafafa` / `#09090b`).
    *   `--text-muted` / `--text-subtle`: Secondary/tertiary text for reducing visual noise.
*   **Accents:**
    *   `--accent`: Primary interactive color (High contrast).
    *   `--accent-soft`: Subtle interactive states (Hover/Focus rings).
*   **Status:**
    *   `--success`: `#22c55e`
    *   `--warning`: `#eab308`
    *   `--danger`: `#ef4444` (Used sparingly).

### 2.2 Typography
Clean, legible, and system-native.
*   **Font Family:** `-apple-system, BlinkMacSystemFont, "Inter", sans-serif`
*   **Hierarchy:** High contrast in weight (e.g., `600` for headers, `400` for body) rather than just size.
*   **Tracking:** Tighter letter spacing on headings (`tracking-tight` / `-0.01em`) for a premium SaaS feel.

### 2.3 Depth & Shadows
Shadows define elevation and interactiveness.
*   **Base Shadow:** `--card-shadow` for standard panels.
*   **Hover State:** `--card-shadow-hover` lifts the element slightly towards the user.
*   **Node Shadow:** `--node-shadow` creates deep physical separation for diagram elements on the canvas.

### 2.4 Border Radius
Softened corners convey approachability.
*   **Containers/Modals:** `16px` (`rounded-2xl`)
*   **Nodes/Cards:** `8px` (`rounded-lg` or `shadcn` defaults)
*   **Inputs/Buttons:** `8px` (`rounded-lg` or `shadcn` defaults)

---

## 3. Interaction & Motion

### 3.1 Focus & Active States
*   **Focus Rings:** Fully integrated with `shadcn/ui`'s `ring-offset` and `ring` utilities. All interactive elements must show a clear, predictable focus state for keyboard navigation.
*   **Active Scale:** Buttons should slightly scale down (`transform: scale(0.98)`) on `:active` to simulate physical button presses.

### 3.2 Key Animations
*   **Modal Slide-In:** Modals fade in and slightly scale up/translate from the bottom (`scale(0.96) translateY(-8px)` to `scale(1) translateY(0)`), creating a natural "arrival" effect.
*   **Node Pulse:** Important diagram nodes utilize a soft breathing shadow animation (`node-pulse`) to draw attention without aggressive blinking.

---

## 4. Components & Layout

### 4.1 Base Component Architecture: shadcn/ui
Planview relies entirely on **shadcn/ui** for its UI primitives. 
*   **Accessible by Default:** Built on top of Radix UI, `shadcn/ui` provides uncompromised keyboard navigation, ARIA attributes, and screen-reader support out of the box. This fulfills our core mandate of **Psychological Safety** by ensuring users always feel in control and the system behaves predictably.
*   **Ownership and Fluidity:** Because `shadcn/ui` components are copied into our workspace rather than installed as an opaque `node_module`, we have full power to inject our "Liquid Glass" and fluid animation styles directly into the component definitions.
*   **Usage Rule:** Never build a raw `<button>`, `<dialog>`, or `<select>` from scratch. Always utilize and extend the respective `shadcn/ui` components.

### 4.2 The "Bento Box" Layout
Interfaces should organize discrete pieces of information into distinct, rounded cards (using `shadcn/ui`'s `Card` component). This avoids the "spreadsheet" look of legacy enterprise software, making data scannable and reducing cognitive load.

### 4.3 Glass Panels & Toolbars
Floating toolbars and context menus use `--glass-bg` with a background blur. This ensures the user maintains context of the underlying canvas or data grid, promoting a feeling of continuous control.

### 4.4 Forms and Inputs
*   Leverage `shadcn/ui`'s `<Form>`, `<Input>`, and `<Label>` components.
*   **Labels:** Small (`13px`), bold (`600`), placed directly above the input.
*   **Toggles:** Use the `shadcn/ui` `Switch` component for immediate state feedback instead of native checkboxes.

---

## 5. Applying Psychological Safety in Planview

When building new features, ask:
1.  **Is the "Undo" clear?** (e.g., Can I easily delete a relationship I just drew in React Flow?)
2.  **Is the system state visible?** (e.g., Save status, current selected node, edge hover states).
3.  **Is the text empathetic?** (e.g., Instead of "Invalid Input," use "Please select a valid node type.")
4.  **Are we using shadcn/ui primitives?** (Ensuring we don't break accessibility or keyboard navigation).
5.  **Is there too much on screen?** (Hide advanced configuration inside edit modals or collapsible `shadcn/ui` Accordions rather than cluttering the canvas).