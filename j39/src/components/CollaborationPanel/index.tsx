import React, { useState } from 'react';
import {
  Users,
  Plus,
  LogIn,
  LogOut,
  Lock,
  Unlock,
  RefreshCw,
  Crown,
  Circle,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { useAppStore, Room, User, ConnectionStatus } from '@/store/useAppStore';
import { useSocket } from '@/hooks/useSocket';

const StatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const config = {
    disconnected: { icon: WifiOff, color: 'text-slate-500', bg: 'bg-slate-500/20', label: '未连接' },
    connecting: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-400/20', label: '连接中' },
    connected: { icon: Wifi, color: 'text-green-400', bg: 'bg-green-400/20', label: '已连接' },
    error: { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-400/20', label: '连接错误' },
  };

  const { icon: Icon, color, bg, label } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${color} ${status === 'connecting' ? 'animate-spin' : ''}`} />
      </div>
      <div>
        <p className={`text-sm font-medium ${color}`}>{label}</p>
      </div>
    </div>
  );
};

const RoomCard: React.FC<{
  room: Room;
  onJoin: () => void;
  isJoined: boolean;
}> = ({ room, onJoin, isJoined }) => (
  <div
    className={`p-3 rounded-lg border transition-all cursor-pointer ${
      isJoined
        ? 'bg-cyan-500/20 border-cyan-500/50'
        : 'bg-slate-800/30 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-slate-800/50'
    }`}
    onClick={!isJoined ? onJoin : undefined}
  >
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-medium text-white truncate">{room.name}</h4>
      {room.hasPassword ? (
        <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
      ) : (
        <Unlock className="w-4 h-4 text-slate-500 flex-shrink-0" />
      )}
    </div>
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1 text-slate-400">
        <Users className="w-3 h-3" />
        <span>
          {room.userCount}/{room.maxUsers}
        </span>
      </div>
      {isJoined ? (
        <span className="text-cyan-400">已加入</span>
      ) : (
        <span className="text-cyan-400 flex items-center gap-1">
          <LogIn className="w-3 h-3" />
          加入
        </span>
      )}
    </div>
  </div>
);

const UserListItem: React.FC<{ user: User; isCurrentUser: boolean }> = ({ user, isCurrentUser }) => (
  <div
    className={`flex items-center gap-3 p-2 rounded-lg ${
      isCurrentUser ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-800/30'
    }`}
  >
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${user.color}30`, color: user.color }}
    >
      <Circle className="w-4 h-4" fill="currentColor" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm text-white truncate">{user.name}</p>
        {isCurrentUser && (
          <span className="text-xs text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded">你</span>
        )}
        {user.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
      </div>
      <div className="flex items-center gap-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: user.color }}
        />
        <span className="text-xs text-slate-500 font-mono">{user.id.slice(-6)}</span>
      </div>
    </div>
  </div>
);

export const CollaborationPanel: React.FC = () => {
  const { rooms, users, currentRoom, currentUser } = useAppStore();
  const { connectionStatus, createRoom, joinRoom, leaveRoom, fetchRooms } = useSocket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const handleCreateRoom = () => {
    if (!roomName.trim()) return;
    createRoom(roomName.trim(), roomPassword || undefined);
    setShowCreateModal(false);
    setRoomName('');
    setRoomPassword('');
  };

  const handleJoinRoom = () => {
    if (!selectedRoom || !userName.trim()) return;
    joinRoom(selectedRoom.id, userName.trim(), joinPassword || undefined);
    setShowJoinModal(false);
    setSelectedRoom(null);
    setUserName('');
    setJoinPassword('');
  };

  const openJoinModal = (room: Room) => {
    setSelectedRoom(room);
    setShowJoinModal(true);
  };

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden">
      <div className="p-4 overflow-y-auto flex-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-white">协作面板</h2>
            <p className="text-xs text-slate-400">多人实时流体模拟</p>
          </div>
        </div>

        <div className="mb-6">
          <StatusIndicator status={connectionStatus} />
        </div>

        {currentRoom ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-cyan-400 neon-text">
                当前房间: {currentRoom.name}
              </h3>
              <button
                onClick={leaveRoom}
                className="btn-cyber text-xs flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                离开
              </button>
            </div>

            <div className="mb-4">
              <h4 className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                <Users className="w-3 h-3" />
                在线用户 ({users.length})
              </h4>
              <div className="space-y-2">
                {users.map((user) => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    isCurrentUser={user.id === currentUser?.id}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-cyan-400 neon-text">可用房间</h3>
              <div className="flex gap-2">
                <button
                  onClick={fetchRooms}
                  className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
                  title="刷新"
                >
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-cyber text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  创建
                </button>
              </div>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无可用房间</p>
                <p className="text-xs">点击创建按钮开始协作</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={() => openJoinModal(room)}
                    isJoined={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {currentUser && (
          <div className="p-3 rounded-lg bg-slate-800/30 border border-cyan-500/20">
            <h4 className="text-xs text-slate-400 mb-2">你的信息</h4>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: `${currentUser.color}30`,
                  color: currentUser.color,
                }}
              >
                <Circle className="w-5 h-5" fill="currentColor" />
              </div>
              <div>
                <p className="text-sm text-white">{currentUser.name}</p>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {currentUser.id}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-cyan-400 neon-text mb-4">创建房间</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">房间名称</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="输入房间名称"
                  className="w-full"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  密码 <span className="text-slate-500">(可选)</span>
                </label>
                <input
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="留空创建公开房间"
                  className="w-full"
                  maxLength={20}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 btn-cyber"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateRoom}
                  className="flex-1 btn-cyber active"
                  disabled={!roomName.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-cyan-400 neon-text mb-4">
              加入房间: {selectedRoom.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">你的昵称</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="输入你的昵称"
                  className="w-full"
                  maxLength={20}
                />
              </div>
              {selectedRoom.hasPassword && (
                <div>
                  <label className="block text-sm text-slate-300 mb-2">房间密码</label>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="输入房间密码"
                    className="w-full"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setSelectedRoom(null);
                  }}
                  className="flex-1 btn-cyber"
                >
                  取消
                </button>
                <button
                  onClick={handleJoinRoom}
                  className="flex-1 btn-cyber active"
                  disabled={!userName.trim()}
                >
                  加入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationPanel;
