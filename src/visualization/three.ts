import { BaseGraphVisualizer } from './base';
import type { GraphSnapshot, VisualizationEvents } from './types';

// Dynamic import for three.js to support optional dependency
let THREE: unknown;
let threeAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  THREE = require('three');
  threeAvailable = true;
} catch {
  // three.js is not available - will throw error when class is instantiated
}

/**
 * Three.js implementation of graph visualizer (3D)
 *
 * Features:
 * - 3D force-directed layout
 * - Orbit controls
 * - 3D node and edge rendering
 * - Interactive 3D visualization
 * - Export capabilities
 */
export class ThreeGraphVisualizer extends BaseGraphVisualizer {
  private scene: any | null = null;
  private camera: any | null = null;
  private renderer: any | null = null;
  private controls: any = null; // OrbitControls
  private nodeMeshes: Map<string, any> = new Map();
  private edgeLines: Map<string, any> = new Map();
  private raycaster: any | null = null;
  private mouse: any | null = null;
  private animationId: number | null = null;

  protected async initializeBackend(): Promise<void> {
    if (!threeAvailable) {
      throw new Error('Three.js is not installed. Please install it with: npm install three --save-optional');
    }
    if (!this.container) return;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    // Create camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Create orbit controls
    this.controls = new (await import('three/examples/jsm/controls/OrbitControls.js')).OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = this.options.enableZoom !== false;
    this.controls.enablePan = this.options.enablePan !== false;
    this.controls.enableRotate = true;

    // Create raycaster for mouse interactions
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Add lighting
    this.setupLighting();

    // Setup event handlers
    this.setupEventHandlers();

    // Start animation loop
    this.animate();
  }

  protected async renderBackend(snapshot: GraphSnapshot): Promise<void> {
    if (!this.scene) return;

    // Clear existing objects
    this.clearScene();

    // Create nodes
    snapshot.nodes.forEach((node) => {
      this.createNode(node);
    });

    // Create edges
    snapshot.edges.forEach((edge) => {
      this.createEdge(edge, snapshot.nodes);
    });

    // Apply force simulation
    this.applyForceSimulation(snapshot.nodes, snapshot.edges);
  }

  protected async updateBackend(snapshot: GraphSnapshot): Promise<void> {
    await this.renderBackend(snapshot);
  }

  protected setBackendEvents(_events: VisualizationEvents): void {
    // Events are handled in the setupEventHandlers method
  }

  protected getBackendViewState(): any {
    if (!this.camera || !this.controls) return null;

    return {
      position: this.camera.position.toArray(),
      rotation: this.camera.rotation.toArray(),
      zoom: this.camera.zoom,
    };
  }

  protected setBackendViewState(state: any): void {
    if (!this.camera || !state) return;

    if (state.position) {
      this.camera.position.fromArray(state.position);
    }
    if (state.rotation) {
      this.camera.rotation.fromArray(state.rotation);
    }
    if (state.zoom) {
      this.camera.zoom = state.zoom;
      this.camera.updateProjectionMatrix();
    }
  }

  protected fitBackendToContainer(): void {
    if (!this.scene || !this.camera || !this.controls) return;

    // Calculate bounding box
    const box = new THREE.Box3();
    this.nodeMeshes.forEach((mesh) => {
      box.expandByObject(mesh);
    });

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    this.camera.position.set(center.x, center.y, center.z + cameraZ * 1.5);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  protected centerBackendOnNode(nodeId: string): void {
    if (!this.camera || !this.controls || !this.nodeMeshes.has(nodeId)) return;

    const nodeMesh = this.nodeMeshes.get(nodeId)!;
    const position = nodeMesh.position;

    this.camera.position.set(position.x, position.y, position.z + 50);
    this.camera.lookAt(position);
    this.controls.target.copy(position);
    this.controls.update();
  }

  protected highlightBackendNodes(nodeIds: string[]): void {
    // Reset all nodes
    this.nodeMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        material.emissive.setHex(0x000000);
      }
    });

    // Highlight selected nodes
    nodeIds.forEach((nodeId) => {
      const mesh = this.nodeMeshes.get(nodeId);
      if (mesh) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material.emissive) {
          material.emissive.setHex(0x333333);
        }
      }
    });
  }

  protected clearBackendHighlights(): void {
    this.nodeMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        material.emissive.setHex(0x000000);
      }
    });
  }

  protected async exportBackendImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string> {
    if (!this.renderer) throw new Error('Renderer not initialized');

    // Render the scene
    this.renderer.render(this.scene!, this.camera!);

    // Get canvas data
    const canvas = this.renderer.domElement;

    if (format === 'svg') {
      // Three.js doesn't support SVG export directly
      // Convert canvas to SVG using a library like canvg
      throw new Error('SVG export not supported in Three.js implementation');
    } else {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, options?.quality || 0.8);
      return dataUrl;
    }
  }

  protected destroyBackend(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    this.scene = null;
    this.camera = null;
    this.raycaster = null;
    this.mouse = null;
    this.nodeMeshes.clear();
    this.edgeLines.clear();
  }

  private setupLighting(): void {
    if (!this.scene) return;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Point light
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-50, -50, 50);
    this.scene.add(pointLight);
  }

  private createNode(node: any): void {
    if (!this.scene) return;

    const geometry = new THREE.SphereGeometry(node.size || 5, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: node.color || 0x666666,
      transparent: true,
      opacity: node.opacity || 1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store original data
    (mesh as any).userData = { originalData: node };

    this.scene.add(mesh);
    this.nodeMeshes.set(node.id, mesh);

    // Add label
    this.createNodeLabel(node, mesh);
  }

  private createNodeLabel(node: any, mesh: any): void {
    if (!this.scene) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = '#000000';
    context.font = '24px Arial';
    context.textAlign = 'center';
    context.fillText(node.label, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);

    sprite.position.copy(mesh.position);
    sprite.position.y += (node.size || 5) + 10;
    sprite.scale.set(20, 5, 1);

    this.scene.add(sprite);
  }

  private createEdge(edge: any, nodes: any[]): void {
    if (!this.scene) return;

    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);

    if (!fromNode || !toNode) return;

    const fromMesh = this.nodeMeshes.get(edge.from);
    const toMesh = this.nodeMeshes.get(edge.to);

    if (!fromMesh || !toMesh) return;

    const geometry = new THREE.BufferGeometry().setFromPoints([fromMesh.position, toMesh.position]);

    const material = new THREE.LineBasicMaterial({
      color: edge.color || 0x999999,
      transparent: true,
      opacity: edge.opacity || 0.6,
    });

    const line = new THREE.Line(geometry, material);
    (line as any).userData = { originalData: edge };

    this.scene.add(line);
    this.edgeLines.set(edge.id, line);
  }

  private applyForceSimulation(nodes: any[], edges: any[]): void {
    // Simple force simulation
    const forces = new Map();
    nodes.forEach((node) => {
      forces.set(node.id, new THREE.Vector3());
    });

    // Apply spring forces
    edges.forEach((edge) => {
      const fromMesh = this.nodeMeshes.get(edge.from);
      const toMesh = this.nodeMeshes.get(edge.to);

      if (fromMesh && toMesh) {
        const direction = new THREE.Vector3().subVectors(toMesh.position, fromMesh.position);
        const distance = direction.length();
        const force = direction.normalize().multiplyScalar((distance - 50) * 0.01);

        forces.get(edge.from)!.add(force.clone().multiplyScalar(-1));
        forces.get(edge.to)!.add(force);
      }
    });

    // Apply forces to nodes
    nodes.forEach((node) => {
      const mesh = this.nodeMeshes.get(node.id);
      if (mesh) {
        const force = forces.get(node.id);
        mesh.position.add(force!.multiplyScalar(0.1));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.renderer || !this.raycaster || !this.mouse) return;

    this.renderer.domElement.addEventListener('click', (event: any) => {
      this.handleClick(event);
    });

    this.renderer.domElement.addEventListener('mousemove', (event: any) => {
      this.handleMouseMove(event);
    });
  }

  private handleClick(event: MouseEvent): void {
    if (!this.camera || !this.raycaster || !this.mouse || !this.scene || !this.renderer) return;

    this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children);

    if (intersects.length > 0) {
      const object = intersects[0]?.object;
      if (!object) return;
      const userData = (object as any).userData;

      if (userData?.originalData) {
        if (object instanceof THREE.Mesh && this.events.onNodeClick) {
          this.events.onNodeClick(userData.originalData, event);
        } else if (object instanceof THREE.Line && this.events.onEdgeClick) {
          this.events.onEdgeClick(userData.originalData, event);
        }
      }
    } else if (this.events.onCanvasClick) {
      this.events.onCanvasClick(event);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.camera || !this.raycaster || !this.mouse || !this.scene || !this.renderer) return;

    this.mouse.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children);

    // Handle hover effects
    this.nodeMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        material.emissive.setHex(0x000000);
      }
    });

    if (intersects.length > 0) {
      const object = intersects[0]?.object;
      if (object && object instanceof THREE.Mesh) {
        const material = object.material as THREE.MeshStandardMaterial;
        if (material.emissive) {
          material.emissive.setHex(0x222222);
        }

        const userData = (object as any).userData;
        if (userData?.originalData && this.events.onNodeHover) {
          this.events.onNodeHover(userData.originalData, event);
        }
      }
    }
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private clearScene(): void {
    if (!this.scene) return;

    // Remove all meshes and lines
    this.nodeMeshes.forEach((mesh) => {
      this.scene!.remove(mesh);
    });
    this.edgeLines.forEach((line) => {
      this.scene!.remove(line);
    });

    this.nodeMeshes.clear();
    this.edgeLines.clear();
  }
}
