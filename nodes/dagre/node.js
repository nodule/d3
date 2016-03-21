state.scaleToFit = function(isUpdate) {

 // Zoom and scale to fit
 var zoomScale = state.zoom.scale();
 var graphWidth = state.g.graph().width + 80;
 var graphHeight = state.g.graph().height + 40;
 var width = parseInt(state.svg.style('width').replace(/px/, ''));
 var height = parseInt(state.svg.style('height').replace(/px/, ''));
 zoomScale = Math.min(width / graphWidth, height / graphHeight);

 var translate = [(width/2) - ((graphWidth*zoomScale)/2), (height/2) - ((graphHeight*zoomScale)/2)];
 state.zoom.translate(translate);
 state.zoom.scale(zoomScale);
 state.zoom.event(isUpdate ? state.svg.transition().duration(500) : d3.select("svg"));

};

on.start = function() {

  state.zoom = d3.behavior.zoom().on('zoom', function() {
    state.inner.attr('transform', 'translate(' + d3.event.translate + ')' +
      'scale(' + d3.event.scale + ')');
  });

  state.svg.call(state.zoom);
};

// parent html element
on.input.element = function() {
  // re-init entire graph.
  var s = document.createElement('svg');
  state.g = document.createElement('g');
  s.appendChild(state.g);
  $.element.appendChild(s);
  state.svg = d3.select(s);
  state.inner = state.svg.select(s.firstChild);

  state.render = new dagreD3.render();
  state.graph = new dagreD3.graphlib.Graph();
  state.graph.setGraph($.options);
};

// could `stream` the nodes through
// but would be weird I guess. instead of listening you
// will feed the new status each and every time.
on.input.setNode = function(node) {
 // not sure..
 state.g.setNode($.setNode.id, {
   labelType: "html",
   label: html,
   rx: 5,
   ry: 5,
   padding: 0,
   class: node.status
 });
 state.inner.call(state.render, state.g);
 state.scaleToFit();
};

on.input.setEdge = function(link) {
  state.g.setEdge(link.source.id, link.target.id, {
    label: link.source.port + '/' + link.target.port,
    width: 40
  });
  state.inner.call(state.render, state.g);
  state.scaleToFit();
};

// todo: api incorrect , will not work..
on.input.removeEdge = function(link) {
  state.g.removeEdge(link);
};
// how to remove by pid or id..
on.input.removeNode = function(node) {
  state.g.removeNode(node.pid || node.id);
};
