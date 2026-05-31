export class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }

  async uploadAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    try {
      const response = await fetch(`${this.baseUrl}/annotations/upload-audio`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error uploading audio:', err);

      const url = URL.createObjectURL(blob);
      return { url, local: true };
    }
  }

  async getRoomAnnotations(roomId) {
    const response = await fetch(`${this.baseUrl}/annotations/room/${roomId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch annotations: ${response.statusText}`);
    }
    return response.json();
  }

  async createAnnotation(annotationData) {
    const response = await fetch(`${this.baseUrl}/annotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(annotationData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create annotation: ${response.statusText}`);
    }
    return response.json();
  }

  async resolveAnnotation(annotationId) {
    const response = await fetch(`${this.baseUrl}/annotations/${annotationId}/resolve`, {
      method: 'PUT'
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve annotation: ${response.statusText}`);
    }
    return response.json();
  }

  async getRooms() {
    const response = await fetch(`${this.baseUrl}/rooms`);
    if (!response.ok) {
      throw new Error(`Failed to fetch rooms: ${response.statusText}`);
    }
    return response.json();
  }

  async getRoom(roomId) {
    const response = await fetch(`${this.baseUrl}/rooms/${roomId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch room: ${response.statusText}`);
    }
    return response.json();
  }

  async createRoom(roomData) {
    const response = await fetch(`${this.baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(roomData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.statusText}`);
    }
    return response.json();
  }

  async exportAnnotations(roomId, format = 'pdf') {
    const response = await fetch(
      `${this.baseUrl}/export/room/${roomId}/annotations${format === 'json' ? '/json' : ''}`
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    if (format === 'json') {
      return response.json();
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${roomId}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
