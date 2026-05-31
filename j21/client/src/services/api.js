const API_BASE = '/api';

export const uploadVideo = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('video', file);

  const response = await fetch(`${API_BASE}/video/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '上传失败');
  }

  return response.json();
};

export const getRoomInfo = async (roomId) => {
  const response = await fetch(`${API_BASE}/video/room/${roomId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取房间信息失败');
  }

  return response.json();
};

export const getRooms = async () => {
  const response = await fetch(`${API_BASE}/video/rooms`);

  if (!response.ok) {
    throw new Error('获取房间列表失败');
  }

  return response.json();
};

export const exportAnnotations = async (roomId) => {
  const response = await fetch(`${API_BASE}/video/room/${roomId}/export`);

  if (!response.ok) {
    throw new Error('导出批注失败');
  }

  return response.json();
};
