import { Router, Request, Response } from 'express';
import { userRepository } from '../../db';
import { generateToken } from '../../auth';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password must be strings' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const user = await userRepository.createUser(username, password);
    const token = generateToken({
      userId: user.userId,
      username: user.username,
    });

    res.status(201).json({
      userId: user.userId,
      username: user.username,
      token,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = await userRepository.verifyPassword(username, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = generateToken({
      userId: user.userId,
      username: user.username,
    });

    res.json({
      userId: user.userId,
      username: user.username,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
