import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { InteractionState, ForceApplication } from '@/types/fluid';

interface UseMouseInteractionOptions {
  camera: THREE.Camera | null;
  domElement: HTMLElement | null;
  onApplyForce: (force: ForceApplication) => void;
  forceRadius?: number;
  forceStrength?: number;
}

export function useMouseInteraction({
  camera,
  domElement,
  onApplyForce,
  forceRadius = 2.0,
  forceStrength = 15.0,
}: UseMouseInteractionOptions) {
  const interactionRef = useRef<InteractionState>({
    isMouseDown: false,
    mousePosition: [0, 0, 0],
    lastMousePosition: [0, 0, 0],
    forceStrength,
    forceRadius,
  });

  const raycaster = useRef(new THREE.Raycaster());
  const mouseNDC = useRef(new THREE.Vector2());

  const updateMousePosition = useCallback((clientX: number, clientY: number) => {
    if (!camera || !domElement) return null;

    const rect = domElement.getBoundingClientRect();
    mouseNDC.current.x = (clientX - rect.left) / rect.width * 2 - 1;
    mouseNDC.current.y = -((clientY - rect.top) / rect.height * 2 - 1);

    raycaster.current.setFromCamera(mouseNDC.current, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.current.ray.intersectPlane(plane, intersection);

    if (intersection) {
      interactionRef.current.lastMousePosition = [
        ...interactionRef.current.mousePosition,
      ] as [number, number, number];
      interactionRef.current.mousePosition = [
        intersection.x, intersection.y, intersection.z,
      ];
      
      return intersection;
    }
    
    return null;
  }, [camera, domElement]);

  const handlePointerDown = useCallback((clientX: number, clientY: number) => {
    const pos = updateMousePosition(clientX, clientY);
    if (!pos) return;

    interactionRef.current.isMouseDown = true;

    const force: ForceApplication = {
      position: [pos.x, pos.y, pos.z],
      direction: [0, 0, 0],
      strength: interactionRef.current.forceStrength * 1.5,
      radius: interactionRef.current.forceRadius,
      type: 'impulse',
      createdAt: Date.now(),
    };

    onApplyForce(force);
  }, [updateMousePosition, onApplyForce]);

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    const pos = updateMousePosition(clientX, clientY);
    if (!pos) return;

    if (interactionRef.current.isMouseDown) {
      const lastPos = interactionRef.current.lastMousePosition;
      const dx = pos.x - lastPos[0];
      const dy = pos.y - lastPos[1];
      const dz = pos.z - lastPos[2];
      const dragDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (dragDist > 0.01) {
        const dragSpeed = dragDist / 0.016;
        const strength = Math.min(dragSpeed * 2, interactionRef.current.forceStrength);
        
        const force: ForceApplication = {
          position: [pos.x, pos.y, pos.z],
          direction: [dx / dragDist, dy / dragDist, dz / dragDist],
          strength,
          radius: interactionRef.current.forceRadius,
          type: 'continuous',
          createdAt: Date.now(),
        };

        onApplyForce(force);
      }
    }
  }, [updateMousePosition, onApplyForce]);

  const handlePointerUp = useCallback(() => {
    interactionRef.current.isMouseDown = false;
  }, []);

  const getMouseWorldPosition = useCallback((): [number, number, number] => {
    return interactionRef.current.mousePosition;
  }, []);

  const getIsMouseDown = useCallback((): boolean => {
    return interactionRef.current.isMouseDown;
  }, []);

  return {
    interactionRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getMouseWorldPosition,
    getIsMouseDown,
  };
}
