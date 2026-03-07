"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  Globe,
  Layers,
  MessageSquare,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
  Mail,
} from "lucide-react";

/* ─── Scroll Reveal Hook ─── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rumi_logo.png" alt="Rumi" className="h-8 w-auto" />
          <Link
            href="/login"
            className="bg-yellow-400 text-black px-6 h-10 rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-yellow-300 transition-all duration-300 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="min-h-[90vh] flex flex-col items-center justify-center relative px-4 md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.06)_0%,transparent_60%)]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-6">
              The Retention Layer for the Agent Era
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Stop Losing Users.
              <br />
              <span className="gradient-text">Start Retaining Them.</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              58% of AI app users churn within one month. Rumi&apos;s intelligent
              retention layer learns what keeps each user engaged — and
              delivers the right message, at the right time, through the right
              channel. One API call to activate.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="bg-yellow-400 text-black px-8 h-12 rounded-md text-sm font-semibold flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.3)]"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:ali@rumi.team"
                className="border border-white/[0.08] bg-white/[0.02] px-8 h-12 rounded-md text-sm font-semibold flex items-center justify-center gap-2 text-gray-300 hover:border-yellow-400/30 hover:text-white transition-all duration-300"
              >
                <Mail className="h-4 w-4" /> Contact Sales
              </a>
            </div>
          </Reveal>
        </div>
        <div className="absolute bottom-8 scroll-bounce">
          <ChevronDown className="h-6 w-6 text-gray-600" />
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── The Problem ── */}
      <section className="py-24 md:py-32 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4 text-center">
              The Problem
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6">
              AI Apps Are{" "}
              <span className="gradient-text">Leaking Users</span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16 text-base md:text-lg">
              57 million AI apps are built every year. Fewer than 5% have any
              retention mechanism. The tools that exist cost $30K+ and take
              months to implement.
            </p>
          </Reveal>

          {/* Stats bar */}
          <Reveal delay={300}>
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm glow-yellow">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/[0.06]">
                {[
                  {
                    icon: TrendingUp,
                    value: "58%",
                    label: "Monthly Churn",
                    desc: "AI app users lost in 30 days",
                  },
                  {
                    icon: Globe,
                    value: "57M",
                    label: "AI Apps / Year",
                    desc: "Built with Lovable, Bolt, Replit",
                  },
                  {
                    icon: Target,
                    value: "<5%",
                    label: "Have Retention",
                    desc: "No tooling ships by default",
                  },
                  {
                    icon: Zap,
                    value: "$30K+",
                    label: "Legacy Cost",
                    desc: "Braze minimum annual spend",
                  },
                ].map(({ icon: Icon, value, label, desc }, i) => (
                  <div key={i} className="p-6 md:p-8 text-center">
                    <Icon className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                    <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                      {value}
                    </p>
                    <p className="text-yellow-400 font-semibold text-sm uppercase tracking-wider mt-1">
                      {label}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── The Paradigm Shift ── */}
      <section className="py-24 md:py-32 px-4 md:px-8 relative">
        <div className="absolute inset-0 dot-pattern opacity-30" />
        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4 text-center">
              The Paradigm Shift
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6">
              From Notifications to{" "}
              <span className="gradient-text">Intelligent Engagement</span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16 text-base md:text-lg">
              On-device AI agents now filter notifications. Push messages are
              becoming invisible. Retention shifts from interrupting users to
              earning their attention.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <Reveal delay={300}>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-8 md:p-10 hover:border-red-400/30 transition-all duration-500">
                <p className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">
                  Before: Notification Era
                </p>
                <ul className="space-y-3 text-gray-400 text-base">
                  <li className="flex gap-3">
                    <span className="text-red-400/60">✕</span> App sends push
                    notification to device
                  </li>
                  <li className="flex gap-3">
                    <span className="text-red-400/60">✕</span> On-device AI
                    summarizes it away
                  </li>
                  <li className="flex gap-3">
                    <span className="text-red-400/60">✕</span> No feedback
                    loop. No learning.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-red-400/60">✕</span> One-size-fits-all.
                    Spray and pray.
                  </li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-8 md:p-10 hover:border-yellow-400/30 transition-all duration-500">
                <p className="text-yellow-400 font-semibold text-sm uppercase tracking-wider mb-4">
                  After: Agent Era
                </p>
                <ul className="space-y-3 text-gray-300 text-base">
                  <li className="flex gap-3">
                    <span className="text-yellow-400">✓</span> Rumi evaluates
                    user context in real time
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-400">✓</span> Finds the right
                    moment, channel, and content
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-400">✓</span> Every response
                    updates the retention policy
                  </li>
                  <li className="flex gap-3">
                    <span className="text-yellow-400">✓</span> Retention earns
                    attention, not interrupts
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── How It Works ── */}
      <section className="py-24 md:py-32 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4 text-center">
              How It Works
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16">
              Four Steps to{" "}
              <span className="gradient-text">Autonomous Retention</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Zap,
                step: "1",
                title: "Integrate",
                desc: "One prompt in Cursor or Lovable. Or drop in the SDK. Connect your events. Minutes, not months.",
              },
              {
                icon: Brain,
                step: "2",
                title: "Observe",
                desc: "The system builds per-user behavioral models: timing, content affinity, engagement triggers, churn risk.",
              },
              {
                icon: MessageSquare,
                step: "3",
                title: "Engage",
                desc: "Delivers the right message through the right channel at the right moment. No spam. Intelligent outreach.",
              },
              {
                icon: TrendingUp,
                step: "4",
                title: "Compound",
                desc: "Every interaction updates the policy. Optimization happens per-decision and per-sequence. Retention compounds.",
              },
            ].map(({ icon: Icon, step, title, desc }, i) => (
              <Reveal key={i} delay={200 + i * 100}>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8 hover:border-yellow-400/20 transition-all duration-500 h-full">
                  <div className="w-12 h-12 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="text-xs text-yellow-400/60 font-mono mb-2">
                    STEP {step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── Why Rumi ── */}
      <section className="py-24 md:py-32 px-4 md:px-8 relative">
        <div className="absolute inset-0 dot-pattern opacity-50" />
        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4 text-center">
              Why Rumi
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6">
              The Gap{" "}
              <span className="gradient-text">No One Fills</span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16 text-base md:text-lg">
              Legacy tools can&apos;t serve 57 million modern apps or adapt to
              each user in real time. Rumi was built for this moment.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: "AI-Native",
                desc: "Built for AI-generated apps from day one. Not a legacy tool with an AI wrapper.",
              },
              {
                icon: Layers,
                title: "Per-User Intelligence",
                desc: "Every user gets a personalized retention policy. Not segments. Not rules. Individual optimization.",
              },
              {
                icon: Zap,
                title: "Minutes to Integrate",
                desc: "One prompt in your AI code editor or one SDK install. Not 45-60 day enterprise implementations.",
              },
              {
                icon: Shield,
                title: "Privacy-First",
                desc: "On-device preference learning. Data stays with the user. Retention without surveillance.",
              },
              {
                icon: Target,
                title: "Self-Optimizing",
                desc: "The system learns from every interaction. No manual campaigns, no A/B test setup, no configuration.",
              },
              {
                icon: Users,
                title: "Built for Developers",
                desc: "Stripe-like developer experience. Usage-based pricing that scales with you, not against you.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={i} delay={300 + i * 100}>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8 hover:border-yellow-400/20 transition-all duration-500 h-full">
                  <Icon className="h-8 w-8 text-yellow-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── Pricing ── */}
      <section className="py-24 md:py-32 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4 text-center">
              Pricing
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6">
              Simple,{" "}
              <span className="gradient-text">Usage-Based Pricing</span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-gray-400 text-center max-w-xl mx-auto mb-16 text-base md:text-lg">
              Start free. Scale as you grow. Like Stripe, revenue grows as your
              customers grow.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Free",
                price: "$0",
                period: "/mo",
                mau: "1K MAU",
                features: [
                  "Full optimization",
                  "Core analytics",
                  "Community support",
                ],
                highlight: false,
              },
              {
                name: "Starter",
                price: "$29",
                period: "/mo",
                mau: "5K MAU",
                features: [
                  "Multi-channel delivery",
                  "Advanced analytics",
                  "Email support",
                ],
                highlight: false,
              },
              {
                name: "Growth",
                price: "$99",
                period: "/mo",
                mau: "25K MAU",
                features: [
                  "Sequential planning",
                  "On-device learning",
                  "Priority support",
                ],
                highlight: true,
              },
              {
                name: "Scale",
                price: "$249",
                period: "/mo",
                mau: "100K+ MAU",
                features: [
                  "Custom objectives",
                  "Enterprise SLAs",
                  "Dedicated infra",
                ],
                highlight: false,
              },
            ].map(({ name, price, period, mau, features, highlight }, i) => (
              <Reveal key={i} delay={300 + i * 100}>
                <div
                  className={`rounded-2xl border p-6 md:p-8 transition-all duration-500 h-full flex flex-col ${
                    highlight
                      ? "border-yellow-400/40 bg-yellow-400/[0.04] glow-yellow"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-yellow-400/20"
                  }`}
                >
                  {highlight && (
                    <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-white">{name}</h3>
                  <p className="text-gray-500 text-sm mb-4">{mau}</p>
                  <p className="text-3xl font-bold text-white mb-6">
                    {price}
                    <span className="text-gray-500 text-base font-normal">
                      {period}
                    </span>
                  </p>
                  <ul className="space-y-2 flex-1">
                    {features.map((f, j) => (
                      <li
                        key={j}
                        className="flex items-center gap-2 text-sm text-gray-300"
                      >
                        <span className="text-yellow-400 text-xs">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`mt-6 w-full h-10 rounded-md text-sm font-semibold flex items-center justify-center transition-all duration-300 ${
                      highlight
                        ? "bg-yellow-400 text-black hover:bg-yellow-300"
                        : "border border-white/[0.08] text-gray-300 hover:border-yellow-400/30 hover:text-white"
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── Backed By ── */}
      <section className="py-24 md:py-32 px-4 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4">
              Backed By
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl font-bold mb-12">
              Industry Leaders
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-16 md:gap-24">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {/* Google Cloud text logo */}
                  <span className="text-2xl md:text-3xl font-semibold text-gray-300">
                    Google Cloud
                  </span>
                </div>
                <p className="text-gray-500 text-sm">
                  $350K in committed cloud credits
                </p>
              </div>
              <div className="hidden sm:block w-px h-16 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
              <div className="text-center">
                <span className="text-2xl md:text-3xl font-semibold text-gray-300">
                  Founder Institute
                </span>
                <p className="text-gray-500 text-sm mt-2">
                  Global accelerator, &lt;5% acceptance rate
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── Team ── */}
      <section className="py-24 md:py-32 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest uppercase text-yellow-400 mb-4 text-center">
              Team
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Built by{" "}
              <span className="gradient-text">World-Class Experts</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Ali Naeini, Ph.D.",
                role: "CEO",
                bio: "PhD in AI. Visiting researcher UC Berkeley. AI leader at Business Insider & Spotter (both $1B+ valuations). Shipped products to millions.",
              },
              {
                name: "Saba Fazel",
                role: "CPO",
                bio: "Built participatory systems at the United Nations. Converts qualitative insight into product direction. Data Science, UCLA.",
              },
              {
                name: "Parnian Fazel",
                role: "CTO",
                bio: "ML personalization systems, millions of daily predictions. Specializes in agentic AI architecture. MSc Machine Learning, Imperial College London.",
              },
            ].map(({ name, role, bio }, i) => (
              <Reveal key={i} delay={200 + i * 100}>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:border-yellow-400/20 transition-all duration-500 h-full">
                  <div className="w-14 h-14 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mb-4">
                    <span className="text-yellow-400 font-bold text-lg">
                      {name[0]}
                    </span>
                  </div>
                  <p className="text-yellow-400 font-semibold text-sm uppercase tracking-wider mb-1">
                    {role}
                  </p>
                  <h3 className="text-xl font-bold text-white mb-3">{name}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{bio}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider max-w-5xl mx-auto w-full" />

      {/* ── CTA ── */}
      <section className="py-24 md:py-32 px-4 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
              Ready to{" "}
              <span className="gradient-text">Retain Your Users?</span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-4">
              Join the developers building the next generation of AI apps with
              built-in retention intelligence.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2 mb-8">
              <Shield className="h-4 w-4" /> Privacy-first. No lock-in. Cancel
              anytime.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-yellow-400 text-black px-10 h-14 rounded-md text-lg font-semibold hover:bg-yellow-300 transition-all duration-300 hover:shadow-[0_0_40px_rgba(251,191,36,0.3)]"
            >
              Get Started Free <ArrowRight className="h-5 w-5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full py-12 bg-black border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rumi_logo.png" alt="Rumi" className="h-8 w-auto opacity-70" />
            <p className="text-gray-600 text-sm mt-1">
              The Retention Layer for the Agent Era
            </p>
          </div>
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} Rumi, Inc. All rights reserved.
          </p>
          <a
            href="mailto:ali@rumi.team"
            className="text-gray-500 hover:text-yellow-400 transition-colors text-sm flex items-center gap-2"
          >
            <Mail className="h-4 w-4" /> ali@rumi.team
          </a>
        </div>
      </footer>
    </div>
  );
}
