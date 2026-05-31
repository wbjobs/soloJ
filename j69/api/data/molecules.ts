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

export interface MoleculeDetail {
  id: string;
  name: string;
  formula: string;
  molecularWeight: number;
  atoms: Atom[];
  bonds: Bond[];
}

const molecules: MoleculeDetail[] = [
  {
    id: "water",
    name: "水",
    formula: "H₂O",
    molecularWeight: 18.015,
    atoms: [
      { element: "O", x: 0, y: 0, z: 0 },
      { element: "H", x: 0.757, y: 0.586, z: 0 },
      { element: "H", x: -0.757, y: 0.586, z: 0 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
    ],
  },
  {
    id: "methane",
    name: "甲烷",
    formula: "CH₄",
    molecularWeight: 16.04,
    atoms: [
      { element: "C", x: 0, y: 0, z: 0 },
      { element: "H", x: 0.629, y: 0.629, z: 0.629 },
      { element: "H", x: -0.629, y: -0.629, z: 0.629 },
      { element: "H", x: -0.629, y: 0.629, z: -0.629 },
      { element: "H", x: 0.629, y: -0.629, z: -0.629 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
    ],
  },
  {
    id: "co2",
    name: "二氧化碳",
    formula: "CO₂",
    molecularWeight: 44.01,
    atoms: [
      { element: "C", x: 0, y: 0, z: 0 },
      { element: "O", x: 1.16, y: 0, z: 0 },
      { element: "O", x: -1.16, y: 0, z: 0 },
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 0, to: 2, order: 2 },
    ],
  },
  {
    id: "ammonia",
    name: "氨",
    formula: "NH₃",
    molecularWeight: 17.031,
    atoms: [
      { element: "N", x: 0, y: 0.37, z: 0 },
      { element: "H", x: 0.94, y: -0.12, z: 0 },
      { element: "H", x: -0.47, y: -0.12, z: 0.81 },
      { element: "H", x: -0.47, y: -0.12, z: -0.81 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
    ],
  },
  {
    id: "ethanol",
    name: "乙醇",
    formula: "C₂H₅OH",
    molecularWeight: 46.069,
    atoms: [
      { element: "C", x: -0.75, y: 0, z: 0 },
      { element: "C", x: 0.75, y: 0, z: 0 },
      { element: "O", x: 1.37, y: 1.1, z: 0 },
      { element: "H", x: -1.14, y: -0.58, z: 0.89 },
      { element: "H", x: -1.14, y: -0.58, z: -0.89 },
      { element: "H", x: -1.14, y: 1.01, z: 0 },
      { element: "H", x: 1.14, y: -0.58, z: 0.89 },
      { element: "H", x: 1.14, y: -0.58, z: -0.89 },
      { element: "H", x: 2.3, y: 0.9, z: 0 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
      { from: 0, to: 5, order: 1 },
      { from: 1, to: 6, order: 1 },
      { from: 1, to: 7, order: 1 },
      { from: 2, to: 8, order: 1 },
    ],
  },
  {
    id: "benzene",
    name: "苯",
    formula: "C₆H₆",
    molecularWeight: 78.114,
    atoms: [
      { element: "C", x: 1.4, y: 0, z: 0 },
      { element: "C", x: 0.7, y: 1.21, z: 0 },
      { element: "C", x: -0.7, y: 1.21, z: 0 },
      { element: "C", x: -1.4, y: 0, z: 0 },
      { element: "C", x: -0.7, y: -1.21, z: 0 },
      { element: "C", x: 0.7, y: -1.21, z: 0 },
      { element: "H", x: 2.48, y: 0, z: 0 },
      { element: "H", x: 1.24, y: 2.15, z: 0 },
      { element: "H", x: -1.24, y: 2.15, z: 0 },
      { element: "H", x: -2.48, y: 0, z: 0 },
      { element: "H", x: -1.24, y: -2.15, z: 0 },
      { element: "H", x: 1.24, y: -2.15, z: 0 },
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 },
      { from: 5, to: 0, order: 1 },
      { from: 0, to: 6, order: 1 },
      { from: 1, to: 7, order: 1 },
      { from: 2, to: 8, order: 1 },
      { from: 3, to: 9, order: 1 },
      { from: 4, to: 10, order: 1 },
      { from: 5, to: 11, order: 1 },
    ],
  },
];

export default molecules;
