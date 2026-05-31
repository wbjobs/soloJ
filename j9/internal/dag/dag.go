package dag

import (
	"dtask/internal/redis"
	"dtask/internal/task"
	"fmt"
	"strings"
)

type Graph struct {
	nodes map[string]*task.Task
	edges map[string][]string
}

func NewGraph() *Graph {
	return &Graph{
		nodes: make(map[string]*task.Task),
		edges: make(map[string][]string),
	}
}

func (g *Graph) AddNode(t *task.Task) {
	g.nodes[t.ID] = t
	g.edges[t.ID] = t.Dependencies
}

func (g *Graph) HasCycle() (bool, []string) {
	visited := make(map[string]bool)
	recStack := make(map[string]bool)
	path := []string{}

	for id := range g.nodes {
		if !visited[id] {
			if hasCycle, cyclePath := g.dfs(id, visited, recStack, path); hasCycle {
				return true, cyclePath
			}
		}
	}
	return false, nil
}

func (g *Graph) dfs(id string, visited, recStack map[string]bool, path []string) (bool, []string) {
	visited[id] = true
	recStack[id] = true
	path = append(path, id)

	for _, dep := range g.edges[id] {
		if _, exists := g.nodes[dep]; !exists {
			continue
		}
		if !visited[dep] {
			if hasCycle, cyclePath := g.dfs(dep, visited, recStack, path); hasCycle {
				return true, cyclePath
			}
		} else if recStack[dep] {
			cycleStart := 0
			for i, p := range path {
				if p == dep {
					cycleStart = i
					break
				}
			}
			cyclePath := append(path[cycleStart:], dep)
			return true, cyclePath
		}
	}

	recStack[id] = false
	path = path[:len(path)-1]
	return false, nil
}

func (g *Graph) CheckDependenciesReady(id string) (bool, []string) {
	t, exists := g.nodes[id]
	if !exists {
		return false, []string{"task not found"}
	}

	unmet := []string{}
	for _, depID := range t.Dependencies {
		depTask, exists := g.nodes[depID]
		if !exists {
			unmet = append(unmet, fmt.Sprintf("%s (not found)", depID))
			continue
		}
		if depTask.Status != task.StatusDone {
			unmet = append(unmet, fmt.Sprintf("%s (%s)", depID, depTask.Status))
		}
	}

	return len(unmet) == 0, unmet
}

func (g *Graph) PrintTree(rootID string) string {
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("Task Dependency Graph: %s\n", rootID))
	printed := make(map[string]bool)
	g.printNode(&builder, rootID, "", true, printed)
	return builder.String()
}

func (g *Graph) printNode(builder *strings.Builder, id string, prefix string, isLast bool, printed map[string]bool) {
	t, exists := g.nodes[id]
	if !exists {
		builder.WriteString(fmt.Sprintf("%s└── %s (not found)\n", prefix, id))
		return
	}

	statusColor := ""
	statusReset := ""
	switch t.Status {
	case task.StatusDone:
		statusColor = "\033[32m"
	case task.StatusRunning:
		statusColor = "\033[33m"
	case task.StatusFailed:
		statusColor = "\033[31m"
	default:
		statusColor = "\033[37m"
	}
	statusReset = "\033[0m"

	connector := "├── "
	if isLast {
		connector = "└── "
	}

	builder.WriteString(fmt.Sprintf("%s%s%s%s [%s%s%s]\n",
		prefix, connector, t.ID, statusReset,
		statusColor, t.Status, statusReset))

	if printed[id] {
		if len(t.Dependencies) > 0 {
			builder.WriteString(fmt.Sprintf("%s%s    (already printed)\n", prefix, "│   "))
		}
		return
	}
	printed[id] = true

	if len(t.Dependencies) > 0 {
		newPrefix := prefix
		if isLast {
			newPrefix += "    "
		} else {
			newPrefix += "│   "
		}

		for i, depID := range t.Dependencies {
			isLastDep := i == len(t.Dependencies)-1
			g.printNode(builder, depID, newPrefix, isLastDep, printed)
		}
	}
}

func BuildGraphFromRedis(rdb *redis.Client, taskID string, maxDepth int) (*Graph, error) {
	g := NewGraph()
	visited := make(map[string]bool)
	queue := []string{taskID}
	depth := 0

	for len(queue) > 0 && depth < maxDepth {
		levelSize := len(queue)
		for i := 0; i < levelSize; i++ {
			id := queue[i]
			if visited[id] {
				continue
			}
			visited[id] = true

			taskData, err := rdb.GetTask(id)
			if err != nil {
				continue
			}

			t, err := task.Unmarshal(taskData)
			if err != nil {
				continue
			}

			g.AddNode(t)

			for _, depID := range t.Dependencies {
				if !visited[depID] {
					queue = append(queue, depID)
				}
			}
		}
		queue = queue[levelSize:]
		depth++
	}

	return g, nil
}

func DetectCyclicDependency(rdb *redis.Client, newTaskID string, deps []string) (bool, []string, error) {
	g := NewGraph()

	for _, depID := range deps {
		taskData, err := rdb.GetTask(depID)
		if err != nil {
			continue
		}
		t, err := task.Unmarshal(taskData)
		if err != nil {
			continue
		}
		g.AddNode(t)
	}

	newTask := &task.Task{
		ID:           newTaskID,
		Dependencies: deps,
	}
	g.AddNode(newTask)

	hasCycle, path := g.HasCycle()
	return hasCycle, path, nil
}
