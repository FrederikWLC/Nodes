const sizex = 0.95;
const sizey = 0.8;
var camerapos = [0,0];
var nodes = [];
var selected = null;
var prev_bind = null;
var connections = [];
var global_id = 0;
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
          console.log("Created node");
          nodes.push(new node(mousepos, global_id));
          global_id += 1;
        }

          else {
            //Move touched node to top
            nodes.splice(nodes.indexOf(selected),1);
            nodes.push(selected);
            //If bind tool activated; bind the two nodes
            if (prev_bind){
              bind(prev_bind,selected);
              prev_bind = null;
            }
          }

          display();
          });

          document.addEventListener("keyup", function(event){
            console.log("Pressed key: "+event.key);
            if (!(selected == null)){
              if (event.key.toString() == "Backspace") {
                selected.delete();
                selected = null;
                display();
              }
              else if (event.key.toString() == "b") {
                prev_bind = selected;
                console.log("Binding..");
              }
            }
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
  constructor(position, id) {
    this.position = position;
    this.id = id;
    this.content = null;
    this.radius = 25;
  }

  delete(){
    // Remove this node from the nodes list
    nodes.splice(nodes.indexOf(this));
    // Remove all connection from the connection list which contains this node
    var connections_to_del = [];
    for (var i = 0; i < connections.length; i++) {
      if (connections[i][0] === this||connections[i][1] === this) {
        connections_to_del.push(connections[i]);
      }
    }
    for (var p = 0; p < connections_to_del.length; p++) {
      connections.splice(connections.indexOf(connections_to_del[p]),1);
    }
    console.log("Deleted node with id " + this.id + " and its " + connections_to_del.length + " connections")
  }
}

function bind(node1, node2) {
  // If already connected to eachother; pass
  if (arrInNest(connections, [node1,node2])||arrInNest(connections, [node2,node1])){
    //pass
  }
  
  // Else; create binding
  else {
    // The node with the smallest id is always the first
    connections.push([node1,node2]);


  console.log("Bound");
console.log("Connections: " + connections.length);}
  
}

function display() {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (var c = 0; c < connections.length; c++){
      ctx.beginPath();
      ctx.moveTo(connections[c][0].position[0], connections[c][0].position[1]);
      ctx.lineTo(connections[c][1].position[0], connections[c][1].position[1]);
      ctx.strokeStyle = "ff0000";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
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

  }
}

function arrInNest(mama, child){
  for( let i = 0; i < mama.length; i++ ){
    // don't even starting to compare if length are not equal
    if( mama[i].length != child.length ){ continue }
    
    let match = 0; // To count each exact match
    for( let j = 0; j < child.length; j++ ){
      if( mama[i][j] === child[j] ){
        // We made sure, that they have equal length, and can use index 'j'
        // to compare each element of arrays. 
        match++;
      } else {
        break;
      }
    }
    if( match === child.length ){ // If each element exactly matched
      return true; 
    }
  }
  return false;
}