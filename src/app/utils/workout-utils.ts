import { PlannedWorkout, PlannedExercise } from '../models/health.models';

// Run types for display
const runTypes: { [key: string]: string } = {
  'zone2': 'Zone 2 (Easy/Aerobic)',
  'tempo': 'Tempo Run',
  'intervals': 'Intervals',
  'long_run': 'Long Run',
  'recovery': 'Recovery Run',
  'fartlek': 'Fartlek',
  'race_pace': 'Race Pace',
  'hill_repeats': 'Hill Repeats'
};

export function getRunTypeLabel(value: string): string {
  return runTypes[value] || value;
}

export function formatWorkoutAsText(planned: PlannedWorkout): string {
  let text = `${planned.type}\n`;
  text += `Duration: ${planned.targetDuration} min\n\n`;

  // Cardio workout details
  const cardio = (planned as any).cardio;
  if (cardio) {
    text += `Type: ${getRunTypeLabel(cardio.runType)}\n`;
    if (cardio.targetType === 'distance') {
      const unit = cardio.distanceUnit === 'km' ? 'km' : 'mi';
      text += `Target: ${cardio.targetValue} ${unit}\n`;
    } else {
      text += `Target: ${cardio.targetValue} min\n`;
    }
    if (cardio.targetPace) {
      text += `Pace: ${cardio.targetPace}\n`;
    }
    if (cardio.notes) {
      text += `Notes: ${cardio.notes}\n`;
    }
  }

  // Strength training exercises
  if (planned.exercises?.length) {
    text += `Exercises:\n`;
    planned.exercises.forEach((ex: PlannedExercise, i: number) => {
      text += `${i + 1}. ${ex.name}\n`;
      text += `   ${ex.sets} × ${ex.reps}`;
      if (ex.weight) {
        text += ` @ ${ex.weight}`;
      }
      text += `\n`;
    });
  }

  return text;
}

export function copyWorkoutToClipboard(
  planned: PlannedWorkout,
  onSuccess: () => void,
  onError?: (err: any) => void
): void {
  const text = formatWorkoutAsText(planned);
  
  navigator.clipboard.writeText(text).then(() => {
    onSuccess();
  }).catch(err => {
    console.error('Failed to copy:', err);
    if (onError) onError(err);
  });
}
