/**
 * local server entry file, for local development
 */
import { createServer } from 'http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from './types.ts'
import app from './app.js'
import { roomManager } from './roomManager.js'

const PORT = process.env.PORT || 3001
const HEARTBEAT_INTERVAL = 30000
const HEARTBEAT_TIMEOUT = 60000

const server = createServer(app)

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const generateUserId = (): string => {
  return Math.random().toString(36).substring(2, 10)
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('create_room', ({ name }) => {
    try {
      if (!name || name.trim().length === 0) {
        socket.emit('error', '房间名称不能为空')
        return
      }

      const room = roomManager.createRoom(name.trim())
      socket.emit('room_created', room)
      io.emit('room_list', roomManager.getRooms())
    } catch (error) {
      console.error('create_room error:', error)
      socket.emit('error', '创建房间失败')
    }
  })

  socket.on('join_room', ({ roomId, userName }) => {
    try {
      if (!roomId) {
        socket.emit('error', '房间ID不能为空')
        return
      }
      if (!userName || userName.trim().length === 0) {
        socket.emit('error', '用户名不能为空')
        return
      }

      const userId = generateUserId()
      const user = roomManager.joinRoom(roomId, userId, userName.trim(), socket.id)

      if (!user) {
        const room = roomManager.getRoom(roomId)
        if (!room) {
          socket.emit('error', '房间不存在')
        } else {
          socket.emit('error', '房间人数已满（最多10人）')
        }
        return
      }

      socket.join(roomId)
      socket.data.userId = userId
      socket.data.roomId = roomId

      socket.emit('user_joined', user)
      socket.to(roomId).emit('user_joined', user)
      io.emit('room_list', roomManager.getRooms())

      console.log(`User ${user.name} joined room ${roomId}`)
    } catch (error) {
      console.error('join_room error:', error)
      socket.emit('error', '加入房间失败')
    }
  })

  socket.on('leave_room', ({ roomId }) => {
    try {
      const userId = socket.data.userId
      if (!userId || !roomId) {
        return
      }

      const success = roomManager.leaveRoom(roomId, userId)
      if (success) {
        socket.leave(roomId)
        socket.to(roomId).emit('user_left', userId)
        io.emit('room_list', roomManager.getRooms())
        console.log(`User ${userId} left room ${roomId}`)
      }

      delete socket.data.userId
      delete socket.data.roomId
    } catch (error) {
      console.error('leave_room error:', error)
      socket.emit('error', '离开房间失败')
    }
  })

  socket.on('force_field', ({ roomId, force }) => {
    try {
      if (!roomId || !force) {
        socket.emit('error', '无效的力场数据')
        return
      }

      const success = roomManager.addForceField(roomId, force)
      if (!success) {
        socket.emit('error', '房间不存在')
        return
      }

      socket.to(roomId).emit('force_field', force)
    } catch (error) {
      console.error('force_field error:', error)
      socket.emit('error', '发送力场失败')
    }
  })

  socket.on('request_sync', ({ roomId }) => {
    try {
      if (!roomId) {
        socket.emit('error', '房间ID不能为空')
        return
      }

      const forceFields = roomManager.getForceFields(roomId)
      socket.emit('sync_state', { forceFields })
    } catch (error) {
      console.error('request_sync error:', error)
      socket.emit('error', '同步失败')
    }
  })

  socket.on('get_rooms', () => {
    try {
      const rooms = roomManager.getRooms()
      socket.emit('room_list', rooms)
    } catch (error) {
      console.error('get_rooms error:', error)
      socket.emit('error', '获取房间列表失败')
    }
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)

    const userId = socket.data.userId
    const roomId = socket.data.roomId

    if (userId && roomId) {
      const success = roomManager.leaveRoom(roomId, userId)
      if (success) {
        socket.to(roomId).emit('user_left', userId)
        io.emit('room_list', roomManager.getRooms())
        console.log(`User ${userId} removed from room ${roomId} on disconnect`)
      }
    }
  })
})

const heartbeatInterval = setInterval(() => {
  const removed = roomManager.removeInactiveUsers(HEARTBEAT_TIMEOUT)
  for (const { roomId, userId } of removed) {
    io.to(roomId).emit('user_left', userId)
    console.log(`Inactive user ${userId} removed from room ${roomId}`)
  }
  if (removed.length > 0) {
    io.emit('room_list', roomManager.getRooms())
  }
}, HEARTBEAT_INTERVAL)

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`)
  console.log(`Socket.io server running with heartbeat interval: ${HEARTBEAT_INTERVAL}ms`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received')
  clearInterval(heartbeatInterval)
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received')
  clearInterval(heartbeatInterval)
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export default app
