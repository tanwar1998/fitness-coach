import Link from "next/link";
import { buttonVariants } from "@/components/Button";

const FEATURES = [
  {
    title: "Curated Workouts",
    description:
      "Generate a personalized routine in seconds. Choose your duration, goal, and level.",
    href: "/pages/exercise",
    cta: "Create a workout",
  },
  {
    title: "Track Progress",
    description:
      "Log your goals, monitor your stats, and see how far you've come.",
    href: "/pages/progress",
    cta: "View your progress",
  },
  {
    title: "Built for Any Level",
    description:
      "From beginner to advanced, every exercise is scaled to your strength and experience.",
    href: "/pages/exercise",
    cta: "Find your level",
  },
  {
    title: "AI Coach",
    description:
      "Chat with your personal AI coach about workouts, nutrition, and recovery.",
    href: "/pages/ai-coach",
    cta: "Start a conversation",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero — a hung tag: serial, mark, statement, action */}
      <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-6">
            <p className="stamp text-muted-foreground">
              FitPulse · Performance wear for your training
            </p>
            <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
              Train smarter{" "}
              <span className="text-primary">with a plan cut to you</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Tell us how much time you have and what you want to work on.
              FitPulse builds a workout that fits your goals and level — no
              guesswork required.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href="/pages/exercise"
                className={buttonVariants("primary", "lg")}
              >
                Create a workout
              </Link>
              <Link
                href="/pages/progress"
                className={buttonVariants("ghost", "lg")}
              >
                Track your progress
              </Link>
            </div>
          </div>

          <div className="plate-stock mx-auto w-full max-w-xs shrink-0 sm:mt-2 sm:w-56">
            <div className="seam" />
            <div className="p-4">
              <p className="stamp text-muted-foreground">Daily check-in · S/N 01-0001</p>
              <ul className="mt-3 flex flex-col gap-2">
                {[
                  ["Energy", "High"],
                  ["Time", "45 min"],
                  ["Pain", "None"],
                ].map(([label, value]) => (
                  <li key={label} className="rule-spec flex items-baseline justify-between gap-3 pb-1.5">
                    <span className="stamp text-muted-foreground">{label}</span>
                    <span className="serial text-sm font-bold">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — a spec ledger */}
      <section className="border-y border-foreground/15">
        <div className="mx-auto grid max-w-4xl grid-cols-2 sm:grid-cols-4">
          {[
            { value: "850+", label: "Exercises" },
            { value: "4", label: "Target areas" },
            { value: "3", label: "Intensity levels" },
            { value: "100%", label: "Free" },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-8 text-center">
              <p className="font-display text-4xl font-black tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="stamp mt-2 text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features — a tag cut from one stock sheet */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="stamp text-primary">The cut list</p>
        <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Everything you need
        </h2>
        <p className="mt-3 max-w-md text-muted-foreground">
          One free tool for building workouts, learning form, tracking goals,
          and getting coached.
        </p>

        <div className="mt-10 flex flex-col gap-1.5">
          {FEATURES.map((feature, index) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group border border-foreground/20 bg-card px-5 py-5 transition-colors hover:border-primary sm:px-6"
            >
              <div className="flex items-start gap-4">
                <span className="serial mt-0.5 w-6 shrink-0 text-right text-[11px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-black uppercase tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
                <span className="mt-1 hidden shrink-0 font-display text-sm font-bold uppercase tracking-wide text-primary sm:inline">
                  {feature.cta}
                  <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA — the violet fabric plate */}
      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="plate-violet px-6 py-12 text-center sm:px-12 sm:py-16">
          <p className="stamp text-primary-foreground/80">Cut. Train. Repeat.</p>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-primary-foreground sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
            Build your first workout in under a minute and start training
            today.
          </p>
          <Link
            href="/pages/exercise"
            className={`${buttonVariants("lime", "lg", "mt-6")}`}
          >
            Generate my workout
          </Link>
        </div>
      </section>
    </div>
  );
}