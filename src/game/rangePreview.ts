export const RANGE_PREVIEW_EDGE_MARGIN = 140;

/**
 * Returns the world-space camera centre for an opening target preview.
 * Targets already readable from the launcher view do not trigger a pan.
 */
export function rangePreviewCenter(
  targetWorldXs: readonly number[],
  viewportWidth: number,
  worldWidth: number,
): number | undefined {
  if (targetWorldXs.length === 0) return undefined;
  const visibleRightEdge = viewportWidth - RANGE_PREVIEW_EDGE_MARGIN;
  if (targetWorldXs.every((targetX) => targetX <= visibleRightEdge)) return undefined;

  const minimumTargetX = Math.min(...targetWorldXs);
  const maximumTargetX = Math.max(...targetWorldXs);
  const desiredCenter = (minimumTargetX + maximumTargetX) / 2;
  const halfViewport = viewportWidth / 2;
  return Math.min(Math.max(desiredCenter, halfViewport), Math.max(halfViewport, worldWidth - halfViewport));
}
