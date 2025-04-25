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
