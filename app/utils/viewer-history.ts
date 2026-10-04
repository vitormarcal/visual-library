export type ViewerPosition = { scrollTop: number; focus: string | null }
export type ViewerHistoryEntry = ViewerPosition & { imageId: string }

export const recordViewerVisit = (
  history: ViewerHistoryEntry[], currentId: string, destinationId: string,
  position: ViewerPosition, related: boolean,
): ViewerHistoryEntry[] => {
  if (currentId === destinationId || (!related && history.length === 0)) return history
  return [...history, { imageId: currentId, ...position }]
}

export const popViewerVisit = (history: ViewerHistoryEntry[], existingIds: Set<string>) => {
  const remaining = [...history]
  while (remaining.length) {
    const entry = remaining.pop()!
    if (existingIds.has(entry.imageId)) return { entry, history: remaining }
  }
  return { entry: null, history: remaining }
}
