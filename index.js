// mapApp.js

class Node {
  constructor(position, id) {
    this.position = position; // world coordinates [x, y]
    this.id       = id;
    this.radius   = 25;
    this.text     = '';
  }

  contains(worldPoint) {
    const dx = this.position[0] - worldPoint[0];
    const dy = this.position[1] - worldPoint[1];
    return dx*dx + dy*dy <= this.radius * this.radius;
  }

  delete(connections, nodes) {
    // remove this node
    const i = nodes.indexOf(this);
    if (i >= 0) nodes.splice(i, 1);
    // remove related connections
    return connections.filter(([a, b]) => a !== this && b !== this);
  }
}

class MapApp {
  constructor(canvasId, coordsId) {
    this.canvas       = document.getElementById(canvasId);
    this.coordsEl     = document.getElementById(coordsId);
    this.ctx          = this.canvas.getContext('2d');

    // scene state
    this.nodes        = [];
    this.connections  = [];
    this.selected     = null;
    this.writing      = null;
    this.pendingBind  = null;
    this.globalId     = 0;

    // camera / pan / zoom
    this.cameraOffset = [0, 0];
    this.scale        = 1;
    this.minScale     = 0.2;
    this.maxScale     = 4;
    this.isPanning    = false;
    this.panStart     = [0, 0];
    this.cameraStart  = [0, 0];
    this.zoomConstant = 0.01;

    // node-drag via hold
    this.holdTimeout    = null;
    this.draggingNode   = null;
    this.isDraggingNode = false;

    this.sizex = 0.95;
    this.sizey = 0.8;

    MapApp.instance = this;
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
    this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
    document.addEventListener('mouseup',   () => this.onMouseUp());
    this.canvas.addEventListener('click',     e => this.onClick(e));
    document.addEventListener('keyup',    e => this.onKeyUp(e));
    // **new**: zoom on wheel
    this.canvas.addEventListener('wheel',    e => this.onWheel(e), { passive: false });

    requestAnimationFrame(() => this.loop());
  }

  resize() {
    this.canvas.width  = window.innerWidth  * this.sizex;
    this.canvas.height = window.innerHeight * this.sizey;
    this.draw();
  }

  getMousePos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    return [
      evt.clientX - rect.left,
      evt.clientY - rect.top
    ];
  }

  screenToWorld(sx, sy) {
    return [
      (sx - this.cameraOffset[0]) / this.scale,
      (sy - this.cameraOffset[1]) / this.scale
    ];
  }

  worldToScreen(wx, wy) {
    return [
      wx * this.scale + this.cameraOffset[0],
      wy * this.scale + this.cameraOffset[1]
    ];
  }

  onWheel(e) {
    e.preventDefault();
    const [mx, my] = this.getMousePos(e);
    const [wx, wy] = this.screenToWorld(mx, my);

    // adjust scale
    const delta = - e.deltaY * this.zoomConstant;          // tweak zoom speed here
    let newScale = this.scale * (1 + delta);
    newScale = Math.min(this.maxScale, Math.max(this.minScale, newScale));

    // adjust offset so that (wx,wy) stays under the cursor
    this.cameraOffset[0] = mx - wx * newScale;
    this.cameraOffset[1] = my - wy * newScale;

    this.scale = newScale;
    this.draw();
  }

  onMouseMove(evt) {
    const [mx, my] = this.getMousePos(evt);
    this.mouseX = mx; this.mouseY = my;

    if (this.isDraggingNode && this.draggingNode) {
      const world = this.screenToWorld(mx, my);
      this.draggingNode.position = world;
    }
    else if (this.isPanning) {
      const dx = mx - this.panStart[0];
      const dy = my - this.panStart[1];
      this.cameraOffset[0] = this.cameraStart[0] + dx;
      this.cameraOffset[1] = this.cameraStart[1] + dy;
    }

    if (this.coordsEl) {
      this.coordsEl.textContent = `${mx} | ${my}`;
    }

    // cursor feedback
    if (this.isDraggingNode || this.isPanning) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      const world = this.screenToWorld(mx, my);
      const hit = this.nodes.find(n => n.contains(world));
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
    }
  }

  onMouseDown(evt) {
    const [mx, my] = this.getMousePos(evt);
    const world = this.screenToWorld(mx, my);
    const hit = this.nodes.find(n => n.contains(world));

    if (hit) {
      this.holdTimeout = setTimeout(() => {
        this.draggingNode   = hit;
        this.isDraggingNode = true;
        this.canvas.style.cursor = 'grabbing';
      }, 500);
    } else {
      this.isPanning   = true;
      this.panStart    = [mx, my];
      this.cameraStart = [...this.cameraOffset];
      this.canvas.style.cursor = 'grab';
    }
  }

  onMouseUp() {
    clearTimeout(this.holdTimeout);
    this.holdTimeout = null;

    if (this.isDraggingNode) {
      this.isDraggingNode = false;
      this.draggingNode   = null;
    }
    if (this.isPanning) {
      this.isPanning = false;
    }
    this.canvas.style.cursor = 'default';
  }

  onClick(evt) {
    if (this.isDraggingNode || this.isPanning) return;

    const world = this.screenToWorld(this.mouseX, this.mouseY);
    const hit   = this.nodes.find(n => n.contains(world));

    if (hit) {
      this.select(hit);
      if (this.pendingBind && this.pendingBind !== hit) {
        this.bind(this.pendingBind, hit);
        this.pendingBind = null;
      }
    } else {
      this.selected = null;
      this.writing  = null;
      // only add on Shift+click
      if (evt.shiftKey) this.addNode(world);
    }
    this.draw();
  }

  onKeyUp(e) {
    const key = e.key;
    if (key === 'Delete' && this.selected) {
      this.connections = this.selected.delete(this.connections, this.nodes);
      this.selected = null;
      this.writing  = null;
      this.draw();
      return;
    }
    if (this.writing) {
      if (key === 'Enter') this.writing = null;
      else if (key === 'Backspace') {
        this.writing.text = this.writing.text.slice(0, -1);
        this.draw();
      }
      else if (key.length === 1) {
        this.writing.text += key;
        this.draw();
      }
      return;
    }
    if (!this.selected) return;
    switch (key) {
      case 'b': this.pendingBind = this.selected; break;
      case ' ': this.writing    = this.selected; break;
    }
  }

  addNode(worldPos) {
    this.nodes.push(new Node(worldPos, this.globalId++));
  }

  select(node) {
    this.selected = node;
    this.writing  = null;
    this.nodes = this.nodes.filter(n => n !== node).concat(node);
  }

  bind(a, b) {
    if (!this.connections.some(([x,y]) => (x===a&&y===b)||(x===b&&y===a))) {
      this.connections.push([a,b]);
    }
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw connections
    ctx.strokeStyle = '#f00';
    ctx.lineWidth   = 3;
    this.connections.forEach(([a,b]) => {
      const [ax, ay] = this.worldToScreen(...a.position);
      const [bx, by] = this.worldToScreen(...b.position);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    });

    // draw nodes
    this.nodes.forEach(n => {
      const [sx, sy] = this.worldToScreen(...n.position);
      ctx.beginPath();
      ctx.arc(sx, sy, n.radius * this.scale, 0, 2*Math.PI);
      ctx.fillStyle = '#96ffff';
      ctx.fill();

      ctx.lineWidth   = (this.selected===n ? 2 : 1);
      ctx.strokeStyle = '#000';
      ctx.stroke();

      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = `${20 * this.scale}px Arial`;
      ctx.fillStyle    = '#000';
      ctx.fillText(n.text, sx, sy);
    });
  }

  loop() {
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

// initialize
window.addEventListener('DOMContentLoaded', () => {
  const app = new MapApp('map', 'cords');
  app.init();
});
