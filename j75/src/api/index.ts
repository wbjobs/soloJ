import { Router } from 'express';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import operationRoutes from './routes/operations';
import healthRoutes from './routes/health';

const router = Router();

router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/operations', operationRoutes);
router.use('/', healthRoutes);

export default router;
