import express, { type Request, type Response } from 'express';
import { validateCommand } from '../utils/blacklist.js';
import { createOutputEvent } from '../utils/commandExecutor.js';
import {
  executeWithProcessManagement,
  isRoomExecuting,
  terminateProcessesByRoom,
} from '../utils/processManager.js';
import {
  startRecording,
  stopRecording,
  recordEvent,
  getRecording,
  isRecording,
  getRecordingStatus,
  getAllRecordings,
  deleteRecording,
} from '../utils/recordingManager.js';
import type {
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  StartRecordingResponse,
  StopRecordingResponse,
  GetRecordingResponse,
} from '../../shared/types.js';

const router = express.Router();

let roomManagerInstance: any = null;

export function setRoomManager(roomManager: any): void {
  roomManagerInstance = roomManager;
}

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { command, room } = req.body as ExecuteCommandRequest;

    if (!roomManagerInstance) {
      return res.status(500).json({
        success: false,
        message: '服务器未初始化',
      } as ExecuteCommandResponse);
    }

    const validation = validateCommand(command);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      } as ExecuteCommandResponse);
    }

    if (isRoomExecuting(room)) {
      return res.status(400).json({
        success: false,
        message: '该房间已有命令正在执行，请稍后再试',
      } as ExecuteCommandResponse);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const commandEvent = createOutputEvent('system', `执行命令: ${command}`, room);
    roomManagerInstance.broadcastOutput(room, commandEvent);
    recordEvent(room, commandEvent, true);
    roomManagerInstance.broadcastExecutionStart(room, executionId);

    executeWithProcessManagement(command, room, executionId, {
      onStdout: (data) => {
        const event = createOutputEvent('stdout', data, room);
        roomManagerInstance.broadcastOutput(room, event);
        recordEvent(room, event);
      },
      onStderr: (data) => {
        const event = createOutputEvent('stderr', data, room);
        roomManagerInstance.broadcastOutput(room, event);
        recordEvent(room, event);
      },
      onExit: (code) => {
        const exitEvent = createOutputEvent(
          'system',
          `命令执行完成，退出码: ${code ?? 'unknown'}`,
          room
        );
        roomManagerInstance.broadcastOutput(room, exitEvent);
        recordEvent(room, exitEvent);
        roomManagerInstance.broadcastExecutionEnd(room, executionId, code);
      },
      onError: (error) => {
        const event = createOutputEvent('stderr', `执行错误: ${error.message}`, room);
        roomManagerInstance.broadcastOutput(room, event);
        recordEvent(room, event);
        roomManagerInstance.broadcastExecutionEnd(room, executionId, -1);
      },
    });

    res.json({
      success: true,
      executionId,
    } as ExecuteCommandResponse);
  } catch (error) {
    console.error('Execute command error:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    } as ExecuteCommandResponse);
  }
});

router.post('/stop/:room', (req: Request, res: Response) => {
  try {
    const { room } = req.params;
    terminateProcessesByRoom(room);
    
    if (roomManagerInstance) {
      roomManagerInstance.broadcastSystemMessage(room, '命令已被终止');
    }

    res.json({
      success: true,
      message: '已终止该房间的所有进程',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.get('/history/:room', (req: Request, res: Response) => {
  try {
    const { room } = req.params;
    if (!roomManagerInstance) {
      return res.status(500).json({
        success: false,
        message: '服务器未初始化',
      });
    }
    const history = roomManagerInstance.getRoomHistory(room);
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.post('/recording/start', (req: Request, res: Response) => {
  try {
    const { room } = req.body as { room: string };
    if (!room) {
      return res.status(400).json({
        success: false,
        message: '缺少房间号',
      } as StartRecordingResponse);
    }
    const result = startRecording(room);
    if (roomManagerInstance) {
      roomManagerInstance.broadcastSystemMessage(room, result.message || '录制状态已更新');
    }
    res.json({
      ...result,
      recording: result.success,
    } as StartRecordingResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    } as StartRecordingResponse);
  }
});

router.post('/recording/stop', (req: Request, res: Response) => {
  try {
    const { room } = req.body as { room: string };
    if (!room) {
      return res.status(400).json({
        success: false,
        message: '缺少房间号',
      } as StopRecordingResponse);
    }
    const result = stopRecording(room);
    if (roomManagerInstance && result.success) {
      roomManagerInstance.broadcastSystemMessage(
        room,
        `录制已完成，Session ID: ${result.sessionId}`
      );
    }
    res.json({
      ...result,
      recording: !result.success,
    } as StopRecordingResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    } as StopRecordingResponse);
  }
});

router.get('/recording/status/:room', (req: Request, res: Response) => {
  try {
    const { room } = req.params;
    const status = getRecordingStatus(room);
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.get('/recording/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = getRecording(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '录制会话不存在',
      } as GetRecordingResponse);
    }
    res.json({
      success: true,
      session,
    } as GetRecordingResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    } as GetRecordingResponse);
  }
});

router.get('/recordings', (_req: Request, res: Response) => {
  try {
    const recordings = getAllRecordings();
    res.json({
      success: true,
      data: recordings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

router.delete('/recording/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const deleted = deleteRecording(sessionId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '录制会话不存在',
      });
    }
    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
    });
  }
});

export default router;
