import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import createApi from '../services/api'

export function useLODPointCloud(name, apiBase, offsets, camera) {
  const [nodes, setNodes] = useState(new Map())
  const [loading, setLoading] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const [octreeInfo, setOctreeInfo] = useState(null)
  
  const loadedNodesRef = useRef(new Set())
  const loadingNodesRef = useRef(new Set())
  const lastUpdateRef = useRef(0)
  const api = createApi(apiBase)
  
  const loadNodeData = useCallback(async (nodeId) => {
    if (loadedNodesRef.current.has(nodeId) || loadingNodesRef.current.has(nodeId)) {
      return null
    }
    
    loadingNodesRef.current.add(nodeId)
    
    try {
      const response = await api.getOctreeNode(name, nodeId)
      const data = response.data
      
      const positions = new Float32Array(data.positions)
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] -= offsets.x
        positions[i + 1] -= offsets.y
        positions[i + 2] -= offsets.z
      }
      
      const nodeData = {
        id: nodeId,
        positions,
        colors: data.colors ? new Float32Array(data.colors) : null,
        intensities: data.intensities ? new Float32Array(data.intensities) : null,
        classifications: data.classifications ? new Float32Array(data.classifications) : null,
        pointCount: positions.length / 3,
      }
      
      loadedNodesRef.current.add(nodeId)
      return nodeData
    } catch (error) {
      console.error(`Failed to load node ${nodeId}:`, error)
      return null
    } finally {
      loadingNodesRef.current.delete(nodeId)
    }
  }, [name, apiBase, offsets, api])
  
  const updateVisibleNodes = useCallback(async () => {
    if (!name || !camera) return
    
    const now = Date.now()
    if (now - lastUpdateRef.current < 200) return
    lastUpdateRef.current = now
    
    try {
      setLoading(true)
      
      const cameraPos = camera.position.clone()
      const worldCameraPos = {
        x: cameraPos.x + offsets.x,
        y: cameraPos.y + offsets.y,
        z: cameraPos.z + offsets.z,
      }
      
      const response = await api.getVisibleNodes(name, worldCameraPos, 2.0, 30)
      const visibleNodeIds = response.data.node_ids
      
      const newNodes = new Map()
      let newTotalPoints = 0
      
      const loadPromises = visibleNodeIds.map(async (nodeId) => {
        let nodeData = nodes.get(nodeId)
        if (!nodeData) {
          nodeData = await loadNodeData(nodeId)
        }
        if (nodeData) {
          newNodes.set(nodeId, nodeData)
          newTotalPoints += nodeData.pointCount
        }
      })
      
      await Promise.all(loadPromises)
      
      setNodes(newNodes)
      setTotalPoints(newTotalPoints)
      
      const currentNodeIds = new Set(nodes.keys())
      const nodesToUnload = [...currentNodeIds].filter(id => !visibleNodeIds.includes(id))
      for (const id of nodesToUnload.slice(0, 10)) {
        loadedNodesRef.current.delete(id)
      }
      
    } catch (error) {
      console.error('Failed to update visible nodes:', error)
    } finally {
      setLoading(false)
    }
  }, [name, camera, offsets, api, nodes, loadNodeData])
  
  const getAllPositions = useCallback(() => {
    const allPositions = []
    nodes.forEach(node => {
      if (node.positions) {
        allPositions.push(...node.positions)
      }
    })
    return new Float32Array(allPositions)
  }, [nodes])
  
  const getAllOriginalPositions = useCallback(() => {
    const allPositions = []
    nodes.forEach(node => {
      if (node.positions) {
        for (let i = 0; i < node.positions.length; i += 3) {
          allPositions.push(
            node.positions[i] + offsets.x,
            node.positions[i + 1] + offsets.y,
            node.positions[i + 2] + offsets.z
          )
        }
      }
    })
    return new Float32Array(allPositions)
  }, [nodes, offsets])
  
  const reset = useCallback(() => {
    setNodes(new Map())
    setTotalPoints(0)
    loadedNodesRef.current.clear()
    loadingNodesRef.current.clear()
    setOctreeInfo(null)
  }, [])
  
  useEffect(() => {
    if (!name) {
      reset()
      return
    }
    
    api.getOctreeInfo(name)
      .then(response => {
        setOctreeInfo(response.data)
      })
      .catch(error => {
        console.error('Failed to get octree info:', error)
      })
    
    return () => reset()
  }, [name, api, reset])
  
  return {
    nodes,
    loading,
    totalPoints,
    octreeInfo,
    updateVisibleNodes,
    getAllPositions,
    getAllOriginalPositions,
    reset,
  }
}
