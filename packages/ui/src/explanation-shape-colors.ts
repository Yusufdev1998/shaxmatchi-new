/**
 * Fixed palette for puzzle explanation board shapes (circles & arrows).
 * First entry matches the legacy default circle ring color.
 */
export const EXPLANATION_SHAPE_COLORS = [
  "#398841",
  "#c41e3a",
  "#2563eb",
  "#ca8a04",
  "#7c3aed",
] as const;

export type ExplanationShapeColor = (typeof EXPLANATION_SHAPE_COLORS)[number];

export const DEFAULT_EXPLANATION_SHAPE_COLOR: ExplanationShapeColor =
  EXPLANATION_SHAPE_COLORS[0];

export type ExplanationBoardCircle = {
  square: string;
  /** When omitted or unknown, {@link DEFAULT_EXPLANATION_SHAPE_COLOR} is used when rendering. */
  color?: string;
};

export function isExplanationShapeColor(
  value: string,
): value is ExplanationShapeColor {
  return (EXPLANATION_SHAPE_COLORS as readonly string[]).includes(value);
}

/**
 * Supports legacy `circles: string[]` and `{ square, color }[]` from the API.
 */
export function normalizeExplanationCircles(
  circles:
    | readonly string[]
    | readonly ExplanationBoardCircle[]
    | undefined
    | null,
): { square: string; color: string }[] {
  if (!circles?.length) return [];
  return circles.map((item) => {
    if (typeof item === "string") {
      return { square: item, color: DEFAULT_EXPLANATION_SHAPE_COLOR };
    }
    return {
      square: item.square,
      color: item.color ?? DEFAULT_EXPLANATION_SHAPE_COLOR,
    };
  });
}
