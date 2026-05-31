import { Router, type Request, type Response } from "express";
import molecules from "../data/molecules.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const list = molecules.map((m) => ({
    id: m.id,
    name: m.name,
    formula: m.formula,
    molecularWeight: m.molecularWeight,
    atomCount: m.atoms.length,
  }));
  res.json({ molecules: list });
});

router.get("/:id", (req: Request, res: Response) => {
  const mol = molecules.find((m) => m.id === req.params.id);
  if (!mol) {
    res.status(404).json({ success: false, error: "Molecule not found" });
    return;
  }
  res.json(mol);
});

export default router;
