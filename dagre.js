module.exports = {
  name: "dagre",
  ns: "d3",
  async: true,
  description: "Dagre D3",
  phrases: {
    active: "Greating dagre-d3 graph"
  },
  dependencies: {
    npm: {
      d3: require('d3'),
      "dagre-d3": require('dagre-d3')
    }
  },
  ports: {
    input: {
      element: {
        title: "Element",
        type: "HTMLElement",
        fn: function __ELEMENT__(data, source, state, input, $, output, d3, dagre_d3) {
          var r = function() {
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
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      options: {
        title: "Options",
        type: "object",
        properties: {
          nodesep: {
            type: "number",
            "default": 70
          },
          ranksep: {
            type: "number",
            "default": 50
          },
          rankdir: {
            type: "string",
            "enum": ["LR",
              "TB"
            ],
            "default": "TB"
          },
          marginx: {
            type: "number",
            "default": 20
          },
          marginy: {
            type: "number",
            "default": 20
          }
        }
      },
      setNode: {
        title: "Add Node",
        type: "object",
        async: true,
        properties: {
          id: {
            type: ["number",
              "string"
            ]
          },
          name: {
            type: "string"
          },
          title: {
            type: "string"
          }
        },
        fn: function __SETNODE__(data, source, state, input, $, output, d3, dagre_d3) {
          var r = function() {
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
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      removeNode: {
        title: "Remove Node",
        type: "object",
        async: true,
        properties: {
          id: {
            type: ["number",
              "string"
            ]
          },
          pid: {
            type: ["number",
              "string"
            ]
          },
          anyOf: [{
            required: ["id"]
          }, {
            required: ["pid"]
          }]
        },
        fn: function __REMOVENODE__(data, source, state, input, $, output, d3, dagre_d3) {
          var r = function() {
            state.g.removeNode(node.pid || node.id);
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      removeEdge: {
        title: "Remove Edge",
        type: "object",
        async: true,
        properties: {
          id: {
            type: ["number",
              "string"
            ]
          },
          pid: {
            type: ["number",
              "string"
            ]
          },
          anyOf: [{
            required: ["id"]
          }, {
            required: ["pid"]
          }]
        },
        fn: function __REMOVEEDGE__(data, source, state, input, $, output, d3, dagre_d3) {
          var r = function() {
            state.g.removeEdge(link);
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      setEdge: {
        title: "Set Edge",
        type: "object",
        async: true,
        properties: {
          source: {
            title: "Source",
            type: "object",
            properties: {
              id: {
                type: ["string",
                  "number"
                ]
              },
              port: {
                type: ["string"]
              }
            }
          },
          target: {
            title: "Target",
            type: "object",
            properties: {
              id: {
                type: ["string",
                  "number"
                ]
              },
              port: {
                type: ["string"]
              }
            }
          }
        },
        fn: function __SETEDGE__(data, source, state, input, $, output, d3, dagre_d3) {
          var r = function() {
            state.g.setEdge(link.source.id, link.target.id, {
              label: link.source.port + '/' + link.target.port,
              width: 40
            });
            state.inner.call(state.render, state.g);
            state.scaleToFit();
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      }
    },
    output: {}
  },
  state: {
    scaleToFit: function(isUpdate) {

      // Zoom and scale to fit
      var zoomScale = state.zoom.scale();
      var graphWidth = state.g.graph().width + 80;
      var graphHeight = state.g.graph().height + 40;
      var width = parseInt(state.svg.style('width').replace(/px/, ''));
      var height = parseInt(state.svg.style('height').replace(/px/, ''));
      zoomScale = Math.min(width / graphWidth, height / graphHeight);

      var translate = [(width / 2) - ((graphWidth * zoomScale) / 2), (height / 2) - ((graphHeight * zoomScale) / 2)];
      state.zoom.translate(translate);
      state.zoom.scale(zoomScale);
      state.zoom.event(isUpdate ? state.svg.transition().duration(500) : d3.select("svg"));

    }
  },
  on: {
    start: function __ONSTART__(data, source, state, input, $, output, d3, dagre_d3) {
      var r = function() {
        state.zoom = d3.behavior.zoom().on('zoom', function() {
          state.inner.attr('transform', 'translate(' + d3.event.translate + ')' +
            'scale(' + d3.event.scale + ')');
        });

        state.svg.call(state.zoom);
      }.call(this);
      return {
        state: state,
        return: r
      };
    }
  }
}