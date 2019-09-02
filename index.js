const sizex = 0.95;
const sizey = 0.8;
var camerapos = [0,0];
var nodes = [];
var selected = null;

function blank(){
        var canvas = document.getElementById("map");

        if (canvas.getContext) {
          window.ctx = canvas.getContext("2d");
          ctx.canvas.width  = window.innerWidth*sizex;
          ctx.canvas.height = window.innerHeight*sizey;

          //report the mouse position on movement
          ctx.canvas.addEventListener("mousemove", function(event) {
          window.mouseX = event.clientX - ctx.canvas.offsetLeft;
          window.mouseY = event.clientY - ctx.canvas.offsetTop;
          var cords = document.getElementById("cords");
          cords.innerHTML = mouseX.toString() + " | " + mouseY.toString()
          });

          //on click; if mouse in empty space; add node
          ctx.canvas.addEventListener("click", function(event){
          mousepos = [mouseX, mouseY];
          var intersect = false;
          for (var n = 0; n < nodes.length; n++) {
            var distance = Math.sqrt(Math.pow(nodes[n].position[0]-mousepos[0], 2) + Math.pow(nodes[n].position[1]-mousepos[1],2 )) - nodes[n].radius;
            if (distance <= 0) {
              selected = nodes[n];
              intersect = true;
            }
          }
          if (intersect == false) {
          selected = null;
          nodes.push(new node(mousepos));}

          else {
            nodes.splice(nodes.indexOf(selected),1);
            nodes.push(selected);
          }

          console.log("click: "+selected);
          display();
          });
         
}}

function app(){
        blank();
}

function resize_map(){
        ctx.canvas.width  = window.innerWidth*sizex;
        ctx.canvas.height = window.innerHeight*sizey;
        display();
}

class node{
  constructor(position) {
    this.position = position;
    this.content = null;
    this.connections = [];
    this.radius = 25;
  }
}

function bind(node1, node2) {
  // If already connected to eachother; delete binding
  if (node1.connections.includes(node2) || node2.connections.includes(node1)){
    var index = node1.connections.indexOf(node2);
    node1.connections.splice(index, 1);
    index = node2.connections.indexOf(node1);
    node2.connections.splice(index, 1);
  }

  // Else; create binding
  else {
  node1.connections.push(node2);
  node2.connections.push(node1);
}
}

function display() {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (var n = 0; n < nodes.length; n++) {
    ctx.beginPath();

    if (selected === nodes[n]) {
      ctx.arc(nodes[n].position[0], nodes[n].position[1], nodes[n].radius*1.1, 0, 2 * Math.PI);
      ctx.fillStyle = "#96ffff";
      ctx.fill();
      ctx.lineWidth = 2;
    }
    else {
    ctx.arc(nodes[n].position[0], nodes[n].position[1], nodes[n].radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#96ffff";
    ctx.fill();
    ctx.lineWidth = 1;
  }
    ctx.stroke();

    ctx.beginPath();
    for (var c = 0; c < nodes[n].connections.length; c++){
      ctx.moveTo(nodes[n].position[0], nodes[n].position[1]);
      ctx.lineTo(nodes[n].connections[c].position[0], nodes[n].connections[c].position[1]);
    }
    ctx.stroke();
  }
}