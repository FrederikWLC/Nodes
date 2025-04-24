class Node {
  constructor(position, id) {
    this.position = position;
    this.id = id;
    this.radius = 25;
    this.text = '';
  }

  contains(point) {
    const dx = this.position[0] - point[0];
    const dy = this.position[1] - point[1];
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  delete(connections, nodes) {
    // remove node
    const idx = nodes.indexOf(this);
    if (idx >= 0) nodes.splice(idx, 1);
    // remove related connections
    return connections.filter(([a, b]) => a !== this && b !== this);
  }
}

class MapApp {
  constructor(canvasId, coordsId) {
    this.canvas = document.getElementById(canvasId);
    this.coordsEl = document.getElementById(coordsId);
    this.ctx = this.canvas.getContext('2d');

    this.nodes = [];
    this.connections = [];
    this.selected = null;
    this.writing = null;
    this.pendingBind = null;
    this.globalId = 0;

    this.sizex = 0.95;
    this.sizey = 0.8;
    
    // expose instance for external access
    MapApp.instance = this;
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
    this.canvas.addEventListener('click', e => this.onClick(e));
    document.addEventListener('keyup', e => this.onKeyUp(e));
    requestAnimationFrame(() => this.loop());
  }

  resize() {
    this.canvas.width = window.innerWidth * this.sizex;
    this.canvas.height = window.innerHeight * this.sizey;
    this.draw();
  }

  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
    if (this.coordsEl) {
      this.coordsEl.textContent = `${this.mouseX} | ${this.mouseY}`;
    }
  }

  onClick() {
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
      this.writing = null;
      this.addNode(pos);
    }
    this.draw();
  }

  onKeyUp(e) {
    if (e.key === 'Delete' && this.selected) {
      this.connections = this.selected.delete(this.connections, this.nodes);
      this.selected = null;
      this.writing = null;
      this.draw();
      return;
    }
    if (this.writing) {
      if (e.key === 'Enter') {
        this.writing = null;
      } else if (e.key === 'Backspace') {
        this.writing.text = this.writing.text.slice(0, -1);
        this.draw();
      } else if (e.key.length === 1) {
        this.writing.text += e.key;
        this.draw();
      }
      return;
    }
    if (!this.selected) return;

    switch (e.key) {
      case 'b':
        this.pendingBind = this.selected;
        break;
      case ' ': // space to edit
        this.writing = this.selected;
        break;
      default:
        break;
    }
  }

  addNode(position) {
    const node = new Node(position, this.globalId++);
    this.nodes.push(node);
  }

  select(node) {
    this.selected = node;
    this.writing = null;
    // move to top
    //this.nodes = this.nodes.filter(n => n !== node).concat(node);
  }



  bind(a, b) {
    if (!this.connections.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
      this.connections.push([a, b]);
    }
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw connections
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    this.connections.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(...a.position);
      ctx.lineTo(...b.position);
      ctx.stroke();
    });

    // draw nodes
    this.nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(...node.position, node.radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#96ffff';
      ctx.fill();

      ctx.lineWidth = this.selected === node ? 2 : 1;
      ctx.strokeStyle = 'black';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '20px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText(node.text, ...node.position);
    });
  }

  loop() {
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

// initialize on load
window.addEventListener('DOMContentLoaded', () => {
  const app = new MapApp('map', 'cords');
  app.init();
});
