// interpreter.js

window.addEventListener('DOMContentLoaded', () => {
  // 1) Initialize the MapApp instance
  const app = new MapApp('map', 'cords');
  app.init();

  // 2) Wire up the interpreter textarea + log
  const ta = document.getElementById('interpreter');
  const log = document.getElementById('log');

  function appendLog(line,isResponse=false) {
    const entry = document.createElement('div');
    if (isResponse) entry.textContent = `${line}`;
    else entry.textContent = `> ${line}`;
    log.appendChild(entry);
    // auto-scroll to bottom
    log.scrollTop = log.scrollHeight;
  }

  ta.addEventListener('keydown', e => {
    // run on Ctrl+Enter (or Cmd+Enter)
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = ta.value.trim();
      if (!code) return;

      // split into lines, run each
      code.split('\n').forEach(line => {
        const [cmd, ...args] = line.trim().split(/\s+/);
        appendLog(line);

        switch (cmd) {
          
          case 'addNode': {
            const x = parseFloat(args[0]), y = parseFloat(args[1]);
            if (!isNaN(x) && !isNaN(y)) app.addNodeAt(x, y);
            break;
          }
          
          case 'find': {
            // ensure all isRoot flags are correct
            app._updateRoots();

            // figure out which nodes to run on
            const name = args.join(' ');
            const targets = name
              ? [app.nodes.find(n => n.text === name)].filter(Boolean)
              : app.coveredNodes.length
                ? app.coveredNodes
                : app.selected
                  ? [app.selected]
                  : [];

            if (!targets.length) {
              appendLog(`No node found to lookup`, true);
              break;
            }

            targets.forEach(node => {
              let rep = node;

              if (app.isDirected && !app.isRooted) {
                // follow the single incoming parent pointer until none left
                while (true) {
                  // find any edge a → rep
                  const edge = app.connections.find(([a, b]) => b === rep);
                  if (!edge) break;
                  rep = edge[0];
                }
              } else {
                // undirected: BFS to collect component, then pick the one isRoot
                const adj = new Map(app.nodes.map(n => [n, []]));
                app.connections.forEach(([a, b]) => {
                  adj.get(a).push(b);
                  adj.get(b).push(a);
                });

                // flood-fill component from node
                const queue = [node];
                const seen = new Set([node]);
                while (queue.length) {
                  const u = queue.shift();
                  for (const v of adj.get(u)) {
                    if (!seen.has(v)) {
                      seen.add(v);
                      queue.push(v);
                    }
                  }
                }

                // among component, find the one flagged isRoot
                const roots = Array.from(seen).filter(n => n.isRoot);
                if (roots.length) {
                  rep = roots[0];
                }
              }

              appendLog(
                `Representative of "${node.text}": "${rep.text}"`,
                true
              );
            });

            break;
          }

          case 'union': {
            // parse two node identifiers
            let [nameA, nameB] = args;
            let nodesToUnion = [];

            if (nameA && nameB) {
              // explicit names
              const a = app.nodes.find(n => n.text === nameA);
              const b = app.nodes.find(n => n.text === nameB);
              if (a && b) nodesToUnion = [a, b];
            } else if (app.coveredNodes.length === 2) {
              // exactly two covered
              nodesToUnion = app.coveredNodes.slice(0, 2);
            } else if (app.selected) {
              appendLog('► union needs two nodes (either names or 2 covered)', true);
              break;
            }

            if (nodesToUnion.length !== 2) {
              appendLog('► cannot identify two nodes to union', true);
              break;
            }

            // helper: find representative
            function findRep(node) {
              if (app.isDirected) {
                let cur = node;
                while (true) {
                  const e = app.connections.find(([a,b]) => b === cur);
                  if (!e) break;
                  cur = e[0];
                }
                return cur;
              } else {
                // undirected: BFS to component root
                app._updateRoots();
                return app.nodes.find(n => n.isRoot 
                  && (function comp(u, seen = new Set([u])) {
                    if (u === node) return true;
                    for (const v of app.connections
                      .filter(([a,b]) => a===u||b===u)
                      .map(([a,b]) => a===u ? b : a)) {
                      if (!seen.has(v)) {
                        seen.add(v);
                        if (comp(v, seen)) return true;
                      }
                    }
                    return false;
                  })(n)
                );
              }
            }

            const [n1, n2] = nodesToUnion;
            const r1 = findRep(n1), r2 = findRep(n2);

            if (r1 === r2) {
              appendLog(`"${r1.text}" and "${r2.text}" are already in the same set`, true);
            } else {
              // choose the lower-id as new root
              const newRoot = r1.id < r2.id ? r1 : r2;
              const child   = newRoot === r1 ? r2 : r1;

              // add connection newRoot → child (directed)
              if (!app.connections.some(([a,b]) => a===newRoot && b===child)) {
                app.connections.push([newRoot, child]);
                newRoot.position.y = child.position.y-1;
              }

              appendLog(`Union: "${r1.text}" & "${r2.text}" → new root "${newRoot.text}"`, true);
              _updateRoots();

            }
            break;
          }



          case 'clear':
            app.nodes = [];
            app.connections = [];
            break;
          case 'cls':
            log.replaceChildren();
            break;
          case 'directed':
            app.isDirected = true;
            break;
          case 'undirected':
            app.isDirected = false;
            break;
          case 'rooted':
            app.isRooted = true;
            break;
          case 'unrooted':
            app.isRooted = false;
            break;
          default:
            appendLog(`Unknown command: ${cmd}`,true);
        }
      });

      // redraw and clear the textarea
      app._draw();
      ta.value = '';
    }
  });
});
