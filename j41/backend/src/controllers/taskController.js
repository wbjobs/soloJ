const taskStore = require('../models/TaskStore');
const schedulerService = require('../services/SchedulerService');

exports.createTask = (req, res) => {
  try {
    const { name, cronExpression, command, timeout, dependsOn } = req.body;
    
    if (!name || !cronExpression || !command) {
      return res.status(400).json({
        error: 'Name, cronExpression and command are required',
      });
    }

    const task = taskStore.createTask({
      name,
      cronExpression,
      command,
      timeout,
      dependsOn,
    });

    schedulerService.scheduleTask(task);

    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getTasks = (req, res) => {
  try {
    const tasks = taskStore.getTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTaskById = (req, res) => {
  try {
    const { id } = req.params;
    const task = taskStore.getTaskById(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTask = (req, res) => {
  try {
    const { id } = req.params;
    const { name, cronExpression, command, timeout, status, dependsOn } = req.body;

    const updatedTask = taskStore.updateTask(id, {
      name,
      cronExpression,
      command,
      timeout,
      status,
      dependsOn,
    });

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (status === 'active' || cronExpression) {
      schedulerService.scheduleTask(updatedTask);
    } else if (status === 'inactive') {
      schedulerService.unscheduleTask(id);
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteTask = (req, res) => {
  try {
    const { id } = req.params;
    
    schedulerService.unscheduleTask(id);
    const deleted = taskStore.deleteTask(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getExecutionLogs = (req, res) => {
  try {
    const { taskId } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const logs = taskStore.getExecutionLogs(taskId, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDependencyGraph = (req, res) => {
  try {
    const graph = taskStore.getDependencyGraph();
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkDependencies = (req, res) => {
  try {
    const { id } = req.params;
    const result = taskStore.checkDependenciesMet(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
