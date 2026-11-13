import { NextResponse } from "next/server";
import {
  resolveDeviceId,
  deviceCookieHeaders,
} from "@/lib/server/device";
import { loadLogs, logWorkout, type WorkoutLogInput } from "@/lib/server/workout-logs";

export async function GET(request: Request) {
  const { deviceId } = resolveDeviceId(request);
  const { logs, stats } = await loadLogs(deviceId);
  return NextResponse.json({ logs, stats });
}

export async function POST(request: Request) {
  const { deviceId, setCookie } = resolveDeviceId(request);
  let body: { workout?: WorkoutLogInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workout = body.workout;
  if (
    !workout ||
    typeof workout !== "object" ||
    !workout.id ||
    !workout.goal ||
    typeof workout.durationMinutes !== "number" ||
    !Array.isArray(workout.exercises)
  ) {
    return NextResponse.json(
      { error: "workout (id, goal, durationMinutes, exercises) is required" },
      { status: 400 },
    );
  }

  const result = await logWorkout(deviceId, workout);

  return NextResponse.json(result, {
    status: 201,
    headers: deviceCookieHeaders({ deviceId, setCookie }),
  });
}
