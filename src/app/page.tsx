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
      "Log your goals, monitor your stats, and see how far you've come on your fitness journey.",
    href: "/pages/progress",
    cta: "View your progress",
  },
  {
    title: "Built for Any Level",
    description:
      "From beginner to advanced, every exercise is scaled to match your strength and experience.",
    href: "/pages/exercise",
    cta: "Find your level",
  },
  {
    title: "AI Coach",
    description:
      "Chat with your personal AI coach about workouts, nutrition, and recovery. Every conversation is saved.",
    href: "/pages/ai-coach",
    cta: "Start a conversation",
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
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <span className="inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
          Your personal fitness companion
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Train smarter with{" "}
          <span className="text-primary">personalized workouts</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Tell us how much time you have and what you want to work on. FitCoach
          builds a workout that fits your goals and level — no guesswork
          required.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/pages/exercise"
            className={buttonVariants("primary", "lg", "w-full sm:w-auto")}
          >
            Create a workout
          </Link>
          <Link
            href="/pages/progress"
            className={buttonVariants("outline", "lg", "w-full sm:w-auto")}
          >
            Track your progress
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-card px-6 py-8 text-center">
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {feature.description}
              </p>
              <Link
                href={feature.href}
                className={`${buttonVariants("ghost", "sm")} -mx-3 mt-4 self-start`}
              >
                {feature.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-secondary px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-secondary-foreground">
            Build your first workout in under a minute and start training
            today.
          </p>
          <Link
            href="/pages/exercise"
            className={buttonVariants("primary", "lg", "mt-6")}
          >
            Generate my workout
          </Link>
        </div>
      </section>
    </div>
  );
}
