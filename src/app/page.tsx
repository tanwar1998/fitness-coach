import Link from "next/link";
import { buttonVariants } from "@/components/Button";

const FEATURES = [
  {
    title: "Curated Workouts",
    description:
      "Generate a personalized routine in seconds. Choose your duration, goal, and level.",
    href: "/pages/exercise",
    cta: "Create a workout",
    index: "01",
  },
  {
    title: "Track Progress",
    description:
      "Log your goals, monitor your stats, and see how far you've come on your fitness journey.",
    href: "/pages/progress",
    cta: "View your progress",
    index: "02",
  },
  {
    title: "Built for Any Level",
    description:
      "From beginner to advanced, every exercise is scaled to match your strength and experience.",
    href: "/pages/exercise",
    cta: "Find your level",
    index: "03",
  },
  {
    title: "AI Coach",
    description:
      "Chat with your personal AI coach about workouts, nutrition, and recovery. Every conversation is saved.",
    href: "/pages/ai-coach",
    cta: "Start a conversation",
    index: "04",
  },
];

const STATS = [
  { value: "60+", label: "Exercises" },
  { value: "4", label: "Target areas" },
  { value: "3", label: "Intensity levels" },
  { value: "100%", label: "Free" },
];

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary/25 blur-[100px]" />
          <div className="absolute -left-32 top-40 h-[26rem] w-[26rem] rounded-full bg-lime/15 blur-[90px]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise">
            <h1 className="max-w-xl font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
              Train smarter with{" "}
              <span className="text-primary">personalized workouts</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Tell us how much time you have and what you want to work on.
              FitCoach builds a workout that fits your goals and level — no
              guesswork required.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pages/exercise"
                className={buttonVariants("primary", "lg")}
              >
                Create a workout
              </Link>
              <Link
                href="/pages/progress"
                className={buttonVariants("lime", "lg")}
              >
                Track your progress
              </Link>
            </div>
          </div>

          <div
            className="relative rounded-3xl border border-border bg-card p-8 shadow-xl shadow-primary/10 animate-rise"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-5xl font-bold tracking-tight text-primary">
                  32:00
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Today&apos;s workout
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                <span className="h-2 w-2 rounded-full bg-lime animate-pulse-live" />
                Ready
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { value: "12", label: "Sets" },
                { value: "8", label: "Exercises" },
                { value: "4", label: "Areas" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-secondary px-3 py-4 text-center"
                >
                  <p className="font-display text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-secondary-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2.5">
              {["Full-body warm-up", "Strength circuit", "Core finisher"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{item}</span>
                    <span className="ml-auto text-xs font-semibold text-muted-foreground">
                      {["12:00", "16:00", "4:00"][index]}
                    </span>
                  </div>
                ),
              )}
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-lime" />
            </div>
            <p className="mt-2 text-right text-xs font-semibold text-muted-foreground">
              68% complete
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className="bg-card px-6 py-8 text-center animate-rise"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <p className="font-display text-3xl font-bold text-primary">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to get moving
          </h2>
          <p className="max-w-sm text-muted-foreground">
            One free tool for building workouts, learning form, tracking goals,
            and getting coached.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group relative flex flex-col rounded-3xl border border-border bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-sm font-semibold tracking-widest text-muted-foreground/70">
                  {feature.index}
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {feature.description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {feature.cta}
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-[60px]"
          />
          <h2 className="relative font-display text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/85">
            Build your first workout in under a minute and start training
            today.
          </p>
          <Link
            href="/pages/exercise"
            className={`${buttonVariants("lime", "lg", "relative mt-6")}`}
          >
            Generate my workout
          </Link>
        </div>
      </section>
    </div>
  );
}