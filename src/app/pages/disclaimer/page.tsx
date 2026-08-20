import { Badge } from "@/components/Badge";

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  );
}

function HeartPulseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const CLAUSES = [
  {
    title: "No liability",
    icon: ShieldIcon,
    body: "We will not be held responsible in any way for the information that you request or receive through or on our website, API or data. In no event will we be liable to any party for any direct, indirect, special, incidental, equitable or consequential damages for any use of or reliance on this website, API or data, including, without limitation, any lost profits, personal or business interruptions, personal injuries, accidents, misapplication of information or any other loss, malady, disease or difficulty, or otherwise, even if we are expressly advised of the possibility of such damages or difficulties.",
  },
  {
    title: "Computer-generated workouts",
    icon: CpuIcon,
    body: "These are computer-generated workouts which have not been reviewed or approved by any personal trainer or otherwise qualified person.",
  },
  {
    title: "Consult a professional",
    icon: HeartPulseIcon,
    body: "Always consult a physician or qualified healthcare provider before beginning any exercise or fitness program.",
  },
  {
    title: "Informational purposes only",
    icon: BookIcon,
    body: "The workouts, exercises, and other movements provided on this website are for informational and educational purposes only, and are not intended for use as a substitute for professional programming or advice.",
  },
  {
    title: "Know your limits",
    icon: AlertIcon,
    body: "You know your body best, so always stop before over-exertion.",
  },
];

export default function DisclaimerPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <Badge variant="outline" className="mb-4">
          Legal
        </Badge>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">Disclaimer</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Please read this carefully before using FitCoach. The points below
          describe how our content should be used.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
        <p className="text-sm leading-relaxed sm:text-base">
          <strong>
            By entering this website, using the workout generator API or
            exercises data, you are agreeing to accept all parts of this
            disclaimer.
          </strong>{" "}
          Thus, if you do not agree to the disclaimer below, STOP now, and do
          not use this website, API or data. By using this website, API or
          data, you implicitly signify your agreement to all parts of the below
          disclaimer.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {CLAUSES.map((clause) => {
          const Icon = clause.icon;
          return (
            <div
              key={clause.title}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <Icon />
              </span>
              <div>
                <h2 className="font-display font-semibold">{clause.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {clause.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        We = FitCoach and any other contributors to this project
      </p>
    </div>
  );
}
