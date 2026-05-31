class APIClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(this.baseURL + endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      return response;
    }

    throw new Error('API request failed: ' + response.statusText);
  }

  async listPointClouds() {
    return this.request('/pointcloud/');
  }

  async getPointCloud(id) {
    return this.request('/pointcloud/' + id);
  }

  async uploadLAS(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed: ' + xhr.statusText));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));

      xhr.open('POST', this.baseURL + '/pointcloud/upload');
      xhr.send(formData);
    });
  }

  async queryChunks(pointCloudId, cameraPosition, viewFrustum, options = {}) {
    return this.request('/pointcloud/' + pointCloudId + '/chunks/query', {
      method: 'POST',
      body: JSON.stringify({
        cameraPosition: cameraPosition,
        viewFrustum: viewFrustum,
        ...options
      })
    });
  }

  async getChunkData(pointCloudId, lodLevel, octreeKey) {
    return fetch(this.baseURL + '/pointcloud/' + pointCloudId + '/chunks/' + lodLevel + '/' + octreeKey);
  }
}

export default new APIClient();
