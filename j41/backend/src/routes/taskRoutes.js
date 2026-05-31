const express = require('express');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.post('/', taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/logs', taskController.getExecutionLogs);
router.get('/graph', taskController.getDependencyGraph);
router.get('/:id', taskController.getTaskById);
router.get('/:id/dependencies', taskController.checkDependencies);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
