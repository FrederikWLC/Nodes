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
            // find true parents
            let parents = app.connections
              .filter(([a, b]) => b === node)
              .map(([a, b]) => a);

            // if none—and node.isRoot—treat itself as parent
            if (parents.length === 0 && node.isRoot) {
              parents = [node];
            }

            const labels = parents.map(n => n.text || `(id ${n.id})`);
            appendLog(
              parents.length
                ? `Parent(s) of "${node.text}": ${labels.join(', ')}`
                : `No parent found for "${node.text}"`,
              true
            );
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
            appendLog(`Unknown command: ${cmd}`,true);
        }
      });

      // redraw and clear the textarea
      app._draw();
      ta.value = '';
    }
  });
});
