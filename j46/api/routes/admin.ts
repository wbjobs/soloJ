import { Router, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import pool from '../db.js';

const router = Router();

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: '需要管理员权限' });
  }
};

router.get('/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users') as [any[], any];
    const [products] = await pool.query('SELECT COUNT(*) as count FROM products') as [any[], any];
    const [categories] = await pool.query('SELECT COUNT(*) as count FROM categories') as [any[], any];

    res.json({
      success: true,
      stats: {
        users: users[0].count,
        products: products[0].count,
        categories: categories[0].count,
      },
    });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/users', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, created_at FROM users') as [any[], any];
    res.json({ success: true, users: rows });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/products', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `) as [any[], any];
    res.json({ success: true, products: rows });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

export default router;
