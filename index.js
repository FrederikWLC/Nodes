// mapApp.js

class Node {
  static defaultRadius = 25;

  constructor(position, id) {
    // position: { x, y }
    this.position = { x: position.x, y: position.y };
    this.id       = id;
    this.radius   = Node.defaultRadius;
    this.text     = '';
    this.isRoot   = true;  // will be recalculated each draw
  }

  contains(point) {
    const dx = this.position.x - point.x;
    const dy = this.position.y - point.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  deleteFrom(nodes, connections) {
    // remove this node
    const idx = nodes.indexOf(this);
    if (idx >= 0) nodes.splice(idx, 1);
    // remove any connections involving this node
    return connections.filter(([a, b]) => a !== this && b !== this);
  }
}

class MapApp {
  constructor(canvasId) {
    this.canvas       = document.getElementById(canvasId);
    this.ctx          = this.canvas.getContext('2d');

    // Track mouse position for in-canvas draw:
    this.mouseX = 0;
    this.mouseY = 0;

    // scene state
    this.nodes        = [];
    this.connections  = [];
    this.isDirected   = true;
    this.isRooted = true;
    this.selected     = null;
    this.writing      = null;
    this.pendingBind  = null;
    this.globalId     = 0;

    // camera / pan / zoom
    this.offset       = { x: 0, y: 0 };
    this.scale        = 1;
    this.minScale     = 0.2;
    this.maxScale     = 4;
    this.zoomSpeed    = 0.01;
    this.isPanning    = false;
    this.panStart     = { x: 0, y: 0 };
    this.cameraStart  = { x: 0, y: 0 };

    // node-drag via hold
    this.holdTimer    = null;
    this.dragNode     = null;
    this.isDragging   = false;

    // sizing
    this.sizex        = 0.95;
    this.sizey        = 0.8;

    MapApp.instance = this;
  }

  init() {
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this.canvas.addEventListener('mousemove', evt => this._onMouseMove(evt));
    this.canvas.addEventListener('mousedown', evt => this._onMouseDown(evt));
    document.addEventListener('mouseup',    () => this._onMouseUp());
    document.addEventListener('click',     evt => this._onClick(evt));
    document.addEventListener('keyup',     evt => this._onKeyUp(evt));
    document.addEventListener('keydown',     evt => this._onKeyDown(evt));
    this.canvas.addEventListener('wheel',     evt => this._onWheel(evt), { passive: false });

    requestAnimationFrame(() => this._loop());
  }

  // public method to add a node at screen coords
  addNodeAt(screenX, screenY) {
    const world = this._screenToWorld({ x: screenX, y: screenY });
    this.nodes.push(new Node(world, this.globalId++));
  }

  resize() {
    this._resizeCanvas();
  }

  _onMouseMove(evt) {
    const { x: mx, y: my } = this._getMousePos(evt);

    // store for in-canvas display
    this.mouseX = mx;
    this.mouseY = my;

    if (this.isDragging && this.dragNode) {
      const world = this._screenToWorld({ x: mx, y: my });
      this.dragNode.position = world;
    } else if (this.isPanning) {
      this.offset.x = this.cameraStart.x + (mx - this.panStart.x);
      this.offset.y = this.cameraStart.y + (my - this.panStart.y);
    }

    this._updateCursor(mx, my);
  }

  _onMouseDown(evt) {
    const { x: mx, y: my } = this._getMousePos(evt);
    const world = this._screenToWorld({ x: mx, y: my });
    const hit   = this.nodes.find(n => n.contains(world));

    if (hit) {
      this.holdTimer = setTimeout(() => {
        this.dragNode   = hit;
        this.isDragging = true;
        this.canvas.style.cursor = 'grabbing';
      }, 500);
    } else {
      this.isPanning   = true;
      this.panStart    = { x: mx, y: my };
      this.cameraStart = { ...this.offset };
      this.canvas.style.cursor = 'grab';
    }
  }

  _onMouseUp() {
    clearTimeout(this.holdTimer);
    this.holdTimer = null;

    if (this.isDragging) {
      this.isDragging = false;
      this.dragNode   = null;
    }
    if (this.isPanning) {
      this.isPanning = false;
    }
    this.canvas.style.cursor = 'default';
  }

  _onClick(evt) {
    if (this.isDragging || this.isPanning) return;

    const { x: mx, y: my } = this._getMousePos(evt);
    const world = this._screenToWorld({ x: mx, y: my });
    const hit   = this.nodes.find(n => n.contains(world));

    if (hit) {
      this._selectNode(hit);
      if (this.pendingBind && this.pendingBind !== hit) {
        this._bindNodes(this.pendingBind, hit);
        this.pendingBind = null;
      }
    } else {
      this.selected = this.writing = null;
      if (evt.shiftKey) this.addNodeAt(mx, my);
    }

    this._draw();
  }
  _onKeyDown(evt) {
    const key = evt.key;
    if(key === ' ' && evt.target == document.body) {
    evt.preventDefault();
  }

  }
  _onKeyUp(evt) {
    const key = evt.key;
    if (key === 'Delete' && this.selected) {
      this.connections = this.selected.deleteFrom(this.nodes, this.connections);
      this.selected = this.writing = null;
      this._draw();
      return;
    }

    if (this.writing) {
      if (key === 'Enter') this.writing = null;
      else if (key === 'Backspace') this.writing.text = this.writing.text.slice(0, -1);
      else if (key.length === 1) this.writing.text += key;
      this._draw();
      return;
    }

    if (document.activeElement != document.getElementById('interpreter')) {

    if (key === 'd') {
      this.isDirected = !this.isDirected;
      this._draw();
      return;
    }

    if (key === 'r') {
      this.isRooted = !this.isRooted;
      this._draw();
      return;
    }

    }

    if (!this.selected) return;
    if (key === 'b')      this.pendingBind = this.selected;
    else if (key === ' ') this.writing     = this.selected;
  }

  _onWheel(evt) {
    evt.preventDefault();
    const { x: mx, y: my } = this._getMousePos(evt);
    const { x: wx, y: wy } = this._screenToWorld({ x: mx, y: my });

    const factor   = 1 - evt.deltaY * this.zoomSpeed;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));

    // keep cursor world point stationary
    this.offset.x = mx - wx * newScale;
    this.offset.y = my - wy * newScale;
    this.scale    = newScale;

    this._draw();
  }

  // ── Internal Utilities ───────────────────────────────────────────────────────

  _getMousePos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  _screenToWorld({ x: sx, y: sy }) {
    return { x: (sx - this.offset.x) / this.scale, y: (sy - this.offset.y) / this.scale };
  }

  _worldToScreen({ x, y }) {
    return { x: x * this.scale + this.offset.x, y: y * this.scale + this.offset.y };
  }

  _selectNode(node) {
    this.selected = node;
    this.writing  = null;
    // bring to front
    this.nodes = this.nodes.filter(n => n !== node).concat(node);
  }

  _bindNodes(a, b) {
    const exists = this.connections.some(
      ([x, y]) => (x === a && y === b) || (x === b && y === a)
    );
    if (!exists) this.connections.push([a, b]);
  }

  _updateCursor(mx, my) {
    if (this.isDragging || this.isPanning) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    const world = this._screenToWorld({ x: mx, y: my });
    const hit   = this.nodes.find(n => n.contains(world));
    this.canvas.style.cursor = hit ? 'pointer' : 'default';
  }

  /**
   * For each connected component, find the node with minimum screen-Y
   * and mark it as root; clear others.
   */
  _updateRoots() {
    // reset
    this.nodes.forEach(n => n.isRoot = false);

    // adjacency map
    const neighbors = new Map(this.nodes.map(n => [n, []]));
    this.connections.forEach(([a, b]) => {
      neighbors.get(a).push(b);
      neighbors.get(b).push(a);
    });

    const visited = new Set();
    for (const start of this.nodes) {
      if (visited.has(start)) continue;
      // flood fill
      const stack = [start];
      const comp  = [];
      visited.add(start);
      while (stack.length) {
        const n = stack.pop();
        comp.push(n);
        for (const m of neighbors.get(n)) {
          if (!visited.has(m)) {
            visited.add(m);
            stack.push(m);
          }
        }
      }
      // pick highest-on-screen (min Y)
      let root = comp[0];
      let minY = this._worldToScreen(root.position).y;
      for (const n of comp) {
        const y = this._worldToScreen(n.position).y;
        if (y < minY) {
          minY = y;
          root = n;
        }
      }
      root.isRoot = true;
    }
  }

  _drawArrow(ax, ay, bx, by) {
    const ctx   = this.ctx;
    const head  = 10 * this.scale;
    const angle = Math.atan2(by - ay, bx - ax);
    const endX  = bx - Math.cos(angle) * Node.defaultRadius * this.scale;
    const endY  = by - Math.sin(angle) * Node.defaultRadius * this.scale;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - head * Math.cos(angle - Math.PI/6), endY - head * Math.sin(angle - Math.PI/6));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - head * Math.cos(angle + Math.PI/6), endY - head * Math.sin(angle + Math.PI/6));
    ctx.stroke();
  }

  _draw() {
    const ctx           = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    // 1a) draw coords in top-left
    ctx.fillStyle = 'black';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';

    // recompute roots
    this._updateRoots();

    // draw connections
    ctx.strokeStyle = '#f00';
    ctx.lineWidth   = 3;
    this.connections.forEach(([a, b]) => {
      const pa = this._worldToScreen(a.position);
      const pb = this._worldToScreen(b.position);
      if (this.isDirected) {
        this._drawArrow(pa.x, pa.y, pb.x, pb.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    });

    // draw nodes
    this.nodes.forEach(node => {
      const p = this._worldToScreen(node.position);
      ctx.beginPath();
      ctx.arc(p.x, p.y, node.radius * this.scale, 0, Math.PI*2);
      ctx.fillStyle = node.isRoot && this.isRooted ? '#FFD700' : '#96ffff';
      ctx.fill();
      ctx.lineWidth   = this.selected === node ? 2 : 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = `${20 * this.scale}px Arial`;
      ctx.fillStyle    = '#000';
      ctx.fillText(node.text, p.x, p.y);
    });
  }

  _loop() {
    this._draw();
    requestAnimationFrame(() => this._loop());
  }

  _resizeCanvas() {
    this.canvas.width  = window.innerWidth  * this.sizex;
    this.canvas.height = window.innerHeight * this.sizey;
    this._draw();
  }
}

// initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new MapApp('map');
  app.init();
});
