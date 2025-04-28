// interpreter.js

class Interpreter {

  constructor() {
    // Wire up the interpreter textarea + log
    this.ta = document.getElementById('interpreter');
    this.log = document.getElementById('log');
  }

  hook(app) {
    // Hook on to the MapApp instance
    app.interpreter = this;
    this.app = app;
  }

  appendLog(line,isResponse=false) {
    const entry = document.createElement('div');
    if (isResponse) entry.textContent = `${line}`;
    else entry.textContent = `> ${line}`;
    this.log.appendChild(entry);
    // auto-scroll to bottom
    this.log.scrollTop = this.log.scrollHeight;
  }


}

window.addEventListener('DOMContentLoaded', () => {
  const app = new MapApp('map', 'cords');
  const interpreter = new Interpreter();
  interpreter.hook(app);
  app.init();
  interpreter.ta.addEventListener('keydown', e => {
    // run on Ctrl+Enter (or Cmd+Enter)
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = interpreter.ta.value.trim();
      if (!code) return;

      // split into lines, run each
      code.split('\n').forEach(line => {
        const [cmd, ...args] = line.trim().split(/\s+/);
        interpreter.appendLog(line);

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
              interpreter.appendLog(`No node found to lookup`, true);
              break;
            }

            targets.forEach(node => {
              let rep = app.findRep(node);
              interpreter.appendLog(
                `Representative of "${node.text}": "${rep.text}"`,
                true
              );
            });

            break;
          }

        case 'size': {
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
              interpreter.appendLog(`No node found to lookup`, true);
              break;
            }

            targets.forEach(node => {
              let rep = app.findRep(node);
              let size = app.getTreeSize(rep);
              interpreter.appendLog(
                `Size of tree with rep: "${rep.text}": ${size}`,
                true
              );
            });

            break;
        }

      case 'depth': {
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
              interpreter.appendLog(`No node found to lookup`, true);
              break;
            }

            targets.forEach(node => {
              let rep = app.findRep(node);
              let depth = app.getTreeDepth(rep);
              interpreter.appendLog(
                `Depth of tree with rep: "${rep.text}": ${depth}`,
                true
              );
            });

            break;
        }

      case 'leaves': {
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
              interpreter.appendLog(`No node found to lookup`, true);
              break;
            }

            targets.forEach(node => {
              let rep = app.findRep(node);
              let leaves = app.countTreeLeaves(rep);
              interpreter.appendLog(
                `Leave count of tree with rep: "${rep.text}": ${leaves}`,
                true
              );
            });

            break;
        }

      case 'union': {
            // identify the two nodes
            const nameA = args[0];
            const nameB = args[1];
            let nodesToUnion = [];
            if (nameA && nameB) {
              const a = app.nodes.find(n => n.text === nameA);
              const b = app.nodes.find(n => n.text === nameB);
              if (a && b) nodesToUnion = [a, b];
            } else if (this.coveredNodes.length === 2) {
              nodesToUnion = app.coveredNodes.slice(0, 2);
            } else {
              interpreter.appendLog(`Union needs two nodes (by name or exactly 2 covered)`,true);break;
            }
            const [n1, n2] = nodesToUnion;
            if (!n1 || !n2) {interpreter.appendLog(`Invalid nodes for union`, true);break;}
            return app.union(n1,n2);
          }

          case 'extractMax': {
            // optional arg: nodeText
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
              interpreter.appendLog(`No node found to lookup`, true);
              break;
            }

            targets.forEach(node => {
              let rep = app.findRep(node);
              const removed = app._extractMax(rep);
              if (removed) {
                interpreter.appendLog(`Extracted max node: "${removed.text}"`, true);
              } else {
                interpreter.appendLog(`No node extracted (none found)`, true);
              }
            });          
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
            interpreter.appendLog(`Unknown command: ${cmd}`,true);
        }
      });

      // redraw and clear the textarea
      app._draw();
      interpreter.ta.value = '';
    }
  });
});
