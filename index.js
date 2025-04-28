// mapApp.js

class Node {
  static defaultRadius = 25;

  constructor(position, id) {
    this.position = { x: position.x, y: position.y };
    this.id       = id;
    this.radius   = Node.defaultRadius;
    this.text     = '';
    this.isRoot   = true;  // will be recalculated each draw
  }

  contains(point) {
    const dx = this.position.x - point.x;
    const dy = this.position.y - point.y;
    return dx*dx + dy*dy <= this.radius*this.radius;
  }

  /** 
   * p1, p2 are world-space corners of the selection rect.
   * Returns true if this node (circle) is fully inside.
   */
  isWithinRectangle(p1, p2) {
    const left   = Math.min(p1.x, p2.x);
    const right  = Math.max(p1.x, p2.x);
    const top    = Math.min(p1.y, p2.y);
    const bottom = Math.max(p1.y, p2.y);

    return (
      this.position.x - this.radius >= left &&
      this.position.x + this.radius <= right &&
      this.position.y - this.radius >= top &&
      this.position.y + this.radius <= bottom
    );
  }

  deleteFrom(nodes, connections) {
    const idx = nodes.indexOf(this);
    if (idx >= 0) nodes.splice(idx, 1);
    return connections.filter(([a, b]) => a !== this && b !== this);
  }
}

class MapApp {
  constructor(canvasId) {
    this.canvas       = document.getElementById(canvasId);
    this.ctx          = this.canvas.getContext('2d');

    // track mouse for in-canvas drawing
    this.mouseX = 0;
    this.mouseY = 0;

    // scene state
    this.nodes        = [];
    this.connections  = [];
    this.isDirected   = false;
    this.isRooted     = true;
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

    // node drag via hold
    this.holdTimer    = null;
    this.dragNode     = null;
    this.isDragging   = false;

    // rectangle selection
    this.isCovering    = false;
    this.coverStart    = { x: 0, y: 0 };
    this.coveredNodes  = [];

    // sizing
    this.sizex        = 0.95;
    this.sizey        = 0.8;

    // operations
    this.rankBy = "size"; // size or depth

    MapApp.instance = this;
  }

  init() {
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    document.addEventListener('mouseup',    () => this._onMouseUp());
    document.addEventListener('click',     e => this._onClick(e));
    document.addEventListener('keydown',   e => this._onKeyDown(e));
    document.addEventListener('keyup',     e => this._onKeyUp(e));
    this.canvas.addEventListener('wheel',  e => this._onWheel(e), { passive: false });

    requestAnimationFrame(() => this._loop());
  }

  addNodeAt(screenX, screenY) {
    const world = this._screenToWorld({ x: screenX, y: screenY });
    this.nodes.push(new Node(world, this.globalId++));
  }

  union(nodeA,nodeB) {
    return this._union(nodeA,nodeB);
  }

  extractMax(root) {
    return this._extractMax(root);
  }

  resize() {
    this._resizeCanvas();
  }

  findRep(node) {
    return this._findRep(node);
  }

  getTreeSize(root) {
    return this._getTreeSize(root);
  }

  getTreeDepth(root) {
    return this._getTreeDepth(root);

  }

  countTreeLeaves(root) {
    return this._countTreeLeaves(root);
  }

  _onMouseMove(evt) {
    const { x: mx, y: my } = this._getMousePos(evt);
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
    if (this.isDragging || this.isPanning || this.isCovering) return;

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
  }

  _onKeyDown(evt) {
    const key = evt.key;
    if (document.activeElement == document.querySelector('textarea')) {
      return;
    }

    // start covering on "s" press
    if (key === 's' && !this.writing) {
      if (!this.isCovering) {
      this.isCovering = true;
      this.coverStart = { x: this.mouseX, y: this.mouseY};
      }
      this._draw();
      return;
    }

    if (key === ' ' && evt.target === document.body) {
      evt.preventDefault();
    }
  }

  _onKeyUp(evt) {
    const key = evt.key;
    if (document.activeElement == document.querySelector('textarea')) {
      return;
    }

    // finish covering on "s" release
    if (key === 's' && this.isCovering) {
      this.isCovering = false;
      this._coverRectangle(this.coverStart, { x: this.mouseX, y: this.mouseY});
      return;
    }

    if (key === 'Delete') {
      // Remove all covered nodes, updating both nodes[] and connections[]
     if (this.coveredNodes.length > 0) {
        this.coveredNodes.forEach(n => {
          // deleteFrom returns a new connections array
          this.connections = n.deleteFrom(this.nodes, this.connections);
        });
        this.coveredNodes = [];
      }
      // Then handle single selected node deletion as before
      if (this.selected) {
        this.connections = this.selected.deleteFrom(this.nodes, this.connections);
        this.selected = this.writing = null;
      }
      return;
    }

    if (this.writing) {
      if (key === 'Enter') this.writing = null;
      else if (key === 'Backspace') this.writing.text = this.writing.text.slice(0, -1);
      else if (key.length === 1) this.writing.text += key;
      return;
    }

    if (key === 'd') {
      this.isDirected = !this.isDirected;
      return;
    }
    if (key === 'r') {
      this.isRooted = !this.isRooted;
      return;
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

    this.offset.x = mx - wx * newScale;
    this.offset.y = my - wy * newScale;
    this.scale    = newScale;
  }

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

  _coverRectangle(pA, pB) {
    // pA, pB are screen coords
    const wA = this._screenToWorld(pA);
    const wB = this._screenToWorld(pB);
    this.coveredNodes = this.nodes.filter(n => n.isWithinRectangle(wA, wB));
  }

  _selectNode(node) {
    this.selected = node;
    this.writing  = null;
    this.nodes = this.nodes.filter(n => n !== node).concat(node);
  }

  _bindNodes(a, b) {
    if (!this.connections.some(([x, y]) => (x===a&&y===b)||(x===b&&y===a))) {
      this.connections.push([a, b]);
    }
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

  _updateRoots() {
    if (!this.isRooted) return;
    this.nodes.forEach(n => n.isRoot = false);

    const neighbors = new Map(this.nodes.map(n => [n, []]));
    this.connections.forEach(([a, b]) => {
      neighbors.get(a).push(b);
      neighbors.get(b).push(a);
    });

    const visited = new Set();
    for (const start of this.nodes) {
      if (visited.has(start)) continue;
      const stack = [start], comp = [];
      visited.add(start);
      while (stack.length) {
        const u = stack.pop();
        comp.push(u);
        for (const v of neighbors.get(u)) {
          if (!visited.has(v)) { visited.add(v); stack.push(v); }
        }
      }
      let root = comp[0];
      let minY = this._worldToScreen(root.position).y;
      for (const n of comp) {
        const y = this._worldToScreen(n.position).y;
        if (y < minY) { minY = y; root = n; }
      }
      root.isRoot = true;
    }
  }

  _drawArrow(ax, ay, bx, by) {
    const ctx   = this.ctx;
    ctx.lineWidth   = 2*this.scale;
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

  _drawRectangle({ x: ax, y: ay }, { x: bx, y: by }) {
    const ctx = this.ctx;
    const left   = Math.min(ax, bx);
    const top    = Math.min(ay, by);
    const width  = Math.abs(bx - ax);
    const height = Math.abs(by - ay);

    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#00BFFF';
    ctx.stroke();
  }

  _draw() {
    const ctx    = this.ctx;
    const w      = this.canvas.width;
    const h      = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // draw coords
    ctx.fillStyle    = 'black';
    ctx.font         = '14px monospace';
    ctx.textAlign    = 'left';    // ← reset to left alignment
    ctx.textBaseline = 'top';
    ctx.fillText(`Coords: ${this.mouseX} | ${this.mouseY}`, 8, 8);


    // draw connections & nodes
    this._updateRoots();
    ctx.strokeStyle = '#f00';
    ctx.lineWidth   = 3*this.scale;
    this.connections.forEach(([a, b]) => {
      const pa = this._worldToScreen(a.position),
            pb = this._worldToScreen(b.position);
      if (this.isDirected) this._drawArrow(pa.x, pa.y, pb.x, pb.y);
      else {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    });

    // highlight covered nodes
    this.nodes.forEach(n => {
      if (this.coveredNodes.includes(n)) {
        const p = this._worldToScreen(n.position);
        ctx.beginPath();
        ctx.arc(p.x, p.y, ((n.radius+ 4) * this.scale), 0, 2*Math.PI);
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth   = 2*this.scale;
        ctx.stroke();
      }
    });

    // draw nodes
    this.nodes.forEach(n => {
      const p = this._worldToScreen(n.position);
      ctx.beginPath();
      ctx.arc(p.x, p.y, n.radius * this.scale, 0, 2*Math.PI);
      ctx.fillStyle  = n.isRoot && this.isRooted ? '#FFD700' : '#66D9FF';
      ctx.fill();
      ctx.strokeStyle= '#000';
      ctx.lineWidth  = (this.selected === n ? 2 : 1)*this.scale;
      ctx.stroke();
      ctx.fillStyle  = '#000';
      ctx.textAlign  = 'center';
      ctx.textBaseline= 'middle';
      ctx.font       = `${20 * this.scale}px Arial`;
      ctx.fillText(n.text, p.x, p.y);
    });

    // draw selection rectangle (during cover drag)
    if (this.isCovering) {
      this._drawRectangle(this.coverStart, { x: this.mouseX, y: this.mouseY });
    }
  }

  _loop() {
    this._draw();
    requestAnimationFrame(() => this._loop());
  }

  _resizeCanvas() {
    this.canvas.width  = window.innerWidth  * this.sizex;
    this.canvas.height = window.innerHeight * this.sizey;
  }

  /**
   * Union the sets containing two nodes
   * Decision of new root is by this.rankBy ('size' or 'depth'), tie-broken by text value.
   */
  _union(nodeA, nodeB) {
    // find their representatives
    const r1 = this.findRep(nodeA), r2 = this.findRep(nodeB);
    if (!r1 || !r2 || r1 === r2) {
      return this.interpreter.appendLog(`"${r1?.text}" and "${r2?.text}" are already in the same set or not found.`,true);
    }

    // helper for tie-breaking by text
    this._tieBreak = (x, y) => {
      const v1 = parseFloat(x.text), v2 = parseFloat(y.text);
      if (!isNaN(v1) && !isNaN(v2)) {
        newRoot = (v1 < v2 ? x : y);
      } else {
        newRoot = (x.text < y.text ? x : y);
      }
      child = (newRoot === x ? y : x);
    };
    
    // pick new root by rankBy then text
    let newRoot, child;
    if (this.rankBy === 'size') {
      const size1  = this._getTreeSize(r1);
      const size2  = this._getTreeSize(r2);
      if (size1 > size2)      { newRoot = r1; child = r2; }
      else if (size2 > size1) { newRoot = r2; child = r1; }
      else this._tieBreak(r1, r2);
    } else {
      const depth1 = this._getTreeDepth(r1);
      const depth2 = this._getTreeDepth(r2);
      if (depth1 > depth2)      { newRoot = r1; child = r2; }
      else if (depth2 > depth1) { newRoot = r2; child = r1; }
      else this._tieBreak(r1, r2);
    }

    // link under newRoot (directed)
    if (!this.connections.some(([a, b]) => a === newRoot && b === child)) {
      this.connections.push([newRoot, child]);
      if (newRoot.position.y >= child.position.y) newRoot.position.y = child.position.y-1;
      this.interpreter.appendLog(`Union by ${this.rankBy}: new root="${newRoot.text}", child="${child.text}"`,true);
    } else {
      this.interpreter.appendLog(`Already connected that way`,true);
    }
  }

    /**
   * Remove and return the maximum‐valued node from the set
   */

  _extractMax(entry) {

  // flood-fill its component
  const comp = new Set(), stack = [entry];
  while (stack.length) {
    const u = stack.pop();
    if (comp.has(u)) continue;
    comp.add(u);
    this.connections.forEach(([a, b]) => {
      if (a === u && !comp.has(b)) stack.push(b);
      if ((!this.isDirected || this.isRooted) && b === u && !comp.has(a)) stack.push(a);
    });
  }

  // find max node
  let maxNode = null;
  comp.forEach(n => {
    if (!maxNode) { maxNode = n; return; }
    const v1 = parseFloat(n.text), v2 = parseFloat(maxNode.text);
    if (!isNaN(v1) && !isNaN(v2)) {
      if (v1 > v2) maxNode = n;
    } else if (n.text > maxNode.text) {
      maxNode = n;
    }
  });
  if (!maxNode) return null;

  // find its parent (directed)
  let parent = null;
  if (this.isDirected && !this.isRooted) {
    const e = this.connections.find(([a,b]) => b === maxNode);
    if (e) parent = e[0];
  }

  // collect its neighbors
  const neighbors = [];
  this.connections.forEach(([a,b]) => {
    if (a === maxNode) neighbors.push(b);
    else if ((!this.isDirected || this.isRooted) && b === maxNode) neighbors.push(a);
  });

  // remove maxNode & its edges
  this.nodes = this.nodes.filter(n => n !== maxNode);
  this.connections = this.connections.filter(
    ([a,b]) => a !== maxNode && b !== maxNode
  );
  if (this.selected === maxNode) this.selected = null;
  this.coveredNodes = this.coveredNodes.filter(n => n !== maxNode);

  // build a binary max-heap from neighbors
  const heap = neighbors.slice().sort((A,B) => {
    const x = parseFloat(A.text), y = parseFloat(B.text);
    if (!isNaN(x) && !isNaN(y)) return y - x;
    return (B.text > A.text ? 1 : -1);
  });

  // helper to link if missing
  const link = (u,v) => {
    if (!this.connections.some(([a,b]) => a===u&&b===v)) {
      this.connections.push([u,v]);
    }
  };

  if (heap.length) {
    // attach heap root under old parent
    if (parent) {
      link(parent, heap[0]);
    }
    // build heap as perfect binary tree
    heap.forEach((node,i) => {
      const left  = 2*i + 1;
      const right = 2*i + 2;
      if (left  < heap.length) link(node, heap[left]);
      if (right < heap.length) link(node, heap[right]);
    });

    // ── reposition heap root above its first child ──
    if (heap.length > 1) {
      const newRoot = heap[0];
      const child   = heap[1];
      if (newRoot.position.y >= child.position.y) {
        newRoot.position.y = child.position.y - 1;
      }
    }
      if (heap.length == 1) {
        const newRoot = heap[0];
          const minDescY = (() => {
          let minY = newRoot.position.y;
          const stack = [newRoot];
          while (stack.length) {
            const u = stack.pop();
            this.connections.forEach(([a, b]) => {
              if (a === u) {
                minY = Math.min(minY, b.position.y);
                stack.push(b);
              }
            });
          }
          return minY;
        })();
        newRoot.position.y = minDescY - 1;
    }

  }

  // recompute roots
  this._updateRoots();

  return maxNode;
}




  _findRep(node) {
    if (this.isDirected && !this.isRooted) {
      let cur = node;
      while (true) {
        const edge = this.connections.find(([a, b]) => b === cur);
        if (!edge) break;
        cur = edge[0];
      }
      return cur;
    } else {
      this._updateRoots();
      return this.nodes.find(n => n.isRoot &&
        // simple component check
        (function inComp(u, v, seen = new Set([u])) {
          if (u === v) return true;
          for (const [a, b] of this.connections) {
            const nbr = (a === u ? b : (b === u ? a : null));
            if (nbr && !seen.has(nbr)) {
              seen.add(nbr);
              if (inComp.call(this, nbr, v, seen)) return true;
            }
          }
          return false;
        }).call(this, n, node)
      );
    }
  }

  _getTreeSize(root) {
    const visited = new Set();
    const stack   = [ root ];

    while (stack.length) {
      const u = stack.pop();
      if (visited.has(u)) continue;
      visited.add(u);

      // for each connection, if it's adjacent to u, push the other end
      this.connections.forEach(([a, b]) => {
        if (a === u && !visited.has(b)) stack.push(b);
        if (b === u && !visited.has(a)) stack.push(a);
      });
    }

    return visited.size;
  }

  _getTreeDepth(root) {
    const visited = new Set();
    let maxDepth = 0;
    // stack holds { node, depth-from-root }
    const stack = [{ node: root, depth: 0 }];
    while (stack.length) {
      const { node, depth } = stack.pop();
      if (visited.has(node)) continue;
      visited.add(node);

      // update the maximum we've seen
      if (depth > maxDepth) maxDepth = depth;

      // explore all adjacent nodes:
      this.connections.forEach(([a, b]) => {
        let neighbor = null;
        if (this.isDirected) {
          // follow directed edges a → b
          if (a === node) neighbor = b;
        } else {
          // treat as undirected
          if (a === node) neighbor = b;
          else if (b === node) neighbor = a;
        }
        if (neighbor && !visited.has(neighbor)) {
          stack.push({ node: neighbor, depth: depth + 1 });
        }
      });
    }
    return maxDepth;
  }

  _countTreeLeaves(root) {
    // Collect all nodes in the same component as `root`
    const seen = new Set();
    const stack = [root];
    while (stack.length) {
      const u = stack.pop();
      if (seen.has(u)) continue;
      seen.add(u);
      // explore both directed children (if directed) or undirected neighbors
      this.connections.forEach(([a, b]) => {
        if (this.isDirected && !this.isRooted) {
          if (a === u && !seen.has(b)) stack.push(b);
        } else {
          if (a === u && !seen.has(b)) stack.push(b);
          if (b === u && !seen.has(a)) stack.push(a);
        }
      });
    }

    // Count leaves
    let leafCount = 0;
    const componentSize = seen.size;
    seen.forEach(node => {
      if (this.isDirected && !this.isRooted) {
        // no outgoing edges?
        const hasChild = this.connections.some(([a, b]) => a === node);
        if (!hasChild) leafCount++;
      } else {
        // undirected: degree = number of connections adjacent to node
        let degree = 0;
        this.connections.forEach(([a, b]) => {
          if (a === node || b === node) degree++;
        });
        // singleton tree → one leaf; otherwise degree === 1 → leaf
        if (componentSize === 1) {
          leafCount = 1;
        } else if (degree === 1) {
          leafCount++;
        }
      }
    });

    return leafCount;
  }

}

// bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new MapApp('map');
  app.init();
});
