import { Router, Request, Response } from 'express';
import session from 'express-session';
import pool from '../db.js';

const router = Router();

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      role: string;
    };
  }
}

router.post('/login', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { username, password } = req.body;

  try {
    const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    
    const [rows] = await pool.query(sql) as [any[], any];
    
    const executionTime = Date.now() - startTime;

    if (rows.length > 0) {
      const user = rows[0];
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
      
      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        executionTime,
        executedSql: sql,
      });
    } else {
      res.json({
        success: false,
        message: '用户名或密码错误',
        executionTime,
        executedSql: sql,
      });
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    res.json({
      success: false,
      message: error.message,
      executionTime,
      executedSql: `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`,
    });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true, message: '已退出登录' });
  });
});

router.get('/me', (req: Request, res: Response) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false, message: '未登录' });
  }
});

export default router;
