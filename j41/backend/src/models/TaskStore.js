const { v4: uuidv4 } = require('uuid');

class TaskStore {
  constructor() {
    this.tasks = new Map();
    this.executionLogs = [];
  }

  validateDependencies(dependsOn, currentTaskId = null) {
    if (!dependsOn || dependsOn.length === 0) {
      return { valid: true };
    }

    for (const depId of dependsOn) {
      if (!this.tasks.has(depId)) {
        return { valid: false, error: `依赖任务 ${depId} 不存在` };
      }
    }

    if (this.hasCycle(currentTaskId, dependsOn)) {
      return { valid: false, error: '存在循环依赖' };
    }

    return { valid: true };
  }

  hasCycle(taskId, newDependencies) {
    const visited = new Set();
    const recStack = new Set();

    const dfs = (id) => {
      if (recStack.has(id)) {
        return true;
      }
      if (visited.has(id)) {
        return false;
      }

      visited.add(id);
      recStack.add(id);

      let deps = [];
      if (id === taskId) {
        deps = newDependencies;
      } else {
        const task = this.tasks.get(id);
        deps = task?.dependsOn || [];
      }

      for (const depId of deps) {
        if (dfs(depId)) {
          return true;
        }
      }

      recStack.delete(id);
      return false;
    };

    if (taskId && dfs(taskId)) {
      return true;
    }

    for (const [id] of this.tasks) {
      if (!visited.has(id) && dfs(id)) {
        return true;
      }
    }

    return false;
  }

  checkDependenciesMet(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      return { met: true };
    }

    const failedDeps = [];
    const pendingDeps = [];

    for (const depId of task.dependsOn) {
      const depTask = this.tasks.get(depId);
      if (!depTask) {
        failedDeps.push(depId);
      } else if (depTask.lastStatus === 'failed' || depTask.lastStatus === 'conflict') {
        failedDeps.push(depId);
      } else if (!depTask.lastStatus || depTask.lastStatus === 'pending') {
        pendingDeps.push(depId);
      }
    }

    if (failedDeps.length > 0) {
      return { 
        met: false, 
        reason: 'failed',
        failedTasks: failedDeps 
      };
    }

    if (pendingDeps.length > 0) {
      return { 
        met: false, 
        reason: 'pending',
        pendingTasks: pendingDeps 
      };
    }

    return { met: true };
  }

  getDependencyGraph() {
    const nodes = [];
    const edges = [];

    for (const [id, task] of this.tasks) {
      nodes.push({
        id,
        name: task.name,
        status: task.status,
        lastStatus: task.lastStatus,
      });

      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          edges.push({ from: depId, to: id });
        }
      }
    }

    return { nodes, edges };
  }

  getDependentTasks(taskId) {
    const dependents = [];
    for (const [id, task] of this.tasks) {
      if (task.dependsOn && task.dependsOn.includes(taskId)) {
        dependents.push(id);
      }
    }
    return dependents;
  }

  createTask(taskData) {
    const dependsOn = taskData.dependsOn || [];
    
    const validation = this.validateDependencies(dependsOn);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const id = uuidv4();
    const task = {
      id,
      name: taskData.name,
      cronExpression: taskData.cronExpression,
      command: taskData.command,
      timeout: taskData.timeout || 30,
      status: 'active',
      dependsOn,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastExecution: null,
      lastStatus: null,
    };
    this.tasks.set(id, task);
    return task;
  }

  getTasks() {
    return Array.from(this.tasks.values());
  }

  getTaskById(id) {
    return this.tasks.get(id);
  }

  updateTask(id, taskData) {
    const task = this.tasks.get(id);
    if (!task) return null;

    if (taskData.dependsOn !== undefined) {
      const validation = this.validateDependencies(taskData.dependsOn, id);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }
    
    const updatedTask = {
      ...task,
      name: taskData.name !== undefined ? taskData.name : task.name,
      cronExpression: taskData.cronExpression !== undefined ? taskData.cronExpression : task.cronExpression,
      command: taskData.command !== undefined ? taskData.command : task.command,
      timeout: taskData.timeout !== undefined ? taskData.timeout : task.timeout,
      status: taskData.status !== undefined ? taskData.status : task.status,
      dependsOn: taskData.dependsOn !== undefined ? taskData.dependsOn : task.dependsOn,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  deleteTask(id) {
    const dependents = this.getDependentTasks(id);
    for (const depId of dependents) {
      const depTask = this.tasks.get(depId);
      if (depTask && depTask.dependsOn) {
        depTask.dependsOn = depTask.dependsOn.filter(d => d !== id);
        depTask.updatedAt = new Date().toISOString();
      }
    }
    
    return this.tasks.delete(id);
  }

  addExecutionLog(log) {
    this.executionLogs.unshift({
      id: uuidv4(),
      ...log,
      createdAt: new Date().toISOString(),
    });
    if (this.executionLogs.length > 1000) {
      this.executionLogs = this.executionLogs.slice(0, 1000);
    }
  }

  getExecutionLogs(taskId, limit = 20) {
    let logs = this.executionLogs;
    if (taskId) {
      logs = logs.filter(log => log.taskId === taskId);
    }
    return logs.slice(0, limit);
  }

  updateTaskLastExecution(taskId, status, executionId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.lastExecution = new Date().toISOString();
      task.lastStatus = status;
      task.lastExecutionId = executionId;
    }
  }
}

module.exports = new TaskStore();
