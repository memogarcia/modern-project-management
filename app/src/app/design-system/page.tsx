"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Boxes,
  CheckCircle2,
  CircleHelp,
  Component,
  FileStack,
  PaintBucket,
  Plus,
  Sparkles,
  SwatchBook,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ShapeIcon from "@/components/ShapeIcon";
import { SHAPE_REGISTRY, type ShapeDefinition } from "@/lib/types";

type Token = {
  name: string;
  value: string;
  description: string;
};

type TokenGroup = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  tokens: Token[];
};

const tokenGroups: TokenGroup[] = [
  {
    title: "Core surfaces",
    icon: SwatchBook,
    description: "Foundational fills and borders that shape the workspace shell and cards.",
    tokens: [
      { name: "--background", value: "var(--background)", description: "Page atmosphere and app backdrop." },
      { name: "--surface", value: "var(--surface)", description: "Default raised surface for cards and controls." },
      { name: "--surface-hover", value: "var(--surface-hover)", description: "Hover state for quiet interactive surfaces." },
      { name: "--panel-bg", value: "var(--panel-bg)", description: "Glass panel fill used for docked chrome." },
      { name: "--panel-border", value: "var(--panel-border)", description: "Subtle edge for translucent containers." },
      { name: "--border", value: "var(--border)", description: "General purpose separator and stroke color." },
    ],
  },
  {
    title: "Brand and feedback",
    icon: PaintBucket,
    description: "Action and status colors used for emphasis, selection, and trust signals.",
    tokens: [
      { name: "--accent", value: "var(--accent)", description: "Primary action and active navigation color." },
      {
        name: "--accent-soft",
        value: "var(--accent-soft)",
        description: "Soft accent wash for focus rings and selected surfaces.",
      },
      {
        name: "--accent-foreground",
        value: "var(--accent-foreground)",
        description: "Foreground color used on top of accent fills.",
      },
      { name: "--success", value: "var(--success)", description: "Positive state and healthy system messaging." },
      { name: "--warning", value: "var(--warning)", description: "Cautionary state for attention-required content." },
      { name: "--danger", value: "var(--danger)", description: "Destructive actions and failure states." },
    ],
  },
  {
    title: "Typography and supporting tones",
    icon: FileStack,
    description: "Readable text hierarchy tuned for dense tooling interfaces.",
    tokens: [
      { name: "--foreground", value: "var(--foreground)", description: "Primary readable text color." },
      { name: "--text-muted", value: "var(--text-muted)", description: "Secondary text for explanations and metadata." },
      { name: "--text-subtle", value: "var(--text-subtle)", description: "Low-contrast helper copy and passive affordances." },
      { name: "--input-bg", value: "var(--input-bg)", description: "Input field background for editable controls." },
      { name: "--input-border", value: "var(--input-border)", description: "Default text field stroke." },
      { name: "--glass-border", value: "var(--glass-border)", description: "Border tone for blurred glass surfaces." },
    ],
  },
];

const typeScale = [
  { label: "Hero", className: "text-5xl font-semibold tracking-[-0.05em]" },
  { label: "Section", className: "text-3xl font-semibold tracking-[-0.04em]" },
  { label: "Title", className: "text-xl font-semibold tracking-[-0.03em]" },
  { label: "Body", className: "text-sm leading-6 text-[var(--text-muted)]" },
  { label: "Meta", className: "text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-subtle)]" },
];

const shapeSamples: ShapeDefinition[] = [
  SHAPE_REGISTRY.service,
  SHAPE_REGISTRY.gateway,
  SHAPE_REGISTRY.database,
  SHAPE_REGISTRY.queue,
  SHAPE_REGISTRY.cache,
  SHAPE_REGISTRY.container,
];

const edgeSamples = [
  {
    title: "Default dependency",
    description: "The editor defaults to a smooth step connector with a closed arrow marker.",
    stroke: "var(--edge-color)",
    width: 2,
    dashed: false,
    animated: false,
    label: "HTTPS",
  },
  {
    title: "Active trace",
    description: "Use motion sparingly to show a live path, retry loop, or traffic replay.",
    stroke: "var(--accent)",
    width: 2.4,
    dashed: false,
    animated: true,
    label: "stream",
  },
  {
    title: "Risk or degraded path",
    description: "Escalation or unstable dependencies can layer warning color and a dashed stroke.",
    stroke: "var(--warning)",
    width: 2.2,
    dashed: true,
    animated: false,
    label: "timeout risk",
  },
];

function TokenSwatch({ token }: { token: Token }) {
  const isTransparent =
    token.value.includes("soft") || token.value.includes("panel") || token.value.includes("glass");

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_72%,transparent)] p-4 shadow-[var(--card-shadow)]">
      <div
        className="h-24 rounded-[18px] border border-white/40"
        style={{
          background: isTransparent
            ? `linear-gradient(135deg, ${token.value}, color-mix(in srgb, ${token.value} 60%, var(--surface) 40%))`
            : token.value,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
        }}
      />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--foreground)]">{token.name}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{token.description}</div>
        </div>
        <code className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
          {token.name.replace("--", "")}
        </code>
      </div>
    </div>
  );
}

function NodePreviewCard({ shape }: { shape: ShapeDefinition }) {
  const isPill = shape.mermaidShape === "stadium";
  const isDatabase = shape.mermaidShape === "cylinder";
  const isDiamond = shape.mermaidShape === "diamond";
  const radius = isPill ? "999px" : isDatabase ? "18px 18px 28px 28px" : isDiamond ? "22px" : "18px";

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
      <div
        className="min-h-[124px] border p-4"
        style={{
          borderRadius: radius,
          borderColor: shape.borderColor,
          background: `linear-gradient(180deg, color-mix(in srgb, ${shape.color} 76%, white) 0%, color-mix(in srgb, ${shape.color} 48%, white) 100%)`,
          boxShadow: "var(--node-shadow)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: shape.borderColor, color: "white" }}
          >
            <ShapeIcon type={shape.type} size={18} color="currentColor" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">{shape.label}</div>
            <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{shape.description}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span>{shape.defaultWidth} × {shape.defaultHeight}</span>
        <code className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold">{shape.mermaidShape}</code>
      </div>
    </div>
  );
}

function EdgePreview({ title, description, stroke, width, dashed, animated, label }: (typeof edgeSamples)[number]) {
  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-[var(--foreground)]">{title}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</div>
      </div>
      <div className="rounded-[18px] border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-hover)_70%,transparent)] px-4 py-6">
        <svg viewBox="0 0 320 80" className="h-20 w-full overflow-visible">
          <defs>
            <marker id={`arrow-${title}`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
            </marker>
          </defs>
          <circle cx="24" cy="40" r="6" fill={stroke} opacity="0.2" />
          <circle cx="294" cy="40" r="6" fill={stroke} opacity="0.2" />
          <path
            d="M30 40 C 92 12, 228 68, 290 40"
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeDasharray={dashed ? "8 7" : undefined}
            markerEnd={`url(#arrow-${title})`}
            className={animated ? "design-system-edge-dash" : undefined}
            strokeLinecap="round"
          />
          <rect
            x="128"
            y="24"
            width="64"
            height="20"
            rx="10"
            fill="var(--surface)"
            stroke="var(--border)"
          />
          <text x="160" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-muted)">
            {label}
          </text>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{animated ? "Animated" : "Static"}</Badge>
        <Badge variant="outline">{dashed ? "Dashed" : "Solid"}</Badge>
        <Badge variant="outline">{width.toFixed(1)}px</Badge>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [compactMode, setCompactMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="workspace-page overflow-y-auto">
      <div className="relative isolate px-6 py-8 md:px-10 md:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px] bg-[radial-gradient(circle_at_top_left,rgba(66,98,255,0.24),transparent_38%),radial-gradient(circle_at_top_right,rgba(59,180,255,0.18),transparent_28%)]" />

        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <section className="overflow-hidden rounded-[32px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--card-shadow)] backdrop-blur-2xl md:p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] lg:items-end">
              <div className="space-y-5">
                <Badge className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.24em]" variant="outline">
                  PlanView design system
                </Badge>
                <div className="max-w-3xl space-y-4">
                  <h1 className="text-4xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
                    Tokens, components, and interaction patterns for the diagram workspace.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] md:text-lg">
                    This page turns the current visual language into a usable reference: color tokens, type rhythm,
                    control states, and composed patterns that should guide future UI work.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="#components">
                      Explore components
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Open principles</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>System principles</DialogTitle>
                        <DialogDescription>
                          Build from the existing token vocabulary, keep surfaces readable, and use accent color as a
                          deliberate signal instead of decoration.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 text-sm text-[var(--text-muted)]">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          Favor translucent panels for workspace chrome and solid surfaces for task-focused content.
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          Keep typography dense but calm: strong titles, muted metadata, short paragraphs.
                        </div>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          Reserve destructive red for true risk states; let blue remain the primary navigation cue.
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="secondary">Close</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="grid gap-4">
                <Card className="overflow-hidden border-[var(--glass-border)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--surface)_85%,transparent),color-mix(in_srgb,var(--accent-soft)_65%,var(--surface)_35%))]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                      Composition snapshot
                    </CardTitle>
                    <CardDescription>How tokens and components combine into a focused control cluster.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="flex items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div>
                        <div className="text-sm font-semibold">Incident digest</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">8 linked nodes, 3 unresolved edges</div>
                      </div>
                      <Badge color="var(--warning)">Needs review</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="secondary" className="justify-start">
                        <Boxes className="mr-2 h-4 w-4" />
                        Inspect layout
                      </Button>
                      <Button variant="outline" className="justify-start">
                        <Bookmark className="mr-2 h-4 w-4" />
                        Save pattern
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <PaintBucket className="h-5 w-5 text-[var(--accent)]" />
                  Color and surface tokens
                </CardTitle>
                <CardDescription>
                  Tokens are grouped by intent so future screens can reuse the same visual semantics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {tokenGroups.map((group) => {
                  const Icon = group.icon;

                  return (
                    <div key={group.title} className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--accent-soft)] text-[var(--accent)]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold tracking-[-0.03em]">{group.title}</h2>
                          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{group.description}</p>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {group.tokens.map((token) => (
                          <TokenSwatch key={token.name} token={token} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Component className="h-5 w-5 text-[var(--accent)]" />
                    Typography rhythm
                  </CardTitle>
                  <CardDescription>Use strong tracking on display text and muted copy for dense support detail.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {typeScale.map((sample) => (
                    <div key={sample.label} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-subtle)]">
                        {sample.label}
                      </div>
                      <div className={sample.className}>Design decisions should stay obvious under pressure.</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Usage notes</CardTitle>
                  <CardDescription>Short rules to keep additions visually aligned with the current product.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-[var(--text-muted)]">
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
                    Use glass surfaces for navigation, inspectors, and framing chrome.
                  </div>
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
                    Use solid cards when the user is editing, reviewing, or making a decision.
                  </div>
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
                    Keep accent density low. One strong blue region per cluster is usually enough.
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.95fr)]">
            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Boxes className="h-5 w-5 text-[var(--accent)]" />
                  Nodes
                </CardTitle>
                <CardDescription>
                  The canvas uses a consistent node grammar: icon badge, strong title, muted support text, and shape
                  semantics tied to the registry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {shapeSamples.map((shape) => (
                    <NodePreviewCard key={shape.type} shape={shape} />
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                  <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="mb-4 text-base font-semibold">Special node patterns</div>
                    <div className="grid gap-4">
                      <div className="rounded-[24px] border border-dashed border-[color:rgba(66,98,255,0.42)] bg-[color:rgba(66,98,255,0.08)] p-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(66,98,255,0.24)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-semibold">
                          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                          Group container
                        </div>
                        <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
                          Use groups to define boundaries such as regions, domains, or incident scopes. Keep them soft
                          and dashed so they frame content instead of competing with it.
                        </p>
                      </div>

                      <div className="rounded-[18px] border border-transparent bg-[rgba(255,241,184,0.88)] px-4 py-3 shadow-[var(--node-shadow)]">
                        <div className="text-sm leading-6 text-[var(--foreground)]">
                          Text nodes are annotations. They should stay lightweight and editorial, not masquerade as systems.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="mb-4 text-base font-semibold">Database schema node</div>
                    <div className="overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--accent)_18%,var(--border))] shadow-[var(--node-shadow)]">
                      <div className="flex items-center gap-3 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_92%,white)_0%,var(--accent)_100%)] px-4 py-3 text-white">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                          <ShapeIcon type="database" size={16} color="currentColor" />
                        </div>
                        <span className="text-sm font-semibold">incident_events</span>
                      </div>
                      <div className="divide-y divide-[color:color-mix(in_srgb,var(--accent)_12%,var(--border))]">
                        {[
                          ["PK", "event_id", "uuid", "#e58f12"],
                          ["FK", "session_id", "uuid", "#4262ff"],
                          ["N", "received_at", "timestamp", "#6b7280"],
                        ].map(([badge, name, type, color], index) => (
                          <div
                            key={name}
                            className="flex items-center gap-3 px-4 py-3"
                            style={{
                              background:
                                index % 2 === 0
                                  ? "color-mix(in srgb, var(--accent) 3%, var(--surface-raised))"
                                  : "var(--surface-raised)",
                            }}
                          >
                            <span
                              className="rounded-full px-2 py-1 text-[9px] font-extrabold tracking-[0.08em] text-white"
                              style={{ background: color }}
                            >
                              {badge}
                            </span>
                            <span className="flex-1 text-sm font-medium">{name}</span>
                            <span className="font-mono text-[11px] text-[var(--text-muted)]">{type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ArrowRight className="h-5 w-5 text-[var(--accent)]" />
                  Edges
                </CardTitle>
                <CardDescription>
                  Connections carry direction, protocol, and dependency strength. Treat edge styling as information, not ornament.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {edgeSamples.map((sample) => (
                  <EdgePreview key={sample.title} {...sample} />
                ))}

                <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="mb-3 text-sm font-semibold">Edge rules</div>
                  <div className="space-y-2 text-xs leading-5 text-[var(--text-muted)]">
                    <p>Use `smoothstep` as the default so diagrams stay readable under auto-layout and manual edits.</p>
                    <p>Use labels for protocol or dependency intent, not long explanations. Put detailed notes in edge metadata.</p>
                    <p>Escalate with animation or warning color only when the path state matters to the current investigation.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="components" className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Component className="h-5 w-5 text-[var(--accent)]" />
                  Components
                </CardTitle>
                <CardDescription>Interactive examples built from the primitives already used in the app.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">Button families</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        Primary action first, quieter variants second.
                      </div>
                    </div>
                    <Badge variant="outline">Buttons</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button>Publish</Button>
                    <Button variant="secondary">Preview</Button>
                    <Button variant="outline">Open inspector</Button>
                    <Button variant="ghost">Skip for now</Button>
                    <Button variant="destructive">Delete</Button>
                    <Button size="icon" aria-label="Add artifact">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">Inputs and toggles</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        Use labels and clear helper copy around editable controls.
                      </div>
                    </div>
                    <Badge color="var(--accent)">Forms</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="component-search">Search label</Label>
                      <Input id="component-search" placeholder="Find tokens, components, or patterns" />
                    </div>
                    <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface-hover)] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold">Compact density</div>
                          <div className="text-xs text-[var(--text-muted)]">Reduces whitespace in inspector panels.</div>
                        </div>
                        <Switch checked={compactMode} onCheckedChange={setCompactMode} />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold">Status notifications</div>
                          <div className="text-xs text-[var(--text-muted)]">Use positive feedback for long-running saves.</div>
                        </div>
                        <Switch checked={notifications} onCheckedChange={setNotifications} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">Status and utility affordances</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        Badges and icon-only controls stay compact but still readable.
                      </div>
                    </div>
                    <Badge variant="outline">Metadata</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge color="var(--success)">Healthy</Badge>
                    <Badge color="var(--warning)">Pending</Badge>
                    <Badge color="var(--danger)">Escalated</Badge>
                    <Badge variant="outline">Read-only</Badge>
                    <IconButton aria-label="Show notifications">
                      <Bell className="h-4 w-4" />
                    </IconButton>
                    <IconButton hoverVariant="danger" aria-label="Need help">
                      <CircleHelp className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl">Composed pattern</CardTitle>
                <CardDescription>A lightweight status card and an empty state using the same primitive layer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_92%,transparent),color-mix(in_srgb,var(--accent-soft)_42%,var(--surface)_58%))] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">Release review checklist</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        A compact pattern for approval workflows, saved filters, or operational summaries.
                      </div>
                    </div>
                    <Badge color="var(--success)">Ready</Badge>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {[
                      "Visual regression complete",
                      "Keyboard shortcuts verified",
                      "Shared storage contract unchanged",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface)]">
                  <EmptyState
                    icon={<Component />}
                    title="No custom primitives yet"
                    description="Start by extending the existing button, card, and badge system before adding new one-off styles."
                    action={
                      <Button variant="outline" asChild>
                        <Link href="/patterns">Review contribution rules</Link>
                      </Button>
                    }
                    compact={compactMode}
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                <span>Compact mode: {compactMode ? "On" : "Off"}</span>
                <span>Notifications: {notifications ? "Enabled" : "Muted"}</span>
              </CardFooter>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
