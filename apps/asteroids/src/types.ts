export interface Body {
  id: string;
  name: string;
  kind: "planet" | "asteroid";
  color?: string;
  samples: number[][];
}
export interface Observation {
  objectId: string;
  id: string;
  mjd: number;
  ra: number;
  dec: number;
  detector: number;
  url: string;
  quality: string;
  snr: number | null;
  wavelength: number | null;
  offset: number | null;
  ephemeris: string;
  availabilityReason?: string;
  positionStatus?: string;
  spacecraft?: number[];
  sequenceId?: string;
  image: null | {
    atlas?: boolean;
    calibration?: Sightline;
    trail?: ImageTrail;
    model?: { method: string; chi2Reduced: number };
    path: string;
    width: number;
    height: number;
    predicted: number[];
    measured: number[] | null;
    roundtripArcsec: number;
    fitsSHA256: string;
  };
}
export interface Manifest {
  start: number;
  end: number;
  frame: string;
  generatedUTC: string;
  validation: { id: string; maxInterpolationErrorAU: number }[];
  warnings: unknown[];
}

export interface Sequence {
  id: string;
  objectId: string;
  frames: Observation[];
  coverage: number;
}
export interface Sightline {
  forward: number[];
  up: number[];
  right: number[];
  grid: number[][];
  segments: number;
  bounds: number[];
  radiansPerPixel: number;
  maxMeshErrorPixels: number;
  frame: string;
}
export interface TrailPoint {
  id: string;
  objectId: string;
  mjd: number;
  order: number;
  x: number | null;
  y: number | null;
  inside: boolean;
}
export interface ImageTrail {
  points: TrailPoint[];
  currentId: string;
  objectId: string;
  source: string;
}
