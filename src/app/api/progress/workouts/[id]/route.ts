import { NextResponse } from "next/server";
import { resolveDeviceId } from "@/lib/server/device";
import {
  undoWorkoutLog,
  WorkoutLogNotFoundError,
  WorkoutLogNotUndoableError,
} from "@/lib/server/workout-logs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { deviceId } = resolveDeviceId(request);

  try {
    const result = await undoWorkoutLog(deviceId, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkoutLogNotFoundError) {
      return NextResponse.json({ error: "Workout log not found" }, { status: 404 });
    }
    if (error instanceof WorkoutLogNotUndoableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
