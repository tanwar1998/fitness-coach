import Image from "next/image";

interface DiagramMuscle {
  id: number;
  is_front: boolean;
}

const MUSCLE_DIR = "/exercise/muscles";

function Figure({
  view,
  primaryIds,
  secondaryIds,
}: {
  view: "front" | "back";
  primaryIds: number[];
  secondaryIds: number[];
}) {
  return (
    <div
      className="relative h-full"
      style={{ aspectRatio: "200 / 369" }}
      aria-hidden="true"
    >
      <Image
        src={`${MUSCLE_DIR}/silhouette-${view}.svg`}
        alt=""
        fill
        sizes="120px"
        className="object-fill"
        unoptimized
      />
      {secondaryIds.map((id) => (
        <Image
          key={`sec-${id}`}
          src={`${MUSCLE_DIR}/secondary-${id}.svg`}
          alt=""
          fill
          sizes="120px"
          className="object-fill opacity-70"
          unoptimized
        />
      ))}
      {primaryIds.map((id) => (
        <Image
          key={`main-${id}`}
          src={`${MUSCLE_DIR}/main-${id}.svg`}
          alt=""
          fill
          sizes="120px"
          className="object-fill"
          unoptimized
        />
      ))}
    </div>
  );
}

export function MuscleDiagram({
  muscles,
  musclesSecondary,
}: {
  muscles: DiagramMuscle[];
  musclesSecondary: DiagramMuscle[];
}) {
  const frontPrimary = muscles.filter((m) => m.is_front).map((m) => m.id);
  const backPrimary = muscles.filter((m) => !m.is_front).map((m) => m.id);
  const frontSecondary = musclesSecondary
    .filter((m) => m.is_front)
    .map((m) => m.id);
  const backSecondary = musclesSecondary
    .filter((m) => !m.is_front)
    .map((m) => m.id);

  const showFront =
    frontPrimary.length > 0 ||
    frontSecondary.length > 0 ||
    (backPrimary.length === 0 && backSecondary.length === 0);
  const showBack = backPrimary.length > 0 || backSecondary.length > 0;

  return (
    <div className="flex h-full items-center justify-center gap-8 bg-secondary px-10 py-6">
      {showFront && (
        <Figure
          view="front"
          primaryIds={frontPrimary}
          secondaryIds={frontSecondary}
        />
      )}
      {showBack && (
        <Figure
          view="back"
          primaryIds={backPrimary}
          secondaryIds={backSecondary}
        />
      )}
    </div>
  );
}
