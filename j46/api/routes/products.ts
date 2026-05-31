import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { categoryId } = req.query;

  try {
    let sql = 'SELECT * FROM products';
    
    if (categoryId) {
      sql = `SELECT * FROM products WHERE category_id = ${categoryId}`;
    }

    const [rows] = await pool.query(sql) as [any[], any];
    
    const executionTime = Date.now() - startTime;

    res.json({
      products: rows,
      executionTime,
      executedSql: sql,
    });
  } catch {
    const executionTime = Date.now() - startTime;
    res.json({
      products: [],
      executionTime,
      executedSql: categoryId ? `SELECT * FROM products WHERE category_id = ${categoryId}` : 'SELECT * FROM products',
    });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories') as [any[], any];
    res.json({ categories: rows });
  } catch {
    res.json({ categories: [] });
  }
});

export default router;
