// mapApp.js

class Node {
  constructor(position, id) {
    this.position = position;
    this.id       = id;
    this.radius   = 25;
    this.text     = '';
  }

  contains(point) {
    const dx = this.position[0] - point[0];
    const dy = this.position[1] - point[1];
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  delete(connections, nodes) {
    // remove this node
    const idx = nodes.indexOf(this);
    if (idx >= 0) nodes.splice(idx, 1);
    // remove any connections involving this node
    return connections.filter(([a, b]) => a !== this && b !== this);
  }
}

class MapApp {
  constructor(canvasId, coordsId) {
    this.canvas        = document.getElementById(canvasId);
    this.coordsEl      = document.getElementById(coordsId);
    this.ctx           = this.canvas.getContext('2d');
    this.nodes         = [];
    this.connections   = [];
    this.selected      = null;
    this.writing       = null;
    this.pendingBind   = null;
    this.globalId      = 0;
    this.sizex         = 0.95;
    this.sizey         = 0.8;

    // HOLD-TO-DRAG state
    this.holdTimeout   = null;
    this.draggingNode  = null;
    this.isDragging    = false;

    MapApp.instance = this;
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // track mouse for coords
    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
    // hold-to-drag start
    this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
    // cancel hold or end drag
    document.addEventListener('mouseup', () => this.onMouseUp());
    // handle click (select / add / bind)
    this.canvas.addEventListener('click', e => this.onClick(e));
    // keyboard actions
    document.addEventListener('keyup', e => this.onKeyUp(e));

    requestAnimationFrame(() => this.loop());
  }

  resize() {
    this.canvas.width  = window.innerWidth  * this.sizex;
    this.canvas.height = window.innerHeight * this.sizey;
    this.draw();
  }

  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    // if dragging, move node
    if (this.isDragging && this.draggingNode) {
      this.draggingNode.position = [ this.mouseX, this.mouseY ];
    }

    // update coords display
    if (this.coordsEl) {
      this.coordsEl.textContent = `${this.mouseX} | ${this.mouseY}`;
    }

    // update cursor
    if (this.isDragging) {
      this.canvas.style.cursor = 'grabbing';
    } else {
      const hit = this.nodes.find(n => n.contains([this.mouseX, this.mouseY]));
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
    }
  }

  onMouseDown(event) {
    // detect press-and-hold on a node
    const pos = [this.mouseX, this.mouseY];
    const hit = this.nodes.find(n => n.contains(pos));
    if (!hit) return;

    this.holdTimeout = setTimeout(() => {
      this.draggingNode = hit;
      this.isDragging   = true;
      this.canvas.style.cursor = 'grabbing';
    }, 500);
  }

  onMouseUp() {
    // cancel pending hold
    clearTimeout(this.holdTimeout);
    this.holdTimeout = null;

    // if was dragging, stop
    if (this.isDragging) {
      this.isDragging   = false;
      this.draggingNode = null;
      this.canvas.style.cursor = 'default';
    }
  }

  onClick(event) {
    // if we just started drag, ignore click
    if (this.isDragging) return;

    const pos = [this.mouseX, this.mouseY];
    const hit = this.nodes.find(n => n.contains(pos));
    if (hit) {
      this.select(hit);
      if (this.pendingBind && this.pendingBind !== hit) {
        this.bind(this.pendingBind, hit);
        this.pendingBind = null;
      }
    } else {
      this.selected = null;
      this.writing  = null;
      this.addNode(pos);
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
    // no node selected: ignore
    if (!this.selected) return;

    switch (key) {
      case 'b':
        this.pendingBind = this.selected;
        break;
      case ' ':
        this.writing = this.selected;
        break;
    }
  }

  addNode(position) {
    this.nodes.push(new Node(position, this.globalId++));
  }

  select(node) {
    this.selected = node;
    this.writing  = null;
    // bring to front
    this.nodes = this.nodes.filter(n => n !== node).concat(node);
  }

  bind(a, b) {
    if (!this.connections.some(
      ([x,y]) => (x===a && y===b) || (x===b && y===a)
    )) {
      this.connections.push([a, b]);
    }
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // connections
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth   = 3;
    this.connections.forEach(([a,b]) => {
      ctx.beginPath();
      ctx.moveTo(...a.position);
      ctx.lineTo(...b.position);
      ctx.stroke();
    });

    // nodes
    this.nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(...node.position, node.radius, 0, 2*Math.PI);
      ctx.fillStyle = '#96ffff';
      ctx.fill();

      ctx.lineWidth   = (this.selected === node ? 2 : 1);
      ctx.strokeStyle = 'black';
      ctx.stroke();

      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = '20px Arial';
      ctx.fillStyle    = 'black';
      ctx.fillText(node.text, ...node.position);
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
