# Planview Design System

This document outlines the core design language for the Planview application, inspired by **Miro's Aura design language** (2025-2026). The design prioritizes **clarity, warmth, and minimal visual noise** using flat surfaces, subtle borders, and clean typography.

---

## 1. Design Philosophy

### 1.1 Clean & Functional
- **Flat surfaces** — no glassmorphism, no backdrop-filter blur
- **Minimal shadows** — nearly invisible, used only for spatial cues
- **Warm backgrounds** — off-white (#F5F5F5) in light, deep navy (#1A1A2E) in dark
- **Opaque panels** — solid white/dark surfaces, no transparency

### 1.2 Psychological Safety
- **Error Forgiveness** — actions are easily reversible
- **Non-Punitive Feedback** — empathetic, descriptive error states
- **Cognitive Load Reduction** — "Bento Box" modular layouts, progressive disclosure

---

## 2. Foundations

Built on CSS custom properties (in `globals.css`), Tailwind CSS v4, and **shadcn/ui** components.

### 2.1 Color Palette

| Token | Light | Dark |
|---|---|---|
| `--background` | `#f5f5f5` | `#1a1a2e` |
| `--surface` | `#ffffff` | `#252540` |
| `--surface-hover` | `#fafafa` | `#2e2e4a` |
| `--foreground` | `#1a1a2e` | `#f0f0f5` |
| `--text-muted` | `#6b7280` | `#a0a0b8` |
| `--accent` | `#4262ff` | `#6b84ff` |
| `--border` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.1)` |

**Status colors:** `--success` (#22c55e), `--warning` (#eab308), `--danger` (#ef4444)

### 2.2 Typography
- **Font:** Noto Sans (Google Fonts) — supports 800+ languages
- **Variable:** `--font-ui`
- **Weights:** 400 (body), 500 (labels), 600 (headings), 700 (emphasis)
- **Tracking:** Tight on headings (`-0.02em`), normal on body

### 2.3 Depth & Shadows
Shadows are nearly invisible — used only for spatial separation, never decorative.

| Token | Value |
|---|---|
| `--card-shadow` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--card-shadow-hover` | `0 2px 6px rgba(0,0,0,0.08)` |
| `--node-shadow` | `0 1px 2px rgba(0,0,0,0.05)` |

### 2.4 Border Radius
| Element | Radius |
|---|---|
| Containers/Modals | `12px` (`rounded-lg`) |
| Cards | `8px` (`rounded-lg`) |
| Inputs/Buttons | `6-8px` (`rounded-md` / `rounded-lg`) |

---

## 3. Interaction & Motion

- **Transitions:** `150ms ease` — subtle and quick, no spring physics
- **Focus:** `ring-3` with `--accent-soft` color
- **Active:** `scale(0.98)` on buttons
- **Modals:** `scale(0.98) → scale(1)` with `150ms` fade-in

---

## 4. Components & Layout

### 4.1 Base: shadcn/ui
All UI primitives built on Radix UI via shadcn/ui for accessibility. Never build raw `<button>`, `<dialog>`, or `<select>` from scratch.

### 4.2 Cards
White/dark surface, near-invisible shadow, thin border. "Bento Box" modular layouts for structured data.

### 4.3 Sidebar
Clean, flat navigation. No decorative cards or glassmorphism. Simple icon + label rows with flat hover states.

### 4.4 Toolbar
Compact horizontal groups with solid surface backgrounds and thin borders. No transparency or blur effects.

### 4.5 Forms
- shadcn/ui `<Form>`, `<Input>`, `<Label>` components
- Labels: `13px`, weight `600`, above input
- Focus: `3px` accent ring, no heavy glow