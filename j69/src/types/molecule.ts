export interface Atom {
  element: string;
  x: number;
  y: number;
  z: number;
}

export interface Bond {
  from: number;
  to: number;
  order: number;
}

export interface MoleculeSummary {
  id: string;
  name: string;
  formula: string;
  molecularWeight: number;
  atomCount: number;
}

export interface MoleculeDetail extends MoleculeSummary {
  atoms: Atom[];
  bonds: Bond[];
}

export const ELEMENT_COLORS: Record<string, string> = {
  H: "#e8e8e8",
  C: "#404040",
  O: "#ff2222",
  N: "#3050f8",
  S: "#ffff30",
  P: "#ff8000",
  Cl: "#1ff01f",
  F: "#90e050",
  Br: "#a62929",
};

export const ELEMENT_RADII: Record<string, number> = {
  H: 0.31,
  C: 0.77,
  O: 0.73,
  N: 0.75,
  S: 1.02,
  P: 1.06,
  Cl: 0.99,
  F: 0.64,
  Br: 1.14,
};

export interface ElementInfo {
  name: string;
  nameEn: string;
  atomicNumber: number;
  atomicMass: number;
  group: string;
}

export const ELEMENT_INFO: Record<string, ElementInfo> = {
  H:  { name: "氢", nameEn: "Hydrogen",  atomicNumber: 1,  atomicMass: 1.008,   group: "非金属" },
  C:  { name: "碳", nameEn: "Carbon",     atomicNumber: 6,  atomicMass: 12.011,  group: "非金属" },
  N:  { name: "氮", nameEn: "Nitrogen",   atomicNumber: 7,  atomicMass: 14.007,  group: "非金属" },
  O:  { name: "氧", nameEn: "Oxygen",     atomicNumber: 8,  atomicMass: 15.999,  group: "非金属" },
  S:  { name: "硫", nameEn: "Sulfur",     atomicNumber: 16, atomicMass: 32.06,   group: "非金属" },
  P:  { name: "磷", nameEn: "Phosphorus", atomicNumber: 15, atomicMass: 30.974,  group: "非金属" },
  Cl: { name: "氯", nameEn: "Chlorine",   atomicNumber: 17, atomicMass: 35.45,   group: "卤素" },
  F:  { name: "氟", nameEn: "Fluorine",   atomicNumber: 9,  atomicMass: 18.998,  group: "卤素" },
  Br: { name: "溴", nameEn: "Bromine",    atomicNumber: 35, atomicMass: 79.904,  group: "卤素" },
};
