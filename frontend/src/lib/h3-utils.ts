export function pickH3Resolution(zoomLevel: number): number {
  if (zoomLevel < 8) return 5;
  if (zoomLevel < 11) return 7;
  return 9;
}

export function h3ResolutionLabel(res: number): string {
  switch (res) {
    case 5:
      return "~253 km² / hex (overview)";
    case 7:
      return "~5.2 km² / hex (analityka)";
    case 9:
      return "~0.1 km² / hex (detail)";
    default:
      return `res ${res}`;
  }
}
