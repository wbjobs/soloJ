class ClassificationAPI {
  constructor(apiClient) {
    this.api = apiClient;
    this.classInfo = null;
    this.classInfoPromise = null;
  }

  async getClassInfo() {
    if (this.classInfo) return this.classInfo;
    if (this.classInfoPromise) return this.classInfoPromise;

    this.classInfoPromise = this.api.request('/classification/classes')
      .then(result => {
        this.classInfo = result;
        return result;
      })
      .catch(error => {
        this.classInfoPromise = null;
        throw error;
      });

    return this.classInfoPromise;
  }

  async classifyPointCloud(pointCloudId, force = false) {
    return this.api.request(`/classification/${pointCloudId}/classify`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }

  async getClassificationStatus(pointCloudId) {
    return this.api.request(`/classification/${pointCloudId}/classification/status`);
  }

  async getClassificationSummary(pointCloudId) {
    return this.api.request(`/classification/${pointCloudId}/classification/summary`);
  }

  async createAnnotation(pointCloudId, annotation) {
    return this.api.request(`/classification/${pointCloudId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(annotation),
    });
  }

  async getAnnotations(pointCloudId, options = {}) {
    const { category, includePoints = false } = options;
    let url = `/classification/${pointCloudId}/annotations?includePoints=${includePoints}`;
    if (category) {
      url += `&category=${encodeURIComponent(category)}`;
    }
    return this.api.request(url);
  }

  async getAnnotation(pointCloudId, annotationId) {
    return this.api.request(`/classification/${pointCloudId}/annotations/${annotationId}`);
  }

  async updateAnnotation(pointCloudId, annotationId, update) {
    return this.api.request(`/classification/${pointCloudId}/annotations/${annotationId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  async deleteAnnotation(pointCloudId, annotationId) {
    return this.api.request(`/classification/${pointCloudId}/annotations/${annotationId}`, {
      method: 'DELETE',
    });
  }

  getDefaultColors() {
    return {
      0: { color: [140 / 255, 140 / 255, 140 / 255], name: 'ground' },
      1: { color: [0 / 255, 180 / 255, 0 / 255], name: 'vegetation' },
      2: { color: [200 / 255, 100 / 255, 50 / 255], name: 'building' },
      3: { color: [255 / 255, 0 / 255, 0 / 255], name: 'vehicle' },
      4: { color: [255 / 255, 255 / 255, 0 / 255], name: 'powerline' },
      5: { color: [150 / 255, 75 / 255, 0 / 255], name: 'furniture' },
      6: { color: [255 / 255, 0 / 255, 255 / 255], name: 'others' },
    };
  }

  getCategoryList() {
    return [
      { id: 0, name: 'ground', color: '#8c8c8c' },
      { id: 1, name: 'vegetation', color: '#00b400' },
      { id: 2, name: 'building', color: '#c86432' },
      { id: 3, name: 'vehicle', color: '#ff0000' },
      { id: 4, name: 'powerline', color: '#ffff00' },
      { id: 5, name: 'furniture', color: '#964b00' },
      { id: 6, name: 'others', color: '#ff00ff' },
    ];
  }
}

export default ClassificationAPI;
