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
    this.canvas        = document.getElementById(canvasId);
    this.coordsEl      = document.getElementById(coordsId);
    this.ctx           = this.canvas.getContext('2d');

    // world state
    this.nodes         = [];
    this.connections   = [];
    this.selected      = null;
    this.writing       = null;
    this.pendingBind   = null;
    this.globalId      = 0;

    // camera / pan
    this.cameraOffset  = [0, 0];
    this.isPanning     = false;
    this.panStart      = [0, 0];
    this.cameraStart   = [0, 0];

    // hold-to-drag node
    this.holdTimeout     = null;
    this.draggingNode    = null;
    this.isDraggingNode  = false;

    // canvas scale
    this.sizex         = 0.95;
    this.sizey         = 0.8;

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

    requestAnimationFrame(() => this.loop());
  }

  resize() {
    this.canvas.width  = window.innerWidth  * this.sizex;
    this.canvas.height = window.innerHeight * this.sizey;
    this.draw();
  }

  getMousePos(event) {
    const rect = this.canvas.getBoundingClientRect();
    return [
      event.clientX - rect.left,
      event.clientY - rect.top
    ];
  }

  screenToWorld(screenX, screenY) {
    return [
      screenX - this.cameraOffset[0],
      screenY - this.cameraOffset[1]
    ];
  }

  worldToScreen(worldX, worldY) {
    return [
      worldX + this.cameraOffset[0],
      worldY + this.cameraOffset[1]
    ];
  }

  onMouseMove(event) {
    const [mx, my] = this.getMousePos(event);
    this.mouseX = mx; this.mouseY = my;

    // dragging node
    if (this.isDraggingNode && this.draggingNode) {
      const world = this.screenToWorld(mx, my);
      this.draggingNode.position = world;
    }
    // panning
    else if (this.isPanning) {
      const dx = mx - this.panStart[0];
      const dy = my - this.panStart[1];
      this.cameraOffset[0] = this.cameraStart[0] + dx;
      this.cameraOffset[1] = this.cameraStart[1] + dy;
    }

    // update coords display
    if (this.coordsEl) {
      this.coordsEl.textContent = `${mx} | ${my}`;
    }

    // update cursor
    if (this.isDraggingNode) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.isPanning) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      const world = this.screenToWorld(mx, my);
      const hit = this.nodes.find(n => n.contains(world));
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
    }
  }

  onMouseDown(event) {
    const [mx, my] = this.getMousePos(event);
    const world = this.screenToWorld(mx, my);
    const hit = this.nodes.find(n => n.contains(world));

    if (hit) {
      // start hold-to-drag for node
      this.holdTimeout = setTimeout(() => {
        this.draggingNode   = hit;
        this.isDraggingNode = true;
        this.canvas.style.cursor = 'grabbing';
      }, 500);
    } else {
      // start panning immediately
      this.isPanning    = true;
      this.panStart     = [mx, my];
      this.cameraStart  = [...this.cameraOffset];
      this.canvas.style.cursor = 'grab';
    }
  }

  onMouseUp() {
    // cancel hold timer
    clearTimeout(this.holdTimeout);
    this.holdTimeout = null;

    // stop dragging node
    if (this.isDraggingNode) {
      this.isDraggingNode = false;
      this.draggingNode   = null;
      this.canvas.style.cursor = 'default';
    }
    // stop panning
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
    }
  }

  onClick(event) {
    // ignore click if we just dragged or panned
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
      if (event.shiftKey) {
      this.addNode(world);
      }
    }
    this.draw();
  }

  onKeyUp(e) {
    const key = e.key;
    // delete
    if (key === 'Delete' && this.selected) {
      this.connections = this.selected.delete(this.connections, this.nodes);
      this.selected = null;
      this.writing  = null;
      this.draw();
      return;
    }
    // editing text
    if (this.writing) {
      if (key === 'Enter') {
        this.writing = null;
      } else if (key === 'Backspace') {
        this.writing.text = this.writing.text.slice(0, -1);
        this.draw();
      } else if (key.length === 1) {
        this.writing.text += key;
        this.draw();
      }
      return;
    }
    if (!this.selected) return;
    // bind or enter edit mode
    switch (key) {
      case 'b':
        this.pendingBind = this.selected;
        break;
      case ' ':
        this.writing = this.selected;
        break;
      default:
        break;
    }
  }

  addNode(worldPos) {
    this.nodes.push(new Node(worldPos, this.globalId++));
  }

  select(node) {
    this.selected = node;
    this.writing  = null;
    // bring to front
    this.nodes = this.nodes.filter(n => n !== node).concat(node);
  }

  bind(a, b) {
    if (!this.connections.some(
      ([x,y]) => (x===a&&y===b)||(x===b&&y===a)
    )) {
      this.connections.push([a,b]);
    }
  }

  draw() {
    const { ctx, canvas, cameraOffset } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw connections
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth   = 3;
    this.connections.forEach(([a, b]) => {
      const [ax, ay] = this.worldToScreen(...a.position);
      const [bx, by] = this.worldToScreen(...b.position);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    });

    // draw nodes
    this.nodes.forEach(node => {
      const [sx, sy] = this.worldToScreen(...node.position);
      ctx.beginPath();
      ctx.arc(sx, sy, node.radius, 0, 2*Math.PI);
      ctx.fillStyle = '#96ffff';
      ctx.fill();

      ctx.lineWidth   = (this.selected===node ? 2 : 1);
      ctx.strokeStyle = 'black';
      ctx.stroke();

      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = '20px Arial';
      ctx.fillStyle    = 'black';
      ctx.fillText(node.text, sx, sy);
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
