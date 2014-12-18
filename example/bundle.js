require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("uojqOp"))
},{"uojqOp":4}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],5:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],6:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("uojqOp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":5,"inherits":2,"uojqOp":4}],7:[function(require,module,exports){
'use strict';

var Setting = require('./setting');
var util = require('util');

// // just extend from setting
// I want to have a toJSON for it
function ConnectionMap() { }

util.inherits(ConnectionMap, Setting);

ConnectionMap.prototype.toJSON = function() {
  var json = {};
  var key;
  for (key in this) {
    if (this.hasOwnProperty(key)) {
      for (var i = 0; i < this[key].length; i++) {
        if (!json[key]) {
          json[key] = [];
        }
        json[key][i] = this[key][i].toJSON();
      }
    }
  }
  return json;
};

module.exports = ConnectionMap;

},{"./setting":24,"util":6}],8:[function(require,module,exports){
'use strict';

var Packet = require('./packet');

// TODO: created something more flexible to load this on demand
var nodeTypes = {
 xNode: require('./node'),
 polymer: require('./node/polymer')
};
var xLink = require('./link');
var util = require('util');
var uuid = require('uuid').v4;
var Run = require('./run');
var Connector = require('./connector');
var validate = require('./validate');
var DefaultContextProvider = require('../lib/context/defaultProvider');
var IoMapHandler = require('../lib/io/mapHandler');
var DefaultProcessManager  = require('../lib/process/defaultManager');
var MultiSort = require('../lib/multisort');
var EventEmitter = require('events').EventEmitter;
var validate = require('./validate');

var Status = {};
Status.STOPPED = 'stopped';
Status.RUNNING = 'running';

/**
 *
 * Actor
 *
 * The Actor is responsible of managing a flow
 * it links and it's nodes.
 *
 * A node contains the actual programming logic.
 *
 * @api public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */
function Actor() {

  EventEmitter.apply(this, arguments);

  this.ioHandler      = undefined;
  this.processManager = undefined;
  this.nodes          = {};
  this.links          = {};
  this.iips           = {};
  this.view           = [];
  this.status         = undefined;

  this.type           = 'flow';

  /**
   *
   * Added by default.
   *
   * If others need to be used they should be set before addMap();
   *
   */
  this.addIoHandler(new IoMapHandler());
  this.addProcessManager(new DefaultProcessManager());

}

util.inherits(Actor, EventEmitter);

/**
 *
 * Validate the map against the node definitions
 *
 * @param {Object} map
 * @api public
 */
Actor.prototype.validateMap = function(map) {
  validate.flow(map);
};

/**
 *
 * Create/instantiate  a node
 *
 * Node at this stage is nothing more then:
 *
 *  { ns: "fs", name: "readFile" }
 *
 * @param {Object} node - Node as defined within a map
 * @param {Object} def  - Node Definition
 *
 * @api public
 */
Actor.prototype.createNode = function(node, def) {

  var self = this;

  if (!def) {
    throw new Error(
      util.format(
        'Failed to get node definition for %s:%s', node.ns, node.name
      )
    );
  }

  if (!node.id) {
    throw Error('Node should have an id');
  }

  if (!def.ports) {
    def.ports = {};
  }

  // merges expose, persist etc, with port definitions.
  // This is not needed with proper inheritance
  for (var type in node.ports) {
    if (node.ports.hasOwnProperty(type) &&
       def.ports.hasOwnProperty(type)
       ) {
      for (var name in node.ports[type]) {
        if (node.ports[type].hasOwnProperty(name) &&
          def.ports[type].hasOwnProperty(name)
          ) {

          for (var property in node.ports[type][name]) {
            if (node.ports[type][name].hasOwnProperty(property)) {
              // add or overwrite it.
              def.ports[type][name][property] =
                node.ports[type][name][property];
            }
          }
        }
      }
    }
  }

  // allow instance to overwrite other node definition data also.
  // probably make much more overwritable, although many
  // should not be overwritten, so maybe just keep it this way.
  if (node.title) {
    def.title = node.title;
  }

  if (node.description) {
    def.description = node.description;
  }

  var identifier = node.title || [
    node.ns, '::', node.name, '-',
    Object.keys(this.nodes).length
  ].join('');

  if (def.type === 'flow') {

    var xFlow = require('./flow'); // solve circular reference.

    validate.flow(def);

    this.nodes[node.id] = new xFlow(
      node.id,
      def,
      identifier,
      this.loader,        // single(ton) instance (TODO: di)
      this.ioHandler,     // single(ton) instance
      this.processManager // single(ton) instance
    );

  } else {

    var cls = def.type || 'xNode';

    if (nodeTypes.hasOwnProperty(cls)) {

      validate.nodeDefinition(def);

      this.nodes[node.id] = new nodeTypes[cls](
        node.id,
        def,
        identifier,
        this.ioHandler.CHI
      );

      // register and set pid, xFlow/actor adds itself to it (hack)
      this.processManager.register(this.nodes[node.id]);

    } else {

      throw Error(
        util.format('Unknown node type: `%s`', cls)
      );

    }

  }

  // add parent to both xflow's and node's
  // not very pure seperation, but it's just very convenient
  this.nodes[node.id].setParent(this);

  if (node.provider) {
    this.nodes[node.id].provider = node.provider;
  }

  // TODO: move this to something more general.
  // not on every node creation.
  if (!this.contextProvider) {
    this.addContextProvider(new DefaultContextProvider());
  }

  this.contextProvider.addContext(
    this.nodes[node.id],
    node.context
  );

  this.nodes[node.id].on('output',
    this.ioHandler.output.bind(this.ioHandler)
  );

  this.nodes[node.id].on('freePort', function(event) {

    var links;
    var i;

    // get all current port connections
    links = this.portGetConnections(event.port);

    if (links.length) {

      for (i = 0; i < links.length; i++) {

        var link = links[i];

        // unlock if it was locked
        if (self.ioHandler.queueManager.isLocked(link.ioid)) {
          self.ioHandler.queueManager.unlock(link.ioid);
        }

      }

      if (event.link) {

        // remove the link belonging to this event
        if (event.link.has('dispose')) {

          // TODO: remove cyclic all together, just use core/forEach
          //  this will cause bugs if you send multiple cyclics because
          //  the port is never unplugged..
          if (!event.link.target.has('cyclic')) {
            self.removeLink(event.link);
          }
        }

      }

    }

  });

  this.emit('addNode', {node: this.nodes[node.id]});

  return this.nodes[node.id];

};

/**
 *
 * Plugs a source into a target node
 *
 *
 * @param {Link} link
 */
Actor.prototype.plugNode = function(link) {

  this.getNode(link.target.id).plug(link);

  return this;

};

/**
 *
 * Unplugs a port for the node specified.
 *
 * @param {Link} link
 */
Actor.prototype.unplugNode = function(link) {

  // could be gone, if called from freePort
  // when nodes are being removed.
  if (this.hasNode(link.target.id)) {
    this.getNode(link.target.id).unplug(link);
  }

  return this;

};

/**
 *
 * Holds a Node
 *
 * @param {String} id
 * @api public
 */
Actor.prototype.hold = function(id) {

  this.getNode(id).hold();

  return this;

};

/**
 *
 * Starts the actor
 *
 * @param {Boolean} push
 * @api public
 */
Actor.prototype.start = function(push) {

  this.status = Status.RUNNING;

  // TODO: this means IIPs should be send after start.
  //       enforce this..
  this.clearIIPs();

  // start all nodes
  // (could also be started during addMap
  // runtime is skipping addMap.
  // so make sure start() is restartable.
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).start();
    }
  }

  if (push !== false) {
    this.push();
  }

  // there are many other ways to start
  // so this does not ensure much.
  // however the process manager listens to this.
  // Real determination if something is started or stopped
  // includes the ioHandler.
  // So let's just inform the io handler we are started.

  this.emit('start', {
    node: this
  });

  return this;

};

/**
 *
 * Stops the actor
 *
 * Use a callback to make sure it is stopped.
 *
 * @api public
 */
Actor.prototype.stop = function(cb) {

  var self = this;

  this.status = Status.STOPPED;

  if (this.ioHandler) {

    this.ioHandler.reset(function() {

      // close ports opened by iips
      self.clearIIPs();

      self.emit('stop', {
        node: self
      });

      if (cb) {
        cb();
      }

    });

  }

};

Actor.prototype.pause = function() {

  this.status = Status.STOPPED;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).hold();
    }
  }

  return this;

};

/**
 *
 * Resumes the actor
 *
 * All nodes which are on hold will resume again.
 *
 * @api public
 */
Actor.prototype.resume = function() {

  this.status = Status.RUNNING;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).release();
    }
  }

  return this;

};

/**
 *
 * Get the current status
 *
 * @api public
 */
Actor.prototype.getStatus = function() {
  return this.status;
};

/**
 *
 * Create an actor
 *
 * @api public
 */
Actor.create = function(map, loader, ioHandler, processManager) {

  var actor = new Actor();
  ioHandler = ioHandler ? ioHandler : new IoMapHandler();
  actor.addLoader(loader);
  actor.addIoHandler(ioHandler);
  actor.addProcessManager(processManager);
  actor.addMap(map);

  return actor;
};

/**
 *
 * Releases a node if it was on hold
 *
 * @param {String} id
 * @api public
 */
Actor.prototype.release = function(id) {
  this.getNode(id).release();
  return this;
};

/**
 *
 * Pushes the Actor
 *
 * Will send :start to all nodes without input
 * and all nodes which have all their input ports
 * filled by context already.
 *
 * @api public
 */
Actor.prototype.push = function() {

  this.status = Status.RUNNING;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      var node = this.getNode(id);
      if (node.isStartable()) {
        var iip =  new Connector();
        iip.plug(id, ':start');
        this.sendIIP(iip, '');
      }
    }
  }

  return this;
};

/**
 *
 * Adds the definition Loader
 *
 * This provides an api to get the required node definitions.
 *
 * The loader should already be init'ed
 *
 * e.g. the remote loader will already have loaded the definitions.
 * and is ready to respond to getNodeDefinition(ns, name, type, provider)
 *
 * e.g. An async loader could do something like this:
 *
 *   loader(flow, function() { actor.addLoader(loader); }
 *
 * With a sync loader it will just look like:
 *
 * actor.addLoader(loader);
 *
 * @api public
 */
Actor.prototype.addLoader = function(loader) {

  this.loader = loader;

  return this;

};

/**
 *
 * Validate and read map
 *
 * @param {Object} map
 * @api public
 *
 */
Actor.prototype.addMap = function(map) {

  var i;
  var self = this;

  if (typeof map === 'undefined') {
    throw new Error('map is not defined');
  }

  if (map !== Object(map)) {
    throw new Error('addMap expects an object');
  }

  try {
    validate.flow(map);
  } catch (e) {
    if (map.title) {
      throw Error(
        util.format('Flow `%s`: %s', map.title, e.message)
      );
    } else {
      throw Error(
        util.format('Flow %s:%s: %s', map.ns, map.name, e.message)
      );
    }
  }

  if (!this.id) {
    // xFlow contains it, direct actors don't perse
    this.id = map.id || uuid();
  }

  // add ourselves (actor/xFlow) to the processmanager
  // this way links can store our id and pid
  // must be done *before* adding our nodes.
  // otherwise our nodes will be registered before ourselves.
  if (!this.pid) { // re-run
    this.processManager.register(this);
  }

  // add nodes and links one by one so there is more control
  map.nodes.forEach(function(node) {

    if (!node.id) {
      throw new Error(
        util.format('Node lacks an id: %s:%s', node.ns, node.name)
      );
    }

    // give the node a default provider.
    if (!node.provider) {
      if (map.providers && map.providers.hasOwnProperty('@')) {
        node.provider = map.providers['@'].url;
      }
    }

    var def = self.loader.getNodeDefinition(node, map);
    if (!def) {

      throw new Error(
        util.format(
          'Failed to get node definition for %s:%s', node.ns, node.name
        )
      );
    }

    self.createNode(node, def);

  });

  // this.ensureConnectionNumbering(map);

  if (map.hasOwnProperty('links')) {
    map.links.forEach(function(link) {
      self.addLink(
       self.createLink(link)
      );
    });
  }

  for (i = 0; i < map.nodes.length; i++) {
    this.view.push(map.nodes[i].id);
  }

  // all nodes & links setup, run start method on node
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).start();
    }
  }

  return this;

};

/**
 *
 * Used by the process manager to set our id
 *
 */
Actor.prototype.setPid = function(pid) {
  this.pid = pid;
};

/**
 *
 * Adds a node to the map.
 *
 * The object format is like it's defined within a map.
 *
 * Right now this is only used during map loading.
 *
 * For dynamic loading care should be taken to make
 * this node resolvable by the loader.
 *
 * Which means the definition should either be found
 * at the default location defined within the map.
 * Or the node itself should carry provider information.
 *
 * A provider can be defined as:
 *
 *  - url:        https://serve.rhcloud.com/flows/{ns}/{name}
 *  - file:       ./{ns}/{name}
 *  - namespace:  MyNs
 *
 * Namespaces are defined within the map, so MyNs will point to
 * either the full url or filesystem location.
 *
 * Once a map is loaded _all_ nodes will carry the full url individually.
 * The namespace is just their to simplify the json format and for ease
 * of maintainance.
 *
 *
 * @param {Object} node
 * @api public
 *
 */
Actor.prototype.addNode = function(node) {

  this.createNode(node);

  return this;
};

/**
 *
 * Creates a new connection/link
 *
 * Basically takes a plain link object
 * and creates a proper xLink from it.
 *
 * The internal map holds xLinks, whereas
 * the source map is just plain JSON.
 *
 * Structurewise they are almost the same.
 *
 * @param {Object} ln
 * @return {xLink} link
 * @api public
 *
 */
Actor.prototype.createLink = function(ln) {

  // auto creates id if there is none.
  // not sure if that's desired.
  var link = xLink.create(ln.id);

  if (!ln.source) {
    throw Error('Create link expects a source');
  }

  if (!ln.target) {
    throw Error('Create link expects a target');
  }

  link.setSource(
    ln.source.id,
    ln.source.port,
    ln.source.setting,
    ln.source.action
  );

  link.setTarget(
    ln.target.id,
    ln.target.port,
    ln.target.setting,
    ln.target.action
  );

  return link;

};

/**
 *
 * Adds a link
 *
 * @param {xLink} link
 */
Actor.prototype.addLink = function(link) {

  if (link.constructor.name !== 'Link') {
    throw Error('Link must be of type Link');
  }

  if (link.source.id !== this.id) { // Warn: IIP has our own id
    var sourceNode = this.getNode(link.source.id);
    if (!sourceNode.portExists('output', link.source.port)) {
      throw Error(util.format(
        'Source node (%s:%s) does not have an output port named `%s`\n\n' +
        '\tOutput ports available:\t%s\n',
        sourceNode.ns,
        sourceNode.name,
        link.source.port,
        Object.keys(sourceNode.ports.output).join(', ')
      ));
    }
  }

  var targetNode = this.getNode(link.target.id);
  if (link.target.port !== ':start' &&
      !targetNode.portExists('input', link.target.port)
    ) {
    throw Error(
      util.format(
        'Target node (%s:%s) does not have an input port named `%s`\n\n' +
        '\tInput ports available:\t%s\n',
        targetNode.ns,
        targetNode.name,
        link.target.port,
        Object.keys(targetNode.ports.input).join(', ')
      )
    );
  }

  // var targetNode = this.getNode(link.target.id);

  // FIXME: rewriting sync property
  // to contain the process id of the node it's pointing
  // to not just the nodeId defined within the graph
  if (link.target.has('sync')) {
    link.target.set('sync', this.getNode(link.target.get('sync')).pid);
  }

  link.graphId  = this.id;
  link.graphPid = this.pid;

  var self = this;

  var dataHandler = function dataHandler(p) {
    if (!this.ioid) {
      throw Error('LINK MISSING IOID');
    }

    self.__input(this, p);
  };

  link.on('data', dataHandler);

  if (link.source.id) {
    if (link.source.id === this.id) {
      link.setSourcePid(this.pid || this.id);
    } else {
      link.setSourcePid(this.getNode(link.source.id).pid);
    }
  }

  link.setTargetPid(this.getNode(link.target.id).pid);

  // remember our own links, so we can remove them
  // if it has data it's an iip
  if (undefined !== link.data) {
    this.iips[link.id] = link;
  } else {
    this.links[link.id] = link;
  }

  this.ioHandler.connect(link);

  this.plugNode(link);

  // bit inconsistent with event.node
  // should be event.link
  this.emit('addLink', link);

  // this.ensureConnectionNumbering();
  return link;

};

Actor.prototype.__input = function(link, p) {

  var self = this;

  var targetNode = this.getNode(link.target.id);

  var ret = targetNode.inputPortAvailable(link.target);

  if (util.isError(ret) || ret === false) {

    self.ioHandler.reject(ret, link, p);

  } else {

    ret = targetNode.fill(link.target, p);

    if (util.isError(ret)) {

      // `hard reject`
      // set node in error state and output error to ioManager
      targetNode.error(ret);

      self.ioHandler.reject(ret, link, p);

    } else if (ret === false) {

      // `soft reject`
      self.ioHandler.reject(ret, link, p);

    } else {

      self.ioHandler.accept(link, p);
    }

  }

};

Actor.prototype.clearIIP = function(link) {

  var id;
  var oldLink;

  for (id in this.iips) {

    if (this.iips.hasOwnProperty(id)) {

      oldLink = this.iips[id];

      // source is always us so do not have to check it.
      if ((
          oldLink.source.port === ':iip' ||
          oldLink.target.port === link.target.port ||
          oldLink.target.port === ':start' // huge uglyness
         ) &&
         oldLink.target.id   === link.target.id) {

        this.unplugNode(oldLink);

        this.ioHandler.disconnect(oldLink);

        delete this.iips[oldLink.id];

        // TODO: just rename this to clearIIP
        this.emit('removeIIP', oldLink);

      }

    }
  }

  // io handler could do this.
  // removelink on the top-level actor/graph
  // is not very useful

};

/**
*
* Clear IIPs
*
* If target is specified, only those iips will be cleared.
*
*/
Actor.prototype.clearIIPs = function(target) {

  var id;
  var iip;
  for (id in this.iips) {
    if (this.iips.hasOwnProperty(id)) {
      iip = this.iips[id];
      if (!target ||
        (target.id === iip.target.id && target.port === iip.target.port)) {
        this.clearIIP(this.iips[id]);
      }
    }
  }
};

/**
 *
 * Removes a node from the map
 *
 * @param {string} nodeId
 * @param {function} cb
 * @api public
 */
Actor.prototype.removeNode = function(nodeId, cb) {

  // removed the links
  // TODO: there is no this.map anymore.
  // notify IO handler we are gone.
  var id;
  var ln;
  var self = this;
  for (id in this.links) {
    if (this.links.hasOwnProperty(id)) {

      ln  = this.links[id];

      if (ln.source.id === nodeId ||
        ln.target.id === nodeId) {
        this.removeLink(ln);
      }

    }

  }

  // should wait for IO, especially there is a chance
  // system events are still spitting.

  // register and set pid
  this.processManager.unregister(this.getNode(nodeId), function() {

    var oldNode = self.nodes[nodeId].export();

    delete self.nodes[nodeId];

    self.emit('removeNode', {
      node: oldNode
    });

    if (cb) {
      cb();
    }

  });

  // not used
  // return this;

};

Actor.prototype.removeNodes = function() {

  this.clear();

};

Actor.prototype.setMeta = function(nodeId, key, value) {

  var node = this.getNode(nodeId);

  node.setMeta(key, value);

  this.emit('metadata', {
    id: this.id,
    node: node.export()
  });

};

/**
 *
 * Removes link
 *
 * @param {Link} ln
 * @api public
 *
 */
Actor.prototype.removeLink = function(ln) {

  // we should be able to find a link without id.
  var link;
  var what = 'links';

  link = this.links[ln.id];
  if (!link) {
    link = this.iips[ln.id];
    if (!link) {
      //throw Error('Cannot find link');
      // TODO: Seems to happen with ip directly to subgraph (non-fatal)
      console.warn('FIXME: cannot find link');
      return;
    }
    what = 'iips';
  }

  this.unplugNode(link);

  this.ioHandler.disconnect(link);

  // io handler could do this.
  // removelink on the top-level actor/graph
  // is not very useful

  var oldLink = this[what][link.id];

  delete this[what][link.id];

  this.emit('removeLink', oldLink);

  return this;

};

/**
 *
 * Adds a port
 *
 * NOT IMPLEMENTED
 *
 * @api public
 */
Actor.prototype.addPort = function() {

  return this;

};

/**
 *
 * Removes a port
 *
 * NOT IMPLEMENTED
 *
 * @api public
 */
Actor.prototype.removePort = function() {

  return this;

};

/**
 *
 * Resets this instance so it can be re-used
 *
 * Note: The registered loader is left untouched.
 *
 * @api public
 *
 */
Actor.prototype.reset = function() {

  var id;

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).reset();
    }
  }

  // if nothing has started yet
  // there is no ioHandler
  if (this.ioHandler) {
    this.ioHandler.reset();
  }

  return this;

};

Actor.prototype.clear = function(cb) {

  if (!cb) {
    throw Error('clear expects a callback');
  }

  var self = this;
  var nodeId;
  var cnt = 0;
  var total = Object.keys(this.nodes).length;

  if (total === 0) {
    cb();
  }

  function removeNodeHandler() {
    cnt++;
    if (cnt === total) {
      self.nodes = {};
      cb();
    }
  }
  // remove node will automatically remove all links
  for (nodeId in this.nodes) {
    if (this.nodes.hasOwnProperty(nodeId)) {
      // will remove links also.
      this.removeNode(nodeId, removeNodeHandler);
    }
  }

};

/**
 *
 * Add IO Handler.
 *
 * The IO Handler handles all the input and output.
 *
 * @param {IOHandler} handler
 * @api public
 *
 */
Actor.prototype.addIoHandler = function(handler) {

  this.ioHandler = handler;

  return this;

};

/**
 *
 * Add Process Manager.
 *
 * The Process Manager holds all processes.
 *
 * @param {Object} manager
 * @api public
 *
 */
Actor.prototype.addProcessManager = function(manager) {

  this.processManager = manager;

  return this;

};

/**
 *
 * Add a new context provider.
 *
 * A context provider pre-processes the raw context
 *
 * This is useful for example when using the command line.
 * All nodes which do not have context set can be asked for context.
 *
 * E.g. database credentials could be prompted for after which all
 *      input is fullfilled and the flow will start to run.
 *
 * @param {ContextProvider} provider
 * @api private
 *
 */
Actor.prototype.addContextProvider = function(provider) {
  this.contextProvider = provider;

  return this;

};

/**
 *
 * Explains what input and output ports are
 * available for interaction.
 *
 */
Actor.prototype.help = function() {

};

/**
 *
 * Send IIPs
 *
 * Optionally with `options` for the port:
 *
 * e.g. { persist: true }
 *
 * Optionally with `source` information
 *
 * e.g. { index: 1 } // index for array port
 *
 * @param {Object} iips
 * @api public
 */
Actor.prototype.sendIIPs = function(iips) {

  var self = this;

  var links = [];

  iips.forEach(function(iip) {

    var xLink = self.createLink({
       source: {
         id: self.id, // we are the sender
         port: ':iip'
       },
       target: iip.target
    });

    // dispose after fill
    xLink.set('dispose', true);

    if (iip.data === undefined) {
      throw Error('IIP data is `undefined`');
    }

    xLink.data = iip.data;

    links.push(xLink);

  });

  links.forEach(function(iip) {

    // TODO: this doesn't happen anymore it's always a link.
    // make sure settings are always set also.
    if (iip.target.constructor.name !== 'Connector') {
      var target = new Connector();
      target.plug(iip.target.id, iip.target.port);
      for (var key in iip.target.setting) {
        if (iip.target.setting.hasOwnProperty(key)) {
          target.set(key, iip.target.setting[key]);
        }
      }
      iip.target = target;
    }

    if (!self.id) {
      throw Error('Actor must contain an id');
    }

    self.addLink(iip);

  });

  links.forEach(function(link) {

    self.ioHandler.emit('send', link);

    var p = new Packet(JSON.parse(JSON.stringify(link.data)));

    // a bit too direct, ioHandler should do this..
    self.ioHandler.queueManager.queue(link.ioid, p);

    // remove data bit.
    delete link.data;
  });

  return links;

};

/*
 * Send a single IIP to a port.
 *
 * Note: If multiple IIPs have to be send use sendIIPs instead.
 *
 * Source is mainly for testing, but essentially it allows you
 * to imposter a sender as long as you send along the right
 * id and source port name.
 *
 * Source is also used to set an index[] for array ports.
 * However, if you send multiple iips for an array port
 * they should be send as a group using sendIIPs
 *
 * This is because they should be added in reverse order.
 * Otherwise the process will start too early.
 *
 * @param {Connector} target
 * @param {Object} data
 * @api public
 */
Actor.prototype.sendIIP = function(target, data) {

  if (!this.id) {
    throw Error('Actor must contain an id');
  }

  if (undefined === data) {
    throw Error('Refused to send IIP without data');
  }

  var ln = {
    source: {
      id: this.id, // we are the sender
      pid: this.pid,
      port: ':iip'
    },
    target: target
  };

  var xLink = this.createLink(ln);
  xLink.data = data;

  // dispose after fill
  xLink.set('dispose', true);

  // makes use of xLink.data
  this.addLink(xLink);

  this.ioHandler.emit('send', xLink);

  var p = new Packet(JSON.parse(JSON.stringify(xLink.data)));

  this.ioHandler.queueManager.queue(xLink.ioid, p);

  // remove data bit.
  delete xLink.data;

  return xLink;

};

/**
 *
 * Retrieve a node by it's process id
 *
 * @param {String} pid - Process ID
 * @return {Object} node
 * @api public
 */
Actor.prototype.getNodeByPid = function(pid) {

  var id;
  var node;

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      node = this.getNode(id);
      if (node.pid === pid) {
        return node;
      }
    }
  }

  return;
};

/**
 *
 * Get all node ids this node depends on.
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getAncestorIds = function(nodeId) {

  var self = this;

  var pids = this.ioHandler.getAncestorPids(
    this.getNode(nodeId).pid
  );

  var ids = [];
  pids.forEach(function(pid) {
    ids.push(self.getNodeByPid(pid).id);
  });
  return ids;

};

/**
 *
 * Get the entire node branch this node depends on
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getAncestorNodes = function(nodeId) {
  var i;
  var nodes = [];
  var ids = this.getAncestorIds(nodeId);

  for (i = 0; i < ids.length; i++) {
    nodes.push(this.getNode(ids[i]));
  }

  return nodes;
};

/**
 *
 * Get all node ids that target this node.
 *
 * @param {String} nodeId
 * @return {Array} ids
 * @api public
 */
Actor.prototype.getSourceIds = function(nodeId) {

  var self = this;
  var ids = [];

  var pids = this.ioHandler.getSourcePids(
    this.getNode(nodeId).pid
  );

  pids.forEach(function(pid) {
    var node = self.getNodeByPid(pid);
    if (node) { // iips will not be found
      ids.push(node.id);
    }
  });
  return ids;

};

/**
 *
 * Get all nodes that target this node.
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getSourceNodes = function(nodeId) {

  var i;
  var nodes = [];
  var ids = this.getSourceIds(nodeId);

  for (i = 0; i < ids.length; i++) {
    nodes.push(this.getNode(ids[i]));
  }

  return nodes;

};

/**
 *
 * Get all nodes that use this node as a source .
 *
 * @param {String} nodeId
 * @return {Array} ids
 * @api public
 */
Actor.prototype.getTargetIds = function(nodeId) {

  var self = this;

  var pids = this.ioHandler.getTargetPids(
    this.getNode(nodeId).pid
  );

  var ids = [];
  pids.forEach(function(pid) {
    ids.push(self.getNodeByPid(pid).id);
  });
  return ids;

};

/**
 *
 * Use is a generic way of creating a new instance of self
 * And only act upon a subset of our map.
 *
 *
 */
Actor.prototype.use = function(/*name, context*/) {

  throw Error('TODO: reimplement actions');
/*
  var i;
  var action;
  var map = {};
  var sub = new this.constructor();

  // Use this handlers events also on the action.
  sub._events = this._events;

  // Find our action
  if (!this.map.actions) {
    throw new Error('This flow has no actions');
  }

  if (!this.map.actions.hasOwnProperty(name)) {
    throw new Error('Action not found');
  }

  action = this.map.actions[name];

  // Create a reduced map
  map.env = this.map.env;
  map.title =  action.title;
  map.description = action.description;
  map.ports = this.map.ports;
  map.nodes = [];
  map.links = [];

  for (i = 0; i < this.map.nodes.length; i++) {
    if (action.nodes.indexOf(this.map.nodes[i].id) >= 0) {
      map.nodes.push(this.map.nodes[i]);
    }
  }

  for (i = 0; i < this.map.links.length; i++) {
    if (
      action.nodes.indexOf(this.map.links[i].source.id) >= 0 &&
      action.nodes.indexOf(this.map.links[i].target.id) >= 0) {
      map.links.push(this.map.links[i]);
    }
  }

  // re-use the loader
  sub.addLoader(this.loader);

  // add the nodes to our newly instantiated Actor
  sub.addMap(map);

  // hack to autostart it during run()
  // this only makes sense with actions.
  // TODO: doesn work anymore
  // sub.trigger = action.nodes[0];

  return sub;
*/

};

/**
 *
 * Run the current flow
 *
 * The flow starts by providing the ports with their context.
 *
 * Nodes which have all their ports filled by context will run immediatly.
 *
 * Others will wait until their unfilled ports are filled by connections.
 *
 * Internally the node will be set to a `contextGiven` state.
 * It's a method to tell the node we expect it to have enough
 * information to start running.
 *
 * If a port is not required and context was given and there are
 * no connections on it, it will not block the node from running.
 *
 * If a map has actions defined, run expects an action name to run.
 *
 * Combinations:
 *
 *   - run()
 *     run flow without callback
 *
 *   - run(callback)
 *     run with callback
 *
 *   - action('actionName').run()
 *     run action without callback
 *
 *   - action('actionName').run(callback)
 *     run action with callback
 *
 * The callback will receive the output of the (last) node(s)
 * Determined by which output ports are exposed.
 *
 * If we pass the exposed output, it can contain output from anywhere.
 *
 * If a callback is defined but there are no exposed output ports.
 * The callback will never fire.
 *
 * @api public
 */
Actor.prototype.run = function(callback) {

  return new Run(this, callback);

};
/**
 *
 * Need to do it like this, we want the new sub actor
 * to be returned to place events on etc.
 *
 * Otherwise it's hidden within the actor itself
 *
 * Usage: Actor.action('action').run(callback);
 *
 */
Actor.prototype.action = function(action, context) {

  var sub = this.use(action, context);
  return sub;

};

/**
 *
 * Get all nodes.
 *
 * TODO: unnecessary method
 *
 * @return {Object} nodes
 * @api public
 *
 */
Actor.prototype.getNodes = function() {

  return this.nodes;

};

/**
 *
 * Check if this node exists
 *
 * @param {String} id
 * @return {Object} node
 * @api public
 */
Actor.prototype.hasNode = function(id) {

  return this.nodes.hasOwnProperty(id);

};

/**
 *
 * Get a node by it's id.
 *
 * @param {String} id
 * @return {Object} node
 * @api public
 */
Actor.prototype.getNode = function(id) {

  if (this.nodes.hasOwnProperty(id)) {
    return this.nodes[id];
  } else {
    throw new Error(util.format('Node %s does not exist', id));
  }

};

/**
 *
 * JSON Status report about the nodes.
 *
 * Mainly meant to debug after shutdown.
 *
 * Should handle all stuff one can think of
 * why `it` doesn't work.
 *
 */
Actor.prototype.report = function() {

  var link;
  var node;
  var id;
  var size;
  var qm = this.ioHandler.queueManager;

  var report = {
    ok: true,
    flow: this.id,
    nodes: [],
    queues: []
  };

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      node = this.nodes[id];
      if (node.status !== 'complete') {
        report.ok = false;
        report.nodes.push({
          node: node.report()
        });
      }
    }
  }

  for (id in this.links) {
    if (this.links.hasOwnProperty(id)) {
      link = this.links[id];
      if (qm.hasQueue(link.ioid)) {
        size = qm.size(link.ioid);
        report.ok = false;
        report.queues.push({
          link: link.toJSON(),
          port: link.target.port,
          // super weird, will be undefined if called here.
          // size: qm.size(link.ioid),
          size: size,
          node: this.getNode(link.target.id).report()
        });
      }
    }
  }

  return report;

};

/**
 *
 * If there are multiple connections to one port
 * the connections are numbered.
 *
 * If there is a index specified by using the
 * [] property, it will be considered.
 *
 * If it's not specified although there are
 * multiple connections to one port, it will be added.
 *
 * The sort takes care of adding connections where
 * [] is undefined to be placed last.
 *
 * The second loop makes sure they are correctly numbered.
 *
 * If connections are defined like:
 *
 *   undefined, [4],undefined, [3],[2]
 *
 * The corrected result will be:
 *
 * [2]        -> [0]
 * [3]        -> [1]
 * [4]        -> [2]
 * undefined  -> [3]
 * undefined  -> [4]
 *
 * Ports which only have one connection will be left unmodified.
 *
 */
Actor.prototype.ensureConnectionNumbering = function(map) {

  var c = 0;
  var i;
  var link;
  var last = {};
  var node;

  // first sort so order of appearance of
  // target.in is correct
  //
  // FIX: seems like multisort is messing up the array.
  // target suddenly has unknown input ports...
  if (map.links.length) {
    MultiSort(map.links, ['target', 'in', 'index']);
  }

  for (i = 0; i < map.links.length; i++) {

    link = map.links[i];

    // Weird, the full node is not build yet here?
    // so have to look at the nodeDefinitions ns and name _is_
    // known at this point.
    node = this.nodes[link.target.id];

    if (this.nodeDefinitions[node.ns][node.name]
      .ports.input[link.target.port].type === 'array') {

      if (last.target.id === link.target.id &&
        last.target.port === link.target.port) {
        last.index = c++;
        link.index = c;
      } else {
        c = 0; // reset
      }
      last = link;

    }
  }

};

Actor.prototype.hasParent = function() {
  return false;
};

module.exports = Actor;

},{"../lib/context/defaultProvider":10,"../lib/io/mapHandler":12,"../lib/multisort":14,"../lib/process/defaultManager":19,"./connector":9,"./flow":11,"./link":13,"./node":15,"./node/polymer":17,"./packet":18,"./run":21,"./validate":25,"events":1,"util":6,"uuid":42}],9:[function(require,module,exports){
'use strict';

var util    = require('util');
var Setting = require('./setting');

/**
 *
 * Connector
 *
 * The thing you plug into a port.
 *
 * Contains information about port and an optional
 * action to perform within the node (subgraph)
 *
 * Can also contains port specific settings.
 *
 * An xLink has a source and a target connector.
 *
 * ................... xLink ....................
 *
 *  -------------------.    .------------------
 * | Source Connector -------  Target Connector |
 *  ------------------'     `------------------
 *
 * When a link is plugged into a node, we do so
 * by plugging the target connector.
 *
 * @constructor
 * @public
 *
 */
function Connector(settings) {
  Setting.apply(this, [settings]);
  this.wire = undefined;
}

util.inherits(Connector, Setting);

/**
 *
 * Plug
 *
 * TODO: plug is not the correct name
 *
 * @param {String} id - TODO: not sure which id, from the node I pressume..
 * @param {String} port
 * @param {String} action
 */
Connector.prototype.plug = function(id, port, action) {
  this.id     = id;
  this.port   = port;
  if (action) {
    this.action = action;
  }
};

/**
 *
 * Create
 *
 * Creates a connector
 *
 * @param {String} id - TODO: not sure which id, from the node I pressume..
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 */
Connector.create = function(id, port, settings, action) {

  var c = new Connector(settings);
  c.plug(id, port, action);
  return c;

};

/**
 *
 * Register process id this connector handles.
 *
 */
Connector.prototype.setPid = function(pid) {
  this.pid = pid;
};

Connector.prototype.toJSON = function() {

  var ret = {
    id: this.id,
    port: this.port
  };

  if (this.setting) {
    ret.setting = JSON.parse(JSON.stringify(this.setting));
  }

  if (this.action) {
    ret.action = this.action;
  }

  return ret;

};

module.exports = Connector;

},{"./setting":24,"util":6}],10:[function(require,module,exports){
'use strict';

/**
 *
 * Default Context Provider
 *
 * @constructor
 * @public
 */
function DefaultProvider() {

}

DefaultProvider.prototype.addContext = function(node, defaultContext) {

  if (typeof defaultContext !== 'undefined') {
    node.addContext(defaultContext);
  }

};

module.exports = DefaultProvider;

},{}],11:[function(require,module,exports){
'use strict';

var Packet         = require('./packet');
var util           = require('util');
var xLink          = require('./link');
var validate       = require('./validate');
var Actor          = require('./actor');
var IoMapHandler   = require('./io/mapHandler');
var ProcessManager = require('./process/defaultManager');

/**
 *
 * This FlowNode wraps the Actor.
 *
 * What it mainly does is delegate what it it asked to do
 * To the nodes from the actor.
 *
 * External Interface is not really needed anymore.
 *
 * Because the flow has ports just like a normal node
 *
 * I still wonder if I cannot just make a node which executes
 * a flow and then just make all events available on ports.
 *
 *
 * Connector
 *
 * @constructor
 * @public
 *
 */
function Flow(id, map, identifier, loader, ioHandler, processManager) {

  var self = this;

  // Call the super's constructor
  Actor.apply(this, arguments);

  // External vs Internal links
  this.linkMap = {};

  // indicates whether this is an action instance.
  this.actionName = undefined;

  // TODO: trying to solve provider issue
  this.provider = map.provider;

  this.providers = map.providers;

  this.actions = {};

  // initialize both input and output ports might
  // one of them be empty.
  if (!map.ports) {
    map.ports = {};
  }
  if (!map.ports.output) {
    map.ports.output = {};
  }
  if (!map.ports.input) {
    map.ports.input = {};
  }

/*
  // make available always.
  node.ports.output['error'] = {
    title: 'Error',
    type: 'object'
  };
*/

  this.id = id;

  this.name = map.name;

  this.type = 'flow';

  this.title = map.title;

  this.description = map.description;

  this.ns = map.ns;

  this.active = false;

  this.metadata = map.metadata || {};

  this.identifier = identifier || [
    map.ns,
    ':',
    map.name
  ].join('');

  this.ports = JSON.parse(
    JSON.stringify(map.ports)
  );

  // Need to think about how to implement this for flows
  // this.ports.output[':complete'] = { type: 'any' };

  this.runCount = 0;

  this.inPorts = Object.keys(
    this.ports.input
  );

  this.outPorts = Object.keys(
    this.ports.output
  );

  this.filled = 0;

  this.chi = undefined;

  this._interval = 100;

  // this.context = {};

  this.nodeTimeout = map.nodeTimeout || 3000;

  this.inputTimeout = typeof map.inputTimeout === 'undefined' ?
    3000 :
    map.inputTimeout;

  this._hold = false; // whether this node is on hold.

  this._inputTimeout = null;

  this._openPorts = [];

  this._connections = {};

  this._forks = [];

  this.loader = loader;

  this.ioHandler = ioHandler;

  this.processManager = processManager;

  this.addMap(map);

  this.fork = function() {

    var Fork = function Fork() {
      this.nodes = {};
      //this.context = {};

      // same ioHandler, tricky..
      // this.ioHandler = undefined;
    };

    // Pre-filled baseActor is our prototype
    Fork.prototype = this.baseActor;

    var FActor = new Fork();

    // Remember all forks for maintainance
    self._forks.push(FActor);

    // Way too much happening here, but wanna make it work..
    //
    // TODO: will probably fail, just don't fork yet.
    // FActor.createNodes(); // or actually, recreateNodes and cross fingers.

    // Forget it, can not hack your way into this...
    // FActor._events = self.baseActor._events;

    // now re-run it and see if the object itself has it own nodes
    // and does not just run the prototype.

    // Each fork should have their own event handlers.
    self.listenForOutput(FActor);

    return FActor;

  };

  this.listenForOutput();

  this.initPortOptions = function() {

    // Init port options.
    for (var port in self.ports.input) {
      if (self.ports.input.hasOwnProperty(port)) {

        // This flow's port
        var thisPort = self.ports.input[port];

        // set port option
        if (thisPort.options) {
          for (var opt in thisPort.options) {
            if (thisPort.options.hasOwnProperty(opt)) {
              self.setPortOption(
                'input',
                port,
                opt,
                thisPort.options[opt]);
            }
          }
        }

      }
    }
  };

  // Too late?
  this.setup();

  this.setStatus('created');

}

util.inherits(Flow, Actor);

Flow.prototype.action = function(action) {

  if (!this.actions.hasOwnProperty(action)) {

    throw Error('this.action should return something with the action map');
/*
    var ActionActor = this.action(action);

    // ActionActor.map.ports = this.ports;

    // not sure what to do with the id and identifier.
    // I think they should stay the same, for now.
    //
    this.actions[action] = new Flow(
      this.id,
      // ActionActor, // BROKEN
      map, // action definition should be here
      this.identifier + '::' + action
    );

    // a bit loose this.
    this.actions[action].actionName = action;

    //this.actions[action].ports = this.ports;
*/

  }

  return this.actions[action];

};

Flow.prototype.setup = function() {

  // THESE TWO ARE RELEVANT REGARDING fork()
  // listen should be per actor, run() should fork()
  // this.actor could be baseActor maybe, because
  // I would like to have a clean copy.

  // read the out ports from the map and add listen
  // for the output
  //
  // Ok, this is kinda good, however we are in setup
  // which is only run once.
  // After this, we also need to create new forks
  // if all input is fullfilled, for the previous fork.
  // Remember baseActor is our prototype
  //this.currentActor = this.fork();

  // this.currentActor = this.baseActor; // normal behavior again for now.
  // this.currentActor.run();
  // this.run();

  //this.actor.createNetwork();
  // upon startup do this to _all_ nodes
  //
  this.initPortOptions();

};

/**
 *
 * For forking it is relevant when this addContext is done.
 * Probably this addContext should be done on baseActor.
 * So subsequent forks will have the updated context.
 * Yeah, baseActor is the fingerprint, currentActor is the
 * current one, this._actors is the array of instantiated forks.
 *
 */
Flow.prototype.addContext = function(context) {

  var port;
  for (port in context) {

    if (context.hasOwnProperty(port)) {

      var portDef = this.getPortDefinition(port, 'input');

      // Keep track here we have filled _our_ port with context?
      // Something also unsolved is the default, but when we expose a port
      // we just expect it to be filled either with context or with a
      // connection. Context of the internal node could be considered the
      // default.
      // Or the default of the internal node could be the default.
      // But for now, just don't care, just always fill it with either
      // context or a connection.
      // Note: forks are made out of the baseActor, so that's good and fresh.
      // So I think we can just ask the base actor whether a node is
      // fullfilled with context.
      // It should be super simple actually. a fill count is already enough
      // for xFlow.
      if (context.hasOwnProperty(port)) {
        this.getNode(portDef.nodeId)
          .setContextProperty(portDef.name, context[port]);

        // Maybe too easy, but see if it works.
        // Reset when all are filled, then fork.
        this.filled++;

      }

    }
  }
};

Flow.prototype.setContextProperty = function(port, data) {

  var portDef = this.getPortDefinition(port, 'input');
  this.getNode(portDef.nodeId).setContextProperty(portDef.name, data);

};

Flow.prototype.clearContextProperty = function(port) {

  var portDef = this.getPortDefinition(port, 'input');
  this.getNode(portDef.nodeId).clearContextProperty(portDef.name);

};

Flow.prototype._delay = 0;

Flow.prototype.inputPortAvailable = function(target) {

  if (target.action && !this.isAction()) {

    // NOTE: actions are a bit tricky now, they do not support
    // this forking thing.. so look at that.
    // maybe it still works because they act upon the current flow.

    return this.action(target.action).inputPortAvailable(target);

  } else {

    // little bit too much :start hacking..
    if (target.port === ':start') {

      return true;

    } else {

      var portDef = this.getPortDefinition(target.port, 'input');

      if (!this.linkMap.hasOwnProperty(target.wire.id)) {
        throw Error('Cannot find internal link within linkMap');
      }

      return this.getNode(portDef.nodeId)
        .inputPortAvailable(this.linkMap[target.wire.id].target);

    }

  }
};

// TODO: both flow & node can inherit this stuff

Flow.prototype.getStatus = function() {

  return this.status;

};

Flow.prototype.setStatus = function(status) {

  this.status = status;
  this.event(':statusUpdate', {
    node: this.export(),
    status: this.status
  });

};

Flow.prototype.error = function(node, err) {

  var error = util.isError(err) ? err : Error(err);

  // TODO: better to have full (custom) error objects
  var eobj  = {
    node: node.export(),
    msg: err
  };

  // Update our own status, this should status be resolved
  // Create a shell? yep..
  node.setStatus('error');

  // Used for in graph sending
  node.event(':error', eobj);

  // Used by Process Manager or whoever handles the node
  node.emit('error', eobj);

  return error;
};

Flow.prototype.fill = function(target, p) {

  if (target.action && !this.isAction()) {

    // NOTE: action does not take fork into account?
    // test this later. it should be in the context of the currentActor.
    return this.action(target.action).fill(target, p);

  } else {

    if (target.port === ':start') {

      this.event(':start', {
        node: this.export()
      });

      this.setStatus('started');

      this.push();
      return true;

    } else {

      // delegate this to the node this port belongs to.
      var portDef = this.getPortDefinition(target.port, 'input');

      var node = this.getNode(portDef.nodeId);

      if (!this.linkMap.hasOwnProperty(target.wire.id)) {
        throw Error('link not found within linkMap');
      }

      var err = node.fill(this.linkMap[target.wire.id].target, p);

      if (util.isError(err)) {

        Flow.error(this, err);

        return err;

      } else {

        this.event(':start', {node: this.export()});

        this.filled++;

        if (this.filled === Object.keys(this._connections).length) {

          // do not fork for now
          // this.currentActor = this.fork();
          // this.currentActor.run();

          this.filled = 0;

        }

        return true;

      }

    }

  }

};

Flow.prototype.setMetadata = function(metadata) {
  this.metadata = metadata;
};

Flow.prototype.setMeta = function(key, value) {
  this.metadata[key] = value;
};

/**
 *
 * Checks whether the port exists at the node
 * this Flow is relaying for.
 *
 * @param {String} type
 * @param {String} port
 */
Flow.prototype.portExists = function(type, port) {

 // this returns whether this port exists for _us_
 // it only considers the exposed ports.
  var portDef = this.getPortDefinition(port, type);
  return this.getNode(portDef.nodeId).portExists(type, portDef.name);

};

/**
 *
 * Checks whether the port is open at the node
 * this Flow is relaying for.
 *
 * @param {String} port
 */
Flow.prototype.portIsOpen = function(port) {

  // the port open logic is about _our_ open and exposed ports.
  // yet ofcourse it should check the real node.
  // so also delegate.
  var portDef = this.getPortDefinition(port, 'input');
  // Todo there is no real true false in portIsOpen?
  // it will fail hard.
  return this.getNode(portDef.nodeId).portIsOpen(portDef.name);

};

/**
 *
 * Get _this_ Flow's port definition.
 *
 * The definition contains the _real_ portname
 * of the node _this_ port is relaying for.
 *
 * @param {String} port
 */

// JIKES, if we only need the ports we are all good..
Flow.prototype.getPortDefinition = function(port, type) {
  // uhm ok, we also need to add the start port
  if (this.ports[type].hasOwnProperty(port)) {
    return this.ports[type][port];
  } else {
    throw new Error(
      util.format(
        'Unable to find exported port definition for %s port `%s` (%s:%s)\n' +
        '\tAvailable ports: %s',
        type,
        port,
        this.ns,
        this.name,
        Object.keys(this.ports.input).toString()
      )
    );
  }
};

/**
 *
 * Get the port option at the node
 * this flow is relaying for.
 *
 * @param {String} type
 * @param {String} port
 * @param {String} option
 */
Flow.prototype.getPortOption = function(type, port, option) {

  // Exposed ports can also have options set.
  // if this is _our_ port (it is exposed)
  // just delegate this to the real node.
  var portDef = this.getPortDefinition(port, type);
  // Todo there is no real true false in portIsOpen?
  // it will fail hard.
  return this.getNode(portDef.nodeId).getPortOption(type, portDef.name, option);
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 * Ok, with forks running this should eventually be much smarter.
 * If there are long running flows, all instances should have their
 * ports updated.
 *
 * Not sure when setPortOption is called, if it is called during 'runtime'
 * there is no problem and we could just set it on the current Actor.
 * I could also just already fix it and update baseActor and all _actors.
 * which would be sufficient.
 *
 * Anyway, this._actors is nice, however what to do with other forking methods.
 * Nevermind first do this.
 *
 */
Flow.prototype.setPortOption = function(type, port, opt, value) {
  var portDef = this.getPortDefinition(port, type);
  this.getNode(portDef.nodeId).setPortOption(type, portDef.name, opt, value);
};

Flow.prototype.openPort = function(port) {
  if (this._openPorts.indexOf(port) === -1) {
    this._openPorts.push(port);
  }
};

Flow.prototype.isAction = function() {

  return !!this.actionName;

};

// TODO: implement
//Flow.prototype.unplug = function(target) {
Flow.prototype.unplug = function(link) {

  if (link.target.action && !this.isAction()) {

    this.action(link.target.action).unplug(link.target);

  } else {

    // unplug logic

  }

};

/**
*
* Set port to open state
*
* This is a problem, xFlow has it's ports opened.
* However this also means baseActor and all the forks
* Should have their ports opened.
*
* Ok, not a problem, only that addition of the :start port
* is a problem. Again not sure at what point plug()
* is called. I think during setup, but later on also
* in realtime. anyway for now I do not care so much about
* realtime. Doesn't make sense most of the time.
*
* @param {Link} link
* @public
*/
Flow.prototype.plug = function(link) {

  if (link.source.wire !== link ||
     link.target.wire !== link) {
    throw Error('Broken wire');
  }

  if (link.target.action && !this.isAction()) {

    this.action(link.target.action).plug(link.target);

  } else {

    if (link.target.port === ':start') {
      this.addPort('input', ':start', {type: 'any'});
    }

    // delegate this to the real node
    // only if this is one of _our_ exposed nodes.
    //var portDef = this.getPortDefinition(target.port, 'input');
    var portDef = this.getPortDefinition(link.target.port, 'input');

    // start is not an internal port, we will do a push on the internal
    // actor and he may figure it out..
    //if (target.port !== ':start') {
    if (link.target.port !== ':start') {

      // The Node we are gating for
      var internalNode = this.getNode(portDef.nodeId);

      var xlink = new xLink();
      // just define our node as the source, and the external port
      xlink.setSource(this.id, link.target.port, {}, link.target.action);
      xlink.setTarget(link.target.id, portDef.name, {}, link.target.action);

      for (var k in link.target.setting) {
        if (link.target.setting.hasOwnProperty(k)) {
          xlink.target.set(k, link.target.setting[k]);
        }
      }

      // fixed settings
      if (portDef.hasOwnProperty('setting')) {
        for (k in portDef.setting) {
          if (portDef.setting.hasOwnProperty(k)) {
            xlink.target.set(k, portDef.setting[k]);
          }
        }
      }

      internalNode.plug(xlink);

      // Copy the port type, delayed type setting, :start is only known after
      // the port is opened...
      this.ports.input[link.target.port].type =
        internalNode.ports.input[xlink.target.port].type;

      // we add our internalLink as reference to our link.
      // a bit of a hack, it's not known by the definition of
      // Link itself
      link.internalLink = xlink;

      // outer/inner mapping
      this.linkMap[link.id] = xlink;

    } else {
      // what to do with start port?
    }

    // use same logic for our own ports
    if (!this._connections[link.target.port]) {
      this._connections[link.target.port] = [];
    }

    this._connections[link.target.port].push(link);

    this.openPort(link.target.port);

  }

};

Flow.prototype.exposePort = function(type, nodeId, port, name) {

  var p;
  var node = this.getNode(nodeId);

  if (node.ports[type]) {
    for (p in node.ports[type]) {

      if (node.ports[type].hasOwnProperty(p)) {

        if (p === port) {

          // not sure, is this all info?
          this.addPort(type, name, {
            nodeId: nodeId,
            name: port
          });

          continue;
        }
      }
    }
  }

  this.emit('addPort', {
    node: this.export(),
    port: name
  });

};

Flow.prototype.removePort = function(type, name) {

  if (this.ports[type][name]) {

    delete this.ports[type][name];

    this.emit('removePort', {
      node: this.export(),
      port: name
    });

  }

};

Flow.prototype.renamePort = function(type, from, to) {

  var id;

  if (this.ports[type][from]) {

    this.ports[type][to] = JSON.parse(
      JSON.stringify(this.ports[type][from])
    );

    // update links pointing to us.
    // updates ioHandler also because it holds
    // references to these links
    // TODO: pid/id warning...
    // renaming will only update this instance.
    // accidently these links will make each instance
    // point to the new ports, however not each instance
    // has it's port renamed..
    // For rename it's better to stop the graph
    // update the definition itself then start it again
    // Because for instance the io handler will still send
    // to old ports.
    for (id in this.links) {
      if (type === 'input' &&
        this.links[id].target.id === this.id &&
        this.links[id].target.port === from) {

        this.links[id].target.port = to;

      } else if (type === 'output' &&
        this.links[id].source.id === this.id &&
        this.links[id].source.port === from) {

        this.links[id].source.port = to;
      }
    }

    delete this.ports[type][from];

    this.emit('renamePort', {
      node: this.export(),
      from: from,
      to: to
    });

  }

};

Flow.prototype.addPort = function(type, name, def) {

  // add it to known ports
  if (!this.ports[type]) {
    this.ports[type] = {};
  }

  this.ports[type][name] = def;

  if (type === 'input') {
    this.inPorts = Object.keys(this.ports[type]);
  } else {
    this.outPorts = Object.keys(this.ports[type]);
  }
};

/**
 *
 * Close the port of the node we are relaying for
 * and also close our own port.
 *
 * @param {String} port
 */
Flow.prototype.closePort = function(port) {
   // delegate this to the real node
   // only if this is one of _our_ exposed nodes.
  var portDef = this.getPortDefinition(port, 'input');

  if (port !== ':start') {

    this.getNode(portDef.nodeId).closePort(portDef.name);
    // this._forks.forEach(function(fork) {
    //  fork.getNode(portDef.nodeId).closePort(portDef.name);
    //});
  }

  if (this.ports.input[port]) {
    this._openPorts.splice(
      this._openPorts.indexOf(port), 1
    );
  }

  this._connections[port].pop();

};

Flow.prototype.hasConnections = function() {
  return this._openPorts.length;
};

/**
 *
 * Puts this flow on hold.
 *
 * NOT IMPLEMENTED YET
 *
 * This should stop each and every fork.
 *
 */
Flow.prototype.hold = function() {

  // implement later, holds input for _this_ flow
  this._hold = true;
  this.stop();
  /*
  this._forks.forEach(function(fork) {
    fork.stop();
  });
  */
};

/**
*
* Releases the node if it was on hold
*
* This should resume each and every fork.
*
* @public
*/
Flow.prototype.release = function() {

  // TODO: these are all just on the actor, not sure Flow also needs it.

  this._hold = false;
  this.resume();
  /*
  this._forks.forEach(function(fork) {
    fork.resume();
  });
  */
};

/**
*
* Complete function
*
* @public
*/
Flow.prototype.complete = function() {

  // todo: check this.ready stuff logic.
  this.ready = false;
  this.active = false;

};

Flow.prototype.portHasConnection = function(port, link) {
  return this._connections[port] && this._connections[port].indexOf(link) >= 0;
};
Flow.prototype.portHasConnections = function(port) {
  return !!(this._connections[port] && this._connections[port].length > 0);
};

Flow.prototype.portGetConnections = function(port) {
  return this._connections[port] || [];
};

/**
*
* Listen for output on 'our' ports
*
* The internal Actor will actually listen just like the normal actor.
*
* @public
*/
Flow.prototype.listenForOutput = function() {

  var port;
  var internalPort;
  var self = this;

  // not really used yet, but this would envolve just
  // commanding all nodes to shutdown,
  // which will be a simple loop.
  // baseActor loop doesn't make much sense but ah well.
  //
  function outputHandler(port, internalPort) {
    return function(data) {
      if (internalPort === data.port) {

        self.sendPortOutput(port, data.out);

        // there is no real way to say a graph has executed.
        // So just consider each output as an execution.
        // TODO: a bit expensive
        self.event(':executed', {
          node: self.export()
        });

      }
    };
  }

  function freePortHandler(externalPort, internalPort) {

    return function(event) {

      if (internalPort === event.port) {

        var extLink;

        for (var i = 0; i < self._connections[externalPort].length; i++) {
          if (self._connections[externalPort][i].internalLink === event.link) {
            extLink = self._connections[externalPort][i];
            break; // yeay..
          }
        }

        if (!extLink) {
          throw Error('Cannot determine outer link');
        } else {
          self.event(':freePort', {
            node: self.export(),
            link: extLink,
            port: externalPort
          });

          self.emit('freePort', {
            node: self.export(),
            link: extLink,
            port: externalPort
          });
        }

      }
    };
  }

  var internalNode;
  if (this.ports.output) {
    for (port in this.ports.output) {
      if (this.ports.output.hasOwnProperty(port)) {
        internalPort = this.ports.output[port];
        // These bypass the IOHandler, but that's ok, they
        // are just external internal port mappings.
        internalNode = this.getNode(internalPort.nodeId);
        internalNode.on('output', outputHandler(port, internalPort.name));
      }
    }
  }

  if (this.ports.input) {
    for (port in this.ports.input) {
      if (this.ports.input.hasOwnProperty(port)) {
        internalPort = this.ports.input[port];
        // These bypass the IOHandler, but that's ok, they
        // are just external internal port mappings.
        internalNode = this.getNode(internalPort.nodeId);
        internalNode.on('freePort', freePortHandler(port, internalPort.name));
      }
    }
  }
};

/**
*
* Runs the shutdown method of the blackbox
*
* NOT IMPLEMENTED
*
* @public
*/
Flow.prototype.shutdown = function() {

  // not really used yet, but this would envolve just
  // commanding all nodes to shutdown,
  // which will be a simple loop.
};

/**
*
* Return a serializable export of this flow.
*
* @public
*/
Flow.prototype.export = function() {

  return {

    id: this.id,
    pid: this.pid,
    ns: this.ns,
    name: this.name,
    identifier: this.identifier,
    ports: this.ports,
    // cycles: this.cycles,
    inPorts: this.inPorts,
    outPorts: this.outPorts,
    filled: this.filled,
    // context: this.context,
    active: this.active,
    provider: this.provider,
    // input: this._filteredInput(),
    openPorts: this._openPorts,
    // nodeTimeout: this.nodeTimeout,
    // inputTimeout: this.inputTimeout
  };

};

/**
*
* Export this modified instance to a nodedefinition.
*
* @public
*/
Flow.prototype.toJSON = function() {

  var def = {
    id: this.id,
    ns: this.ns,
    name: this.name,
    title: this.title,
    type: this.type,
    description: this.description,
    // should not be the full nodes
    nodes: [],
    links: [],
    ports: this.ports,
    providers: this.providers
  };

  for (var name in this.nodes) {
    if (this.nodes.hasOwnProperty(name)) {
      def.nodes.push(this.nodes[name].toJSON());
    }
  }

  for (var id in this.links) {
    if (this.links.hasOwnProperty(id)) {
      def.links.push(this.links[id].toJSON());
    }
  }

  validate.flow(def);

  return def;

};

Flow.prototype.isStartable = function() {

  // err ok, how to determine this.
  // a flow is always startable?
  // ok for now it is..
  // it should'nt though..
  return true;

};

Flow.prototype.event = function(port, output) {
  var p = new Packet(output);
  this.sendPortOutput(port, p);
};

Flow.prototype.sendPortOutput = function(port, p) {

  // important identifies from what action this output came.
  // used by connections to determine if it should consume
  // the output.

  var out = {
    node: this.export(),
    port: port,
    out: p
  };

  if (this.isAction()) {
    out.action = self.action;
  }

  this.emit('output', out);

};

Flow.prototype.destroy = function() {

  // just ask all nodes to destroy themselves
  // and finally do the same with self
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.nodes.destroy();
    }
  }

};

Flow.prototype.setPid = function(pid) {

  this.pid = pid;

};

/**
 *
 * Create an xFlow
 *
 * Some kind of logic as the actor
 *
 * @api public
 */
Flow.create = function(map, loader, ioHandler, processManager) {

  ioHandler = ioHandler || new IoMapHandler();
  processManager = processManager || new ProcessManager();

  // Flow(id, map, identifier, loader, ioHandler) {
  var actor = new Flow(
    map.id,
    map,
    map.ns + ':' + map.name,
    loader,
    ioHandler,
    processManager
  );

  // loader = loader ? loader : new Loader();
  // actor.addLoader(loader);
  // actor.addIoHandler(ioHandler);
  // actor.addMap(map);

  return actor;
};

Flow.prototype.reset = function() {

  this.runCount = 0;
  this.filled   = 0;

  // ask all our nodes to reset.
  // TODO: will be done double if the IO manager
  // also ask all nodes to reset itself.
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.nodes.reset();
    }
  }

};

/**
 *
 * Helper function to make the flow an npm module itself.
 *
 * Usage:
 *
 *   Ok, here is the clash...
 *   xFlow needs way to much information to initialize.
 *   It should have the same interface as actor.
 *
 *   var xflow = new xFlow:create(map, loader);
 *   xflow.addMap(map);
 *
 *   module.exports = xflow.expose;
 *
 *   ---
 *
 *   var flow = require('my-flow');
 *
 *   flow({
 *     in: 'some_data',
 *     in2: 'other_data'
 *   }, {
 *     out: function(data) {
 *       // do something with data..
 *     }
 *   });
 *
 * Ok, then what about the actions.
 *
 */
Flow.prototype.expose = function(input, output) {

  var iips = [];
  var key;
  var self = this;
  if (this.hasOwnProperty('ports')) {

    if (this.ports.hasOwnProperty('input')) {

      for (key in input) {

        if (input.hasOwnProperty(key)) {

          var iip;
          var inputPorts = this.ports.input;

          if (inputPorts.hasOwnProperty(key)) {

            iip = {
              target: {
                id: inputPorts[key].nodeId,
                port: inputPorts[key].name,
              },
              data: input[key]
            };

            iips.push(iip);

            // Within the exposed ports these should
            // already be set if they must be used.
            // (implement that) they are not properties
            // a caller should set.
            //
            // target.settings,
            // target.action

          } else {

            throw Error(util.format('No such input port %s', key));

          }

        }

      }

    } else {
      throw Error('The map provided does not have any input ports available');
    }

    if (output) {

      var cb = output;

      if (this.ports.hasOwnProperty('output')) {

        /////// setup callbacks
        this.on('output', function output(data) {
          if (data.node.id === self.id && cb.hasOwnProperty(data.port)) {
            cb[data.port](data.out);
          }
        });

      } else {
        throw Error(
          'The map provided does not have any output ports available'
        );
      }

    }

  } else {
    throw Error('The map provided does not have any ports available');
  }

  // start it all
  if (iips.length) {
    this.sendIIPs(iips);
  }

  this.push();

  return this;

};

/**
 *
 * Adds the parent Actor.
 *
 * For now this is only used to copy the events.
 *
 * It causes all nested actors to report to the root
 * actor's listeners.
 *
 * Rather important, otherwise you would
 * only get the events from the first root Actor/Flow
 *
 * @param {Object} actor
 */
Flow.prototype.setParent = function(actor) {
  this.parent = actor;

  // this.actor._events = actor._events;
  // I think this works otherwise I would already have much bigger
  // problems.
  //this.baseActor._events = actor._events;
  //
  // Warning no other events may be set yet!
  //
  // Skip this, but it was to automagically show all events.
  // make a better solution for this.
  // this._events = actor._events;
};

Flow.prototype.getParent = function() {
  return this.parent;
};

Flow.prototype.hasParent = function() {
  return !!this.parent;
};

module.exports = Flow;

},{"./actor":8,"./io/mapHandler":12,"./link":13,"./packet":18,"./process/defaultManager":19,"./validate":25,"util":6}],12:[function(require,module,exports){
'use strict';

var Packet              = require('../packet');
var EventEmitter        = require('events').EventEmitter;
var util                = require('util');
var CHI                 = require('chix-chi');
var uuid                = require('uuid').v4;
var isPlainObject       = require('is-plain-object');
var DefaultQueueManager = require('../queue/defaultManager');

function cloneData(p, type) {

  /* function type does not mean the data itself is directly
   * a function, it can also be a plain object holding
   * functions. so what is specified is leading.
   */
  if (type === 'function') {
    return;
  }

  if (typeof p.data === 'object' && isPlainObject(p.data)) {
    p.data = JSON.parse(JSON.stringify(p.data));
  }

}
/**
 *
 * This is the IoMap Handler
 *
 * It should know:
 *
 *  - the connections.
 *  - address of the source UUID + port name
 *  - address of the target UUID + port name
 *  - relevant source & target connection settings.
 *
 * Connection settings can overlap with port settings.
 * Connection settings take precedence over port settings,
 * althought this is not set in stone.
 *
 * @constructor
 * @public
 *
 * */
function IoMapHandler() {

  this.CHI = new CHI();

  // todo: create maps from each of these and wrap them in a connections map
  // so all there wil be is this.connections.
  // connections.byTarget, connections.bySource etc.
  this.targetMap       = {};
  this.connections     = {};
  this.sourceMap       = {};
  this.syncedTargetMap = {};
  this.pointerPorts    = {};

  this._shutdown = false;

  this.addQueueManager(
    new DefaultQueueManager(this.receiveFromQueue.bind(this))
  );

  this.addCHI(this.CHI);
}

util.inherits(IoMapHandler, EventEmitter);

IoMapHandler.prototype.addCHI = function(CHI) {

  this.CHI = CHI;
  this.CHI.on('begingroup', this.beginGroup.bind(this));
  this.CHI.on('endgroup', this.sendGroup.bind(this));
  this.CHI.on('collected', this.collected.bind(this));
  this.CHI.on('synced', this.sendSynced.bind(this));

};

/**
  *
  * Connects ports together using the link information provided.
  *
  *  @param {xLink} link
  * @api public
  */
IoMapHandler.prototype.connect = function(link) {

  if (!link.source) {
    throw Error('Link requires a source');
  }

  if (!link.source.pid) {
    link.source.pid = link.source.id;
  }

  // TODO: quick fix, which never works..
  // ioHandler is the only one assigning these..
  // a link with ioid set should be rejected..
  if (!link.ioid) {
    link.ioid = uuid();
  }

  if (!link.target) {
    throw Error('Link requires a target');
  }

  if (!link.target.pid) {
    link.target.pid = link.target.id;
  }

  // register the connection
  this.connections[link.ioid] = link;

  if (!this.targetMap[link.source.pid]) {
    this.targetMap[link.source.pid] = [];
  }

  this.targetMap[link.source.pid].push(link);

  if (!this.sourceMap[link.target.pid]) {
    this.sourceMap[link.target.pid] = [];
  }

  this.sourceMap[link.target.pid].push(link);

  // build the syncedTargetMap, it contains a port array
  // (the group that wants a sync with some originId

  if (link.target.has('sync')) {

    if (!this.syncedTargetMap[link.target.pid]) {
      this.syncedTargetMap[link.target.pid] = {};
    }

    if (!this.syncedTargetMap[link.target.pid][link.target.get('sync')]) {
      this.syncedTargetMap[link.target.pid][link.target.get('sync')] = [];
    }

    this.syncedTargetMap[link.target.pid][link.target.get('sync')]
      .push(link.target.port);

  }

  if (link.source.get('pointer')) {
    if (!this.pointerPorts[link.source.pid]) {
      this.pointerPorts[link.source.pid] = [];
    }
    this.pointerPorts[link.source.pid].push(link.source.port);
  }

  this.emit('connect', link);

};

// TODO: ugly, source & target map
// should be one central place of registration.
// now a link is in two places.
IoMapHandler.prototype.get = function(link) {
  if (this.sourceMap[link.target.pid]) {
    return this.sourceMap[link.target.pid];
  }
};

IoMapHandler.prototype.lock = function(link) {
  this.queueManager.lock(link.ioid);
};

IoMapHandler.prototype.accept = function(link /*, p*/) {

  // update the fill count.
  // normally belongs to a Port Object.
  link.fills++;

  // re-open queue for this link.
  if (this.queueManager.isLocked(link.ioid)) {
    // freePort will do this now.
    this.queueManager.unlock(link.ioid);
  }
};

IoMapHandler.prototype.reject = function(err, link, p) {

  // update the reject count.
  // normally belongs to a Port Object.
  link.rejects++;

  this.queueManager.lock(link.ioid);

  // Do not put it back in queue if there was a *real* error
  // Default error is `false`, which is just a normal reject.
  if (!util.isError(err)) {

    // put it back in queue.
    this.queueManager.unshift(link.ioid, p);

    // The process manager is listening for the node
    // which is already in error state
    // this.emit('error', err);
  }
};

/**
 *
 *  Disconnects a link
 *
 *  @param {xLink} link
 */
IoMapHandler.prototype.disconnect = function(link) {

  var src;
  var tgt;

  // unregister the connection
  if (this.connections.hasOwnProperty(link.ioid)) {
    delete this.connections[link.ioid];
  } else {
    throw Error('Cannot disconnect an unknown connection');
  }

  if (this.targetMap[link.source.pid]) {

    src = this.targetMap[link.source.pid];
    src.splice(src.indexOf(link), 1);
    if (src.length === 0) {
      delete this.targetMap[link.source.pid];
    }

  }

  if (this.sourceMap[link.target.pid]) {

    tgt = this.sourceMap[link.target.pid];
    tgt.splice(tgt.indexOf(link), 1);
    if (tgt.length === 0) {
      delete this.sourceMap[link.target.pid];
    }

  }

  if (this.syncedTargetMap[link.target.pid]) {
    tgt = this.syncedTargetMap[link.target.pid];
    tgt.splice(src.indexOf(link.target.port), 1);
    if (tgt.length === 0) {
      delete this.syncedTargetMap[link.target.pid];
    }
  }

  if (this.pointerPorts[link.source.pid]) {
    src = this.pointerPorts[link.source.pid];
    src.splice(src.indexOf(link.source.port), 1);
    if (src.length === 0) {
      delete this.pointerPorts[link.source.pid];
    }
  }

  // prevents iip bug, where iip is still queued.
  // disconnect does not correctly take queueing into account.
  // delete link.ioid;

  // used by actor to close ports
  this.emit('disconnect', link);

};

/**
 *
 * Get all node ids that target this node.
 *
 * TODO: return .id's not .pid ah well..
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getSourcePids = function(pid) {

  var i;
  var src;
  var ids = [];
  if (this.sourceMap.hasOwnProperty(pid)) {
    for (i = 0; i < this.sourceMap[pid].length; i++) {
      src = this.sourceMap[pid][i].source;

      if (ids.indexOf(src.pid) === -1) {
        ids.push(src.pid);
      }
    }
  }

  return ids;

};

/**
 *
 * Get all nodes that use this node as a source .
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getTargetPids = function(pid) {

  var i;
  var ids = [];

  if (this.targetMap.hasOwnProperty(pid)) {
    for (i = 0; i < this.targetMap[pid].length; i++) {
      ids.push(this.targetMap[pid][i].target.pid);
    }
  }

  return ids;

};

/**
 *
 * Get all node ids this node depends on.
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getAncestorPids = function(pid) {

  var i;
  var ids = [];
  var aIds = [];
  var u = [];

  aIds = ids = this.getSourcePids(pid);
  for (i = 0; i < ids.length; i++) {
    aIds = aIds.concat(this.getAncestorPids(ids[i]));
  }

  for (i = 0; i < aIds.length; i++) {
    if (u.indexOf(aIds[i]) === -1) {
      u.push(aIds[i]);
    }
  }

  return u;

};

IoMapHandler.prototype.reset = function(cb) {
  var self = this;
  this._shutdown = true;
  this.queueManager.reset(function() {
    // All writes should stop, queuemanager resets.
    // or maybe should wait for queuemanager to be empty.
    if (cb) {
      cb();
    }
    self._shutdown = false;
  });
};

IoMapHandler.prototype.receiveFromQueue = function(ioid, p) {
  if (this.connections.hasOwnProperty(ioid)) {
    this.send(this.connections[ioid], p);
  }
};
/**
 *
 * The method to provide input to this io handler.
 *
 * @param {Link} link
 * @param {Packet} p
 *
 */
IoMapHandler.prototype.send = function(link, p) {

  if (link.source.has('pointer')) { // is just a boolean

    var identifier;
    var pp;

    // THIS IS NOT THE PLACE TO CLONE, but let's try it.
    // WILL BREAK ANYWAY WITH references.
    //
    // Ok, what is _the_ location to clone.
    //
    // A package going different routes must clone.
    //
    // p = p.clone();

    // Create an identifier
    pp = this.getPointerPorts(link.source.pid);
    pp.unshift(link.source.pid);
    identifier = pp.join('-');

    // The source node+port are pointed to.
    // The packet has it's chi updated with the
    // source.pid as key and an assigned item id as value
    //
    this.CHI.pointer(
      link.source.pid,
      link.source.port,
      p,
      identifier
    );
  }

  if (link.target.has('sync')) {

    var syncPorts = this.getSyncedTargetPorts(link.target);
    this.CHI.sync(
      //link.target,
      link,
      link.target.get('sync'), // originId
      // TODO: should just only accept the packet
      p,
      syncPorts
    );

    // always return, react on CHI.on('synced')
    return;

  }

  this.__sendData(link, p);

};

/**
 *
 * The method to provide input to this io handler.
 *
 * Ok, what misses here is info on how to find the actor
 * Who needs the information
 *
 *
 * Actor:
 *
 *  ioHandler.listenTo(Object.keys(this.nodes),
 *
 * @param {Connector} target
 * @param {object} input
 * @param {object} chi
 * @private
 */

 /*
 *
 * Send Data
 *
 * @param {xLink} link - Link to write to
 * @param {Any} data - The input data
 * @private
 */

IoMapHandler.prototype.__sendData = function(link, p) {

  if (this._shutdown) {
    // TODO:: probably does not both have to be dropped during __sendData *and* during output
    this.drop(p, link);
  } else {

    var data;

    if (link.target.has('cyclic') &&
       Array.isArray(p.data) // second time it's not an array anymore
       ) {

      // grouping
      // The counter part will be 'collect'
      var g = this.CHI.group();

      if (p.data.length === 0) {
        return false;
      }

      // make a copy otherwise if output goes to several ports
      // it will receive a popped version.
      //
      // Ok, this has to be removed and source ports should set as cyclic.
      // Not target ports.
      data = JSON.parse(JSON.stringify(p.data));

      var i;

      for (i = 0; i < data.length; i++) {

        // create new packet
        var newp = new Packet(data[i]);

        // this is a copy taking place..
        newp.set('chi', p.chi ? JSON.parse(JSON.stringify(p.chi)) : {});
        g.item(newp.chi);

        this.queueManager.queue(link.ioid, newp);

      }

      // we are done grouping now.
      g.done();

      return; // RETURN
    }

    var cp = p; // current packet

    // too bad cannot check the receiver type.
    // TODO: maybe have p.type() so the packet can tell it's content type.
    // plain object is a bit harder though would have to introduce PLAIN_OBJECT type or something
    // The packet itself should tell what it is, not checking p.data externally like this.
    /*
    if (typeof cp.data === 'object' && isPlainObject(cp.data)) {
      cp.data = JSON.parse(JSON.stringify(cp.data));
    }
    */

    // Ok, I must know the receiver type if I want to do this.
    // I think the most easy way will be to just
    // register the type within the packet itself.
    // which only works if output specifies what it is..
    // it really is only the output who can determine this..
    // which means updating each and every node..
    // could I generate that... eventually that's required anyway.
    // Now, what would make it easy is a UI, where I can just quickly
    // change this, gah... :-)
    // Anyway, I fix it for emailjs now, I write the type in the packet.
    // although this seems rather overkill.
    // I could also delay, cloning just before arrival.
    // But that's kinda wrong.
    //
    // this *will* create bugs. so solve this `plain-object`[method] problem
    cloneData(cp, 'function');

    // TODO: not sure if index should stay within the packet.

    if (link.source.has('index') && !cp.hasOwnProperty('index')) {
    //if (link.source.has('index')) {
      // above already cloned if possible.
      // what is not cloned is CHI, so could cause a problem..
      cp.chi = JSON.parse(JSON.stringify(cp.chi));

      cp = p.clone(false); // important!

      console.log('INDEXXXXX', cp);

      if (undefined === cp.data[link.source.index]) {
        // this is allowed now for async array ports.
        // the component will only send one index at a time.
        // this is useful for routing.
        // maybe only enable this with a certain setting on the port later on.
        return; // nop

      } else {
        console.log('handle index...');
        cp.data = this.handleIndex(link, cp);
      }
    }

    // TODO: probably just remove this emit. (chix-runtime is using it)
    this.emit('data', {
      link: link,
      data: cp.data // only emit the data
    });

    link.write(cp);

    this.emit('receive', link);

  }

};

/**
 *
 * Handles the output of every node.
 *
 * This comes directly from the Actor, whom got it from the node.
 *
 * The emit should maybe come from the link write.
 *
 * If there is chi it will be passed along.
 *
 * @param {NodeEvent} event
 * @api public
 */
IoMapHandler.prototype.output = function(event) {

  // used by monitors
  this.emit('output', event);

  this.receive(event.node, event.port, event.out, event.action);

};

/**
 *
 * Monitor event types
 *
 * Optionally provided with a pid.
 *
 */
IoMapHandler.prototype.monitor = function(eventType, pid, cb) {

  this.__monitor(eventType, pid, cb, 'on');

};

IoMapHandler.prototype.monitorOnce = function(eventType, pid, cb) {

  this.__monitor(eventType, pid, cb, 'once');

};

IoMapHandler.prototype.__monitor = function(eventType, pid, cb, how) {

  if (!cb) {
    cb = pid;
    pid = undefined;
  }

  // bit ugly but works for now, no way to unregister.
  // hm ok, better to just always listen with one function.
  // then just keep a map of monitors. triggering the callbacks.
  // which means monitor and monitorOnce just inject callbacks.
  // [eventType]['*'] [] callbacks
  // [eventType][pid] [] callbacks
  // but how to turn yourself off?
  // ok by getting the index of the callback. just like the emitter itself does.
  //
  this[how]('output', function monitor(dat) {
    if (dat.port === this.eventType) {
      if (!this.pid || dat.node.pid === this.pid) {
        cb(dat.out); // probably dat.out not sure..
      }
    }
  }.bind({
    pid: pid,
    eventType: eventType
  }));

};

/**
 *
 * Handles the output of every node.
 *
 * If there is chi it will be passed along.
 *
 * @param {Object} dat
 * @private
 */

/*
 *  source.id
 *  source.port
 *  action should be in the source?
 *
 *  action is target information, but is the only setting used..
 *  so just have the third parameter be action for now.
 *
 *  source is the full source node.
 **/
//  this.receive(dat.node, dat.port, dat.out, dat.action);
IoMapHandler.prototype.receive = function(source, port, p, action) {

  var i;

  // If the output of this node has any target nodes
  if (this.targetMap.hasOwnProperty(source.pid)) {

    // If there are any target nodes defined
    if (this.targetMap[source.pid].length) {

      // Iterate those targets
      for (i = 0; i < this.targetMap[source.pid].length; i++) {

        // Process this link
        var xlink = this.targetMap[source.pid][i];

        // If the link is about this source port
        if (port === xlink.source.port) {

          // did this output came from an action
          // if so, is it an action we are listening for.
          if (!action || xlink.source.action === action) {

            if (xlink.source.get('collect')) {
              this.CHI.collect(xlink, p);
              continue; // will be handled by event
            }

            //var noQueue = xlink.target.has('noqueue');
            var noQueue = false;
            this.emit('send', xlink);

            // queue must always be used otherwise persist
            // will not work..

            if (noQueue) {
              // must be sure, really no queue, also not after input.
              this.send(xlink, p);
            } else {
              this.queueManager.queue(xlink.ioid, p);
            }

          }

        }
      }
    }
  }
};

/**
 *
 * Handles the index
 *
 * @param {Link} link
 * @param {Packet} p
 * @api public
 */
IoMapHandler.prototype.handleIndex = function(link, p) {

  // TODO: data should be better defined and a typed object
  var index = link.source.get('index');

  if (/^\d+/.test(index)) {

    // numeric
    if (Array.isArray(p.data)) {
      if (index < p.data.length) {

        // new remember index.
        p.index = index;

        return p.data[index];
      } else {
        throw new Error(
            util.format(
              'index[] out-of-bounds on array output port `%s`',
              link.source.port
              )
            );
      }
    } else {

      throw new Error(
        util.format(
          'Got index[] on array output port `%s`, ' +
          'but data is not of the array type',
          link.source.port
          )
        );
    }

  } else {

    if (typeof p.data === 'object') {

      if (p.data.hasOwnProperty(index)) {

        // new remember index.
        p.index = index;

        return p.data[index];

      } else {
        // maybe do not fail hard and just send to the error port.
        console.log(p.data);
        throw new Error(
          util.format(
            'Property `%s` not found on object output port `%s`',
            index,
            link.source.port
            )
          );
      }
    } else {

      throw new Error(
        util.format(
          'Got index[] on non-object output port %s',
          link.source.port
          )
        );

    }

  }

};

// collected is about the link
// a group is collected for that link
// and is thus always an array.
// this means the target should be used to re-send
// the collected input.
// the group information is actually not interesting.
// we only know we want the data from the last group.
// and use it.
IoMapHandler.prototype.collected = function(/*target, p*/) {

  /*
  data.data
  data.link
  */

};

IoMapHandler.prototype.beginGroup = function(/*group*/) {

};

IoMapHandler.prototype.sendGroup = function(/*group, data*/) {

  /*
  data.data
  data.link
  */

};

/**
 *
 * Add Queue Manager.
 *
 * @param {QueueManager} qm
 * @api private
 *
 */
IoMapHandler.prototype.addQueueManager = function(qm) {

  this.queueManager = qm;

};

IoMapHandler.prototype.getSyncedTargetPorts = function(target) {

  var originId = target.get('sync');

  if (!this.syncedTargetMap.hasOwnProperty(target.pid)) {
    throw new Error(util.format('Unkown sync: `%s`', target.pid));
  }

  if (!this.syncedTargetMap[target.pid].hasOwnProperty(originId)) {
    throw new Error(util.format('Unkown sync with: `%s`', originId));
  }

  // returns the ports array, those who wanna sync with originId
  return this.syncedTargetMap[target.pid][originId];

};

IoMapHandler.prototype.getPointerPorts = function(originId) {
  if (this.pointerPorts.hasOwnProperty(originId)) {
    return this.pointerPorts[originId];
  } else {
    throw new Error(util.format('%s has no pointer ports', originId));
  }
};

/**
 *
 * Send synchronized input
 *
 * TODO: Input is synced here then we
 *   throw it into the input sender.
 *   They probably stay synced, but
 *   it's not enforced anywhere after this.
 *
 * @param {string} targetId
 * @param {object} data
 */
IoMapHandler.prototype.sendSynced = function(targetId, data) {

  for (var targetPort in data) {
    if (data.hasOwnProperty(targetPort)) {
      var synced = data[targetPort];

      // opens all queues, a it radical..
      this.queueManager.flushAll();

      // keep in sync, do not use setImmediate
      this.__sendData(synced.link, synced.p);
    }
  }

};

IoMapHandler.prototype.drop = function(packet, origin) {
  // TODO: drop data/packet gracefully
  console.warn('IoMapHandler: Dropping packet', packet, origin);
  this.emit('drop', packet);
};

module.exports = IoMapHandler;

},{"../packet":18,"../queue/defaultManager":20,"chix-chi":28,"events":1,"is-plain-object":35,"util":6,"uuid":42}],13:[function(require,module,exports){
'use strict';

var util      = require('util');
var uuid      = require('uuid').v4;
var Connector = require('./connector');
var Setting   = require('./setting');

/**
 *
 * xLink
 *
 *
 * Settings:
 *
 *   - ttl
 *   - expire
 *   - dispose: true
 *
 * Just need something to indicate it's an iip.
 *
 * @constructor
 * @public
 */
function Link(id, ioid) {

  this.fills   = 0;
  this.writes  = 0;
  this.rejects = 0;
  this.id = id === undefined ? uuid() : id;
  this.ioid = ioid || uuid();

}

util.inherits(Link, Setting);

Link.create = function(id, ioid) {

  var link = new Link(id, ioid);
  return link;

};

/**
*
* Set target
*
* @param {String} targetId
* @param {String} port
* @param {Object} settings
* @param {String} action
* @public
*/
Link.prototype.setTarget = function(targetId, port, settings, action) {

  this.target = new Connector(settings);
  this.target.wire = this;
  this.target.plug(targetId, port, action);

};

Link.prototype.write = function(p) {

  this.writes++;

  // just re-emit
  this.emit('data', p);

};

/**
*
* Set Source
*
* @param {Object} sourceId
* @param {String} port
* @param {Object} settings
* @param {String} action
* @public
*/
Link.prototype.setSource = function(sourceId, port, settings, action) {

  this.source = new Connector(settings);
  this.source.wire = this;
  this.source.plug(sourceId, port, action);

};

/**
 *
 * Setting of pid's is delayed.
 * I would like them to be available during plug.
 * but whatever.
 *
 */

Link.prototype.setSourcePid = function(pid) {
  this.source.setPid(pid);
};

Link.prototype.setTargetPid = function(pid) {
  this.target.setPid(pid);
};

/**
*
* Set Title
*
* @param {String} title
* @public
*/
Link.prototype.setTitle = function(title) {

  this.metadata = {};
  this.metadata.title = title;

};

Link.prototype.clear = function() {

  this.fills   = 0;
  this.writes  = 0;
  this.rejects = 0;

};

Link.prototype.toJSON = function() {

  // TODO: use schema validation for toJSON
  if (!this.hasOwnProperty('source')) {
    console.log(this);
    throw Error('Link should have a source property');
  }
  if (!this.hasOwnProperty('target')) {
    throw Error('Link should have a target property');
  }

  var link = {
    id: this.id,
    source: this.source.toJSON(),
    target: this.target.toJSON()
  };

  if (this.metadata) {
    link.metadata = this.metadata;
  }

  // not sure if these are really needed.
  // else maybe put them in this.stats or something
  if (this.fills) {
    link.fills = this.fills;
  }

  if (this.rejects) {
    link.rejects = this.rejects;
  }

  if (this.writes) {
    link.writes = this.writes;
  }

  if (this.data !== undefined) {
    link.data = JSON.parse(JSON.stringify(this.data));
  }

  return link;
};

module.exports = Link;

},{"./connector":9,"./setting":24,"util":6,"uuid":42}],14:[function(require,module,exports){
'use strict';

/**
 * Function to sort multidimensional array
 *
 * Simplified version of:
 *
 *   https://coderwall.com/p/5fu9xw
 *
 * @param {array} a
 * @param {array} b
 * @param {array} columns List of columns to sort
 * @param {array} orderBy List of directions (ASC, DESC)
 * @param {array} index
 * @returns {array}
 */
function multisortRecursive(a, b, columns, orderBy, index) {
  var direction = orderBy[index] === 'DESC' ? 1 : 0;

  var x = a[columns[index]];
  var y = b[columns[index]];

  if (x < y) {
    return direction === 0 ? -1 : 1;
  }

  if (x === y)  {
    return columns.length - 1 > index ?
      multisortRecursive(a, b, columns, orderBy, index + 1) : 0;
  }

  return direction === 0 ? 1 : -1;
}

module.exports = function(arr, columns, orderBy) {

  var x;
  if (typeof columns === 'undefined') {
    columns = [];
    for (x = 0; x < arr[0].length; x++) {
      columns.push(x);
    }
  }

  if (typeof orderBy === 'undefined') {
    orderBy = [];
    for (x = 0; x < arr[0].length; x++) {
      orderBy.push('ASC');
    }
  }

  return arr.sort(function(a, b) {
    return multisortRecursive(a, b, columns, orderBy, 0);
  });
};

},{}],15:[function(require,module,exports){
'use strict';

var Packet = require('./packet');
var util = require('util');
var NodeBox = require('./sandbox/node');
var PortBox = require('./sandbox/port');
var xNode = require('./node/interface');

// Running within vm is also possible and api should stay
// compatible with that, but disable for now.
// vm = require('vm'),

/**
 * Error Event.
 *
 * @event Node#error
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} msg - The error message
 */

/**
 * Executed Event.
 *
 * @event Node#executed
 * @type {object}
 * @property {object} node - An export of this node
 */

/**
 * Context Update event.
 *
 * @event Node#contextUpdate
 */

/**
 * Output Event.
 *
 * Fired multiple times on output
 *
 * Once for every output port.
 *
 * @event Node#output
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} port - The output port
 * @property {string} out - A (reference) to the output
 */

/**
 *
 * Node
 *
 * TODO:
 *   do not copy all those properties extend the node object itself.
 *   however, do not forget the difference between a nodeDefinition
 *   and a node.
 *
 *   node contains the process definition, which is the node
 *   definition merged with the instance configuration.
 *
 * @author Rob Halff <rob.halff@gmail.com>
 * @param {String} id
 * @param {Object} node
 * @param {String} identifier
 * @param {CHI} CHI
 * @constructor
 * @public
 */
function Node(id, node, identifier, CHI) {

  // not sure where to call this yet.
  Node.super_.apply(this, [id, node, identifier, CHI]);

  this.type = 'node';

  this.state = {};

  /**
   *
   * Indicates whether this instance is active.
   *
   * This works together with the active state
   * of the sandbox.
   *
   * When a blackbox sends async output done()
   * should be used to inform us it is done.
   *
   * @member {Boolean} active
   * @public
   */
  this.active = false;

  /**
   *
   * Indicates whether this node expects async input.
   *
   * Async input listening is done by:
   *
   *   on.input.<port-name> = function() {}
   *
   * Any node can send async output.
   *
   * Async nodes are handled differently, their function body
   * is only executed once, during startup.
   *
   * I think the port input function can be handled the same
   * as a normal function body, we'll just have several
   * functions to execute based on what input port is targeted.
   *
   * The common state is represented in the `state` object.
   * This is the only variable which is accessible to all ports
   * and during startup.
   *
   */

  // detection of async is still needed.
  // Really should all just be different classes.
  // Problem now, we have to run the nodebox to
  // determine async, which is a super hacky way.
  this.async = node.type === 'async' ? true : false;
  this.async = node.async ? true : this.async;

  // used for the async port sandboxes
  this.portBox = {};

  this.nodebox = new NodeBox();

  // done() is added to the nodebox
  this.nodebox.set('done', this.complete.bind(this));
  this.nodebox.set('cb', this._asyncOutput.bind(this));
  this.nodebox.set('state', this.state);

  // will be filled during portFill

  // this can be overriden by connections
  // a functionality which probably will be removed
  this._setup();

/*
  Object.defineProperty(this, 'status', {
    enumerable: true,
    configurable: false,
    get: function() {
      // go through all status options here.

      // node box

      // port boxes, have to take done() into account
    }
  });
*/

  /** @member {Mixed} chi */
  this.chi = {};

  /** delay interval */
  this.interval = 100;

  /** @member {Object} input */
  this.input = {};

  /** @member {Object} context */
  this.context = {};

  /** @member {Object} dependencies */
  this.dependencies = node.dependencies || {};

  /** @member {Array} expose */
  this.expose = node.expose;

  /** @member {String} fn */
  this.fn = node.fn;

  /**
   * @member {Numeric} nodeTimeout
   * @default 3000
   */
  this.nodeTimeout = node.nodeTimeout || 3000;

  /**
   *
   * inputTimeout in milliseconds
   *
   * If inputTimeout === `false` there will be no timeout
   *
   * @member {Mixed} inputTimeout
   * @default 3000
   */
  this.inputTimeout = typeof node.inputTimeout === 'undefined' ?
    3000 : node.inputTimeout;

  /** @private */
  this.__halted = false; // was halted by a hold

  /** @private */
  this._inputTimeout = null;

  // Solving yet another `design` problem
  // object containing the current connections in use
  // will be reset during free Port.
  // Also belongs to the port objects.
  this._activeConnections = {};

  this.status = 'init';

  // setup the core
  this._fillCore(node.fn, node.name);

  // If this node is async, run it once
  // all ports will be setup and sandbox state will be filled.
  if (this.async) {
    this._loadAsync();
  }

}

util.inherits(Node, xNode);

// TODO: this generic, however options does not exists anymore, it's settings
Node.prototype._setup = function() {

  for (var port in this.ports.input) {
    if (this.ports.input.hasOwnProperty(port)) {
      if (this.ports.input[port].options) {
        for (var opt in this.ports.input[port].options) {
          if (this.ports.input[port].options.hasOwnProperty(opt)) {
            this.setPortOption(
              'input',
              port,
              opt,
              this.ports.input[port].options[opt]);
          }
        }
      }
    }
  }

};

Node.prototype.start = function() {

  var sb;

  if (this.status === 'created') {

    this.setStatus('started');

    if (this.nodebox.on.start) {
      // Run onStart functionality first
      sb = this._createPortBox(this.nodebox.on.start.toString());
      sb.run(this);
      this.nodebox.state = this.state = sb.state;
    }

    this.emit('started', {
      node: this.export()
    });

  }

};

Node.prototype.hasData = function(port) {
  return undefined !== this.input[port];
};

Node.prototype.fill = function(target, data) {

  var p = data instanceof Packet ? data : new Packet(data);
  var ret = this._receive(p, target);

  if (ret !== true) {
    // ok doesn't say much by itself.
    // especially since on next cycle it could be filled
    // filled is more valuable
    if (this.ports.input.hasOwnProperty(target.port)) {
      this.ports.input[target.port].rejects++;
      this.ports.input[target.port].lastError = ret;
    }
  }

  return ret;

};

/**
 * Usage of `$`
 *
 * Idea is to do the reverse of super() all extending `classes`
 * only have $ methods.
 *
 * @param {type} port
 * @param {type} data
 * @returns {undefined}
 * @shielded
 */
Node.prototype.$setContextProperty = function(port, data) {
  this.context[port] = data;
};

Node.prototype.clearContextProperty = function(port) {

  delete this.context[port];

  this.event(':contextClear', {
    node: this,
    port: port
  });
};

/**
 *
 * Starts the node
 *
 * TODO: dependencies are always the same, only input is different.
 * dependencies must be created during createScript.
 * also they must be wrapped within a function.
 * otherwise you cannot overwrite window and document etc.
 * ...Maybe statewise it's a good thing, dependencies are re-required.
 *
 * FIXME: this method does too much on it's own.
 *
 * Note: start is totally unprotected, it assumes the input is validated
 * and all required ports are filled.
 * Start should never really be called directly, the node starts when
 * input is ready.
 *
 * @param {Function} fn
 * @param {String} name
 * @fires Node#error
 * @fires Node#require
 * @fires Node#expose
 * @private
 */
Node.prototype._delay = 0;

Node.prototype.__start = function() {

  if (this.active) {
    // try again, note: this is different from input queueing..
    // used for longer running processes.
    this._delay = this._delay + this.interval;
    setTimeout(this.start.bind(this), 500 + this._delay);
    return false;
  }

  // set active state.
  this.active = true;

  // Note: moved to the beginning.
  this.runCount++;

  if (!this.async) {
    if (this.nodebox.on) {
      if (this.nodebox.on.shutdown) {
        this.shutdown();
      }
    }
  }

  this.nodebox.input = this.input;

  // difference in notation, TODO: explain these constructions.
  // done before compile.
  // this.nodebox.output = this.async ? this._asyncOutput.bind(this) : {};

  this._runOnce();

};

/**
 *
 * Runs the node
 *
 * @fires Node#nodeTimeout
 * @fires Node#start
 * @fires Node#executed
 * @private
 */
Node.prototype._runOnce = function() {

  var t = setTimeout(function() {

    /**
     * Timeout Event.
     *
     * @event Node#nodeTimeout
     * @type {object}
     * @property {object} node - An export of this node
     */
    this.event(':nodeTimeout', {node: this.export()});

  }.bind(this), this.nodeTimeout);

  /**
   * Start Event.
   *
   * @event Node#start
   * @type {object}
   * @property {object} node - An export of this node
   */
  this.event(':start', {node: this.export()});

  //this.nodebox.runInNewContext(this.sandbox);
  //
  // ok, this depends on what is the code whether it's running or not...
  // that's why async should be definied per port.
  this.setStatus('running');

  this.nodebox.run();
  this.state = this.nodebox.state;

  this.event(':executed', {node: this});

  clearTimeout(t);

  // Ok if there are portboxes, how to treat this first run.
  // it's a setup phase. yet it will fire complete.
  this._output(this.nodebox.output);
};

/**
 *
 * Fills the core of this node with functionality.
 *
 * @param {Function} fn
 * @param {String} name
 * @fires Node#fillCore
 * @private
 */
Node.prototype._fillCore = function(fn, name) {

  /**
   * Fill Core Event.
   *
   * @event Node#fillCore
   * @type {object}
   * @property {object} node - An export of this node
   * @property {function} fn - The function being installed
   * @property {string} fn - The name of the function
   */
  this.event(':fillCore', {
    node: this.export(),
    fn: fn,
    name: name
  });

  this.nodebox.require(this.dependencies.npm);
  this.nodebox.expose(this.expose, this.CHI);

  // still not working..
  this.nodebox.set('output', this.async ? this._asyncOutput.bind(this) : {});

  this.nodebox.compile(fn);

  this.setStatus('created');

};

/**
 *
 * Executes the async variant
 *
 * state is the only variable which will persist.
 *
 * @param {string} fn - Portbox Function Body
 * @returns {PortBox}
 * @private
 */
Node.prototype._createPortBox = function(fn) {

  var portbox = new PortBox();
  // state is not remembered ?
  portbox.set('state', this.nodebox.state);
  //portbox.set('state', this.nodebox.args.state);
  portbox.set('output', this._asyncOutput.bind(this));
  portbox.require(this.dependencies.npm, true);
  portbox.expose(this.expose, this.CHI);

  fn = fn.slice(
    fn.indexOf('{') + 1,
    fn.lastIndexOf('}')
  );

  portbox.compile(fn);

  return portbox;

};

/**
 *
 * @private
 */
Node.prototype._loadAsync = function() {

  // This collects the port definitions they
  // attach to `on`
  this.nodebox.run();

  for (var port in this.ports.input) {

    if (this.ports.input.hasOwnProperty(port)) {

      // If there is a port function defined for this port
      // it means it's async
      if (this.nodebox.on.input.hasOwnProperty(port)) {

        this.portBox[port] = this._createPortBox(
          this.nodebox.on.input[port].toString()
        );

        // (dynamically) declare this port as async
        // for clarity this could also be pre-defined within the definition.

        // Seems like soon this will be the own option anyway..
        this.async = true;
        this.ports.input[port].async = true;

      } else {

        // It is a sync port

      }

    }
  }

  this.setStatus('created');

  // could just act on general status change event, who uses this?
  this.emit('created', {
    node: this.export()
  });

  this.state = this.nodebox.state;

  // setup phase for async, they can use output = {}
  // note: this runs during creation, maybe not the best setup.
  // but works for now.
  // Ok during init and you use output = is useless
  // it sends output but there are no listeners yet.
  // links are not yet setup
  // So how to do this, I setup an api using require.
  // that's during script load.
  // so then it's setup, I need to send it out.
  // but if all is async, it will not be send out.
  // on.start
  // so if on.start is found I run it overhere.
  // the main problem is, I never 'start' async nodes.
  // sync nodes are started but also internally.
  // Normally nodes should first be created and sit idle.
  // Because nodes are started by connections or iips.
  // there is no fixed starting point.
  // ok I can do if !this.started and on.start is set.
  // then run it.
  // this._output(this.nodebox.output);

};

// Ok here is what to do:
//
// - Put async in this.input[port] if it's not filled yet
// - Check whether all is filled
// - if so, fill all sync (fill.defaults)
// - fill defaults also fills all other async stuff.
// - fill async port.

/**
*
* Generic Callback wrapper
*
* Will collect the arguments and pass them on to the next node
*
* So technically the next node is the callback.
*
* Parameters are defined on the output as ports.
*
* Each callback argument must be defined as output port in the callee's schema
*
* e.g.
*
*  node style callback:
*
*  ports.output: { err: ..., result: ... }
*
*  connect style callback:
*
*  ports.output: { req: ..., res: ..., next: ... }
*
* The order of appearance of arguments must match those of the ports within
* the json schema.
*
* TODO: Within the schema you must define the correct type otherwise output
* will be refused
*
*
* @private
*/
Node.prototype._callbackWrapper = function() {

  var i;
  var obj = {};
  var ports;

  ports = this.outPorts;

  for (i = 0; i < arguments.length; i++) {

    if (!ports[i]) {

      // TODO: eventemitter expects a new Error()
      // not the object I send
      // Not sure what to do here, it's not really fatal.
      this.event(':error', {
        msg: Error(
          util.format('Unexpected extra port of type %s',
          typeof arguments[i] === 'object' ?
            arguments[i].constructor.name : typeof arguments[i]
          )
        )
      });

    } else {

      obj[ports[i]] = arguments[i];

    }
  }

  this._output(obj);

};

/**
*
* Execute the delegated callback for this node.
*
* [fs, 'readFile', '/etc/passwd']
*
* will execute:
*
* fs['readFile']('/etc/passwd', this.callbackWrapper);
*
* @param {Object} output
* @fires Node#branching
* @private
*/
Node.prototype._delegate = function(output) {

  // pop() because splice will return an array.
  var fn = output.splice(0, 1).pop();
  var method = output.splice(0, 1).pop();

  /**
   * Branching Event.
   *
   * Fired when a delegated callback gets executed.
   *
   * Sending it away on it's own quest.
   *
   * @event Node#branching
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} method - The method name
   */
  this.event(':branching', {
    // TODO: the _function_ way is not covered now.
    // rendering this.event a bit useless...
    node: this.export(),
    method: method
  });

  output.push(this._callbackWrapper.bind(this));
  fn[method].apply(fn, output);
};

/**
*
* This node handles the output of the `blackbox`
*
* It is specific to the API of the internal Chix node function.
*
* out = { port1: data, port2: data }
* out = [fs.readFile, arg1, arg2 ]
*
* Upon output the input will be freed.
*
* @param {Object} output
* @param {Object} chi
* @fires Node#output
* @private
*/
Node.prototype._asyncOutput = function(output, chi) {

  var port;

  // Ok, delegate and object output has
  // synchronous output on _all_ ports
  // however we do not know if we we're called from
  // the function type of output..
  for (port in output) {
    if (output.hasOwnProperty(port)) {
      this.sendPortOutput(port, output[port], chi);
    }
  }

};

/**
 *
 * Output
 *
 * Directs the output to the correct handler.
 *
 * If output is a function it is handled by asyncOutput.
 *
 * If it's an array, it means it's the shorthand variant
 *
 * e.g. output = [fs, 'readFile']
 *
 * This will be handled by the delegate() method.
 *
 * Otherwise it is a normal output object containing the output for the ports.
 *
 * e.g. { out1: ...,  out2: ...,  error: ... } etc.
 *
 * TODO: not sure if this should always call complete.
 *
 * @param {Object} output
 * @private
 */
Node.prototype._output = function(output) {

  var port;

  if (typeof output === 'function') {
    output.call(this, this._asyncOutput.bind(this));
    return;
  }

  if (Array.isArray(output)) {
    this._delegate(output);
    return;
  }

  for (port in output) {
    if (output.hasOwnProperty(port)) {
      this.sendPortOutput(port, output[port]);
    }
  }

  this.complete();

};

/**
 *
 * @param {string} port
 * @private
 */

Node.prototype._runPortBox = function(port) {

  var sb = this.portBox[port];
  // fill in the values

  this.event(':start', {node: this.export()});

  sb.set('data', this.input[port]);
  sb.set('x', this.chi);
  sb.set('state', this.state);
  // sb.set('source', source); is not used I hope
  sb.set('input', this.input); // add all (sync) input.

  this.setStatus('running');

  var ret = sb.run(this);

  this.nodebox.state = this.state = sb.state;

  if(ret === false) {
    // if ret === false input should be revoked and re-queued.
    // which means it must look like we didn't accept the packet in
    // the first place.

    // this.setStatus('idle');
    var d = this.input[port];

    // freePort somehow doesn't work
    // only the below + unlock during unshift works.
    // but has the danger of creating an infinite loop.
    // if rejection is always false.
    delete this.input[port];
    delete this._activeConnections[port];

    this.event(':portReject', {
      node: this.export(),
      port: port,
      data: d // TODO: other portReject emits full packet instead of data.
    });

    return false;
  }

  // todo portbox itself should probably also
  // maintain it's runcount, this one is cumulative
  this.runCount++;

  this.event(':executed', {
    node: this,
    port: port
  });

};

/**
*
* Contains much of the port's logic, this should be abstracted out
* into port objects.
*
* For now just add extra functionality overhere.
*
* TODO:
*  - Detect if the input port is defined as Array.
*  - If it is an array, detect what is it's behaviour
*
* Behaviours:
*  - Multiple non-array ports are connected: wait until all have send
*    their input and release the array of data.
*  - One port is connect of the type Array, just accept it and run
*  - Multiple array ports give input/are connected... same as the above
*  Arrays will be handled one by one.
*  - So basically, if we receive an array, we process it.
*  If it is not we will join multiple connections.
*  - If there is only one port connected and it is not of an array type
*    We will just sit there and wait forever,
*    because we cannot make an array out of it.
* - I think the rules should be simple, if you want it more complex,
*   just solve it within the flow by adding extra nodes.
*   What a port does must be understandable.  So that's why it's also good if
*   you can specify different kind of port behaviour.
*   So if you do not like a certain kind of behaviour, just select another one.
*   Yet all should be simple to grasp. You could also explain an array as being
*   a port that expects multiple.
*
*   The filled concept stays the same, the only thing changing is when we
*   consider something to be filled.
*
*   So.. where is the port type information.
*
// TODO: once a connection overwrites a setting.
// it will not be put back, this is a choice.
// at what point do we set persistent from a link btw?
//
// TODO: has become a bit of a weird method now.
*/

Node.prototype.handlePortSettings = function(port) {
  if (this.ports.input.hasOwnProperty(port)) {
  }
};

/**
 * Fill one of our ports.
 *
 * First the input data will be validated. A port
 * will only be filled if the data is of the correct type
 * or even structure.
 *
 * The following events will be emitted:
 *
 *   - `portFill`
 *   - `inputTimeout`
 *   - `clearTimeout` (TODO: remove this)
 *
 * FIXME:
 *  - options are set and overwritten on portFill
 *    which is probably undesired in most cases.
 *
 *  - portFill is the one who triggers the start of a node
 *    it's probably better to trigger an inputReady event.
 *    and start the node based on that.
 *
 * @param {Connector} target
 * @param {Packet} p
 * @returns {Node.error.error|Boolean}
 * #private
 */
Node.prototype._fillPort = function(target, p) {

  var res;

  if (undefined === p.data) {
    return Error('data may not be `undefined`');
  }

  // Not used
  //this.handlePortSettings(target.port);

  // PACKET WRITE, TEST THIS
  p.data = this._handleFunctionType(target.port, p.data);

  res = this._validateInput(target.port, p.data);

  if (util.isError(res)) {

    return res;

  } else {

    // todo: this logic must be externalized.
    // node doesn't know about persist
    if (!target.has('persist')) {

      try {

        // CHI MERGING check this.
        // Or is this to early, can we still get a reject?
        this.CHI.merge(this.chi, p.chi);
      } catch (e) {
        console.log('Packet', p);
        // this means chi was not cleared,
        // yet the input which caused the chi setting
        // freed the port, so how is this possible.
        return this.error(util.format(
          '%s: chi item overlap during fill of port `%s`\n' +
          'chi arriving:\n%s\nchi already collected:\n%s',
          this.identifier,
          target.port,
          JSON.stringify(p.chi),
          JSON.stringify(this.chi)
        ));
      }

    }

    // this.filled++;

    /**
     * Port Fill Event.
     *
     * Occurs when a port is filled with data
     *
     * At this point the data is already validated
     *
     * @event Node#portFill
     * @type {object}
     * @property {object} node - An export of this node
     * @property {string} port - Name of the port
     */
    //this.event(':portFill', {
    //todo: not all events are useful to send as output
    //TODO: just _do_ emit both
    this.emit('portFill', {
      node: this.export(),
      link: target.wire,
      port: target.port
    });

    this.event(':portFill', {
      node: this.export(),
      link: target.wire,
      port: target.port
    });

    if (
      !this._inputTimeout &&
      this.inputTimeout &&
      //!this.getPortOption('input', port, 'persist')
      !target.has('persist')
      ) {

      this._inputTimeout = setTimeout(function() {

      /**
       * Input Timeout Event.
       *
       * Occurs when there is an input timeout for this node.
       *
       * This depends on the inputTimeout property of the node.
       * If inputTimeout is false, this event will never occur.
       *
       * @event Node#inputTimeout
       * @type {object}
       * @property {object} node - An export of this node
       */
        this.event(':inputTimeout', {
          node: this.export()
        });

      }.bind(this), this.inputTimeout);
    }

    // used during free port to find back our connections.
    // Should belong to the port object (non existant yet)
    if (target.wire) { // direct node.fill() does not have it

      // does not really happen can be removed..
      if (this._activeConnections[target.port]) {
        throw Error('There still is a connection active');
      } else {
        this._activeConnections[target.port] = target.wire;
      }
    }

    // set input port data
    // this could be changed to still contain the Packet.
    this._fillInputPort(target.port, p.data);

    return this._readyOrNot();

  }

};

/**
 *
 * @param {string} port
 * @param {Mixed} value
 * @private
 */
Node.prototype._fillInputPort = function(port, value) {

  this.input[port] = value;

  // increment fill counter
  this.ports.input[port].fills++;

};

/* Unused?
Node.prototype.syncFilled = function() {

  var port;

  for (port in this.input) {
    if (!this.ports.input[port].async &&
       typeof this.input[port] === 'undefined') {
      return false;
    }
  }

  return true;

};

Node.prototype.syncFilledCount = function() {

  var port;

  var cnt = 0;
  for (port in this.input) {
    if (!this.ports.input[port].async &&
       typeof this.input[port] !== 'undefined') {
      cnt++;
    }
  }

  return cnt;

};
*/

/***
 *
 * Async problem.
 *
 * start() -> isStartable()
 *
 * If links are not connected yet, this logic will not work.
 * However, how to know we are complete.
 * addnode addnode addlink addlink etk
 *
 *
 *
 */
// ok, nice, multiple ip's will not be possible?, yep..
Node.prototype.isStartable = function() {

  if (this.hasConnections()) {
    // should never happen with IIPs so fix that bug first
    return false;
  }

  var fillable = 0;
  for (var port in this.ports.input) {
    // null is possible..
    if (this.ports.input[port].default !== undefined) {
      fillable++;
    } else if (this.context[port]) {
      fillable++;
    } else if (port === ':start') {
      fillable++;
    } else if (!this.ports.input[port].required) {
      fillable++;
    }
  }

  return fillable === this.inPorts.length;

};

/**
 *
 * Determines whether we are ready to go.
 * And starts the node accordingly.
 *
 * TODO: it's probably not so smart to consider default
 * it means we can never send an IIP to a port with a default.
 * Because the default will already trigger the node to run.
 *
 * @private
 */
Node.prototype._readyOrNot = function() {

  // all connected ports are filled.
  if (this._allConnectedSyncFilled()) {

    if (this._inputTimeout) {
      clearTimeout(this._inputTimeout);
    }

    // Check context/defaults and fill it
    var ret = this._fillDefaults();

    // TODO: if all are async, just skip all the above
    // async must be as free flow as possible.
    if (util.isError(ret)) {

      // this *is* a node error.
      return this.error(ret);

    } else {

      // temp for debug
      //this.ready = true;

      // todo better to check for ready..
      if (this.status !== 'hold') {

        if (this.async) {

          // really have no clue why these must run together
          // and why I try to support 4 different ways of writing
          // a component and sqeeze it into one class.

          var async_ran = 0;
          for (var port in this.ports.input) {

            // run all async which have input.
            // persistent async will have input etc.
            if (this.ports.input[port].async &&
               this.input[port] !== undefined) {

              ret = this._runPortBox(port);

              if (ret === false) {
                // revoke input
                if (async_ran > 0) {
                  // only problem now is the multpile async ports.
                  //
                  throw Error('Input revoked, yet one async already ran');
                }
                return false;
              }

              async_ran++;

            }
          }

          if (async_ran > 0) {
            this.freeInput();
          }

        } else { // not async

          if (Object.keys(this.input).length !== this.inPorts.length) {

            return this.error(util.format(
              'Input does not match, Input: %s, InPorts: %s',
              Object.keys(this.input).toString(),
              this.inPorts.toString()
            ));

          } else {

            this.setStatus('running');
            this.__start();

          }

        }

      } else {
        this.__halted = true;
      }

    }

    return true;
  }

  return false;

};

/**
 *
 * Fills the ports with context and defaults.
 *
 * Both can be overridden by just sending to these ports.
 *
 * This means even though nothing was directly send to this
 * ports they are still considered filled.
 *
 * I should check here whether a port is async.
 * then if it's not bail out. on, has this information.
 * But it's a bit hackish to test that.
 * But for now just do that. Let's internally
 * just set ports.input[port].async to true during
 * build-up.
 *
 * @private
 */
Node.prototype._fillDefaults = function() {

  var ret;

  for (var port in this.ports.input) {
    if (this.ports.input.hasOwnProperty(port)) {
      ret = this._fillDefault(port);
      if (util.isError(ret)) {
        return ret;
      }
    }
  }

  return true;

};

Node.prototype._checkIt = function(obj, key, input, context, persist) {

  if (obj[key].properties) { //
    var init;

    if (!input[key]) {
      input[key] = {};
      init = true;
    }

    for (var k in obj[key].properties) {
      if (obj[key].properties.hasOwnProperty(k)) {
        if (!this._checkIt(
          obj[key].properties,
          k,
          input[key],
          context ? context[key] : {},
          persist ? persist[key] : {}
        )) {
  /*
          throw new Error([
            this.identifier + ': Cannot determine input for property:',
            key + '[' + k + ']'
          ].join(' '));
  */
        }
      }
    }

    if (!Object.keys(input[key]).length && init) {
      // remove empty object again
      delete input[key]; // er ref will not work probably.
    }

    return true;

  } else {

    // check whether input was defined for this port
    if (!input.hasOwnProperty(key)) {
      // if there is context, use that.
      if (context && context.hasOwnProperty(key)) {
        input[key] = context[key];
        return true;
      // check the existance of default (a value of null is also valid)
      } else if (persist && persist.hasOwnProperty(key)) {
        input[key] = persist[key];
        return true;
      } else if (obj[key].hasOwnProperty('default')) {
        input[key] = obj[key].default;
        return true;
      } else if (obj[key].required === false) {
        // filled but empty let the node handle it.
        input[key] = null;
        return true;
      } else {
        return false;
      }

    } else {
      return true;
    }

  }
};

// also fill the defaults one level deep..
/**
 *
 * @param {string} port
 * @private
 */
Node.prototype._fillDefault = function(port) {
  if (!this._checkIt(
    this.ports.input,
    port,
    this.input,
    this.context
    ) && !this.ports.input[port].async) {

    if (port[0] !== ':') {
      // fail hard
      return Error(util.format(
        '%s: Cannot determine input for port `%s`',
        this.identifier,
        port
      ));
    }

  }
};

/**
 *
 * Frees the input
 *
 * After a node has run the input ports are freed,
 * removing their reference.
 *
 * Exceptions:
 *
 *  - If the port is set to persistent, it will keep it's
 *    reference to the variable and stay filled.
 *
 * NOTE: at the moment a port doesn't have a filled state.
 *  we only count how many ports are filled to determine
 *  if we are ready to run.
 *
 * if a node is still in active state it's input can also not
 * be freed... at the moment it will do so, which is bad.
 *
 * @public
 */
Node.prototype.freeInput = function() {

  var i;

  // this.filled = 0;

  // Reset this.chi.
  // must be before freePort otherwise chi will overlap
  this.chi = {};

  var port;

  var freed = [];
  for (i = 0; i < this.inPorts.length; i++) {

    port = this.inPorts[i];

    // TODO: don't call freeInput in the first place if undefined
    if (this.input[port] !== undefined) {
      this.freePort(port);
      freed.push(port);
    }
  }

};

Node.prototype.$portIsFilled = function(port) {
  return this.input.hasOwnProperty(port);
};

Node.prototype.clearInput = function(port) {
  delete this.input[port];
};

Node.prototype.freePort = function(port) {

  var persist = this.getPortOption('input', port, 'persist');
  if (persist) {
    // persist, chi, hmz, seeze to exist.
    // but wouldn't matter much, with peristent ports.
    // TODO: this.filled is not used anymore.

    // indexes are persisted per index.
    if (Array.isArray(persist)) {
      for (var k in this.input[port]) {
        if (persist.indexOf(k) === -1) {
          // remove
          delete this.input[port][k];
        }
      }
    }

  } else {

    // this also removes context and default..
    this.clearInput(port);

    this.event(':freePort', {
      node: this.export(),
      link: this._activeConnections[port], // can be undefined, ok
      port: port
    });

    this.emit('freePort', {
      node: this.export(),
      link: this._activeConnections[port],
      port: port
    });

    // delete reference to active connection (if there was one)
    // delete this._activeConnections[port];
    this._activeConnections[port] = null;
  }

};

/**
*
* Checks whether all required ports are filled
*
* Used to determine if this node should start running.
*
* @public
*/
Node.prototype.allConnectedFilled = function() {
  for (var port in this.openPorts) {
    if (this.input[port] === undefined) {
      return false;
    }
  }
  return true;
};

/**
 *
 * @private
 */
Node.prototype._allConnectedSyncFilled = function() {

  for (var i = 0; i < this.openPorts.length; i++) {
    var port = this.openPorts[i];
    if (!this.ports.input[port].async) {

      if (this.ports.input[port].indexed) {
        if (this.ports.input[port].type === 'object') {
          return this._objectPortIsFilled(port);
        } else {
          return this._arrayPortIsFilled(port);
        }
      } else if (this.input[port] === undefined) {
        return false;
      }
    }
  }

  return true;
};

/**
*
* Wires a source port to one of our ports
*
* target is the target object of the connection.
* which consist of a source and target object.
*
* So in this calink.se the target is _our_ port.
*
* If a connection is made to the virtual `:start` port
* it will be created automatically if it does not exist already.
*
* The port will be set to the open state and the connection
* will be registered.
*
* A port can have multiple connections.
*
* TODO: the idea was to also keep track of
*       what sources are connected.
*
* @private
*/
Node.prototype._initStartPort = function() {
  // add it to known ports
  if (!this.portExists('input', ':start')) {
    this.addPort('input', ':start', {
      type: 'any',
      rejects: 0,
      fills: 0
    });
  }
};

/**
*
* Holds all input until release is called
*
* @public
*/
Node.prototype.hold = function() {
  this.setStatus('hold');
};

/**
*
* Releases the node if it was on hold
*
* @public
*/
Node.prototype.release = function() {

  this.setStatus('ready');

  if (this.__halted) {
    this.__halted = false;
    this._readyOrNot();
  }
};

/**
*
* Node completion
*
* Sends an empty string to the :complete port.
* Each node automatically has one of those available.
*
* Emits the complete event and frees all input ports.
*
* @private
*/
Node.prototype.complete = function() {

  this.active = false;

  // uses this.event() now.
  // this.sendPortOutput(':complete', '', this.chi);

  /**
   * Complete Event.
   *
   * The node has completed.
   *
   * TODO: a node can set itself as being active
   * active must be taken into account before calling
   * a node complete. As long as a node is active
   * it is not complete.
   *
   * @event Node#complete
   * @type {object}
   * @property {object} node - An export of this node
   */

  this.freeInput();

  this.setStatus('complete');

  this.event(':complete', {node: this.export()});

};

/**
 *
 * Runs the shutdown method of the blackbox
 *
 * An asynchronous node can define a shutdown function:
 *
 *   on.shutdown = function() {
 *
 *     // do shutdown stuff
 *
 *   }
 *
 * When a network shuts down, this function will be called.
 * To make sure all nodes shutdown gracefully.
 *
 * e.g. A node starting a http server can use this
 *      method to shutdown the server.
 *
 * @param {function} cb
 * @returns {undefined}
 * @public
 */
Node.prototype.shutdown = function(cb) {
  if (this.nodebox.on && this.nodebox.on.shutdown) {

    // TODO: nodes now do nothing with the callback, they should..
    // otherwise we will hang
    this.nodebox.on.shutdown(cb);

    // TODO: send the nodebox, or just the node export?
    this.event(':shutdown', this.nodebox);

  } else {
    if (cb) {
      cb();
    }
  }
};

/**
*
* Cleanup
*
* Reminder: interesting things could be done with .listeners()
*
* TODO: events also seem to be registered in this._events
*  added by the EventEmitter we extend. They seem to be
*  registered once they are emitted the first time.
*  probably the below is not even necessary.
*  So, find out what EventEmitter really does.
*
*  e.g.
*
* _events:
*  { contextUpdate: [Function],
*    inputTimeout: [Function],
*    nodeTimeout: [Function],
*    start: [Function],
*    error: [Function],
*    complete: [Function],
*    require: [Function],
*    expose: [Function],
*    output: [Function] }
*
* @public
*/
Node.prototype.destroy = function() {
  for (var i = 0; i < Node.events.length; i++) {
    this.removeAllListeners(Node.events[i]);
  }
};

/**
 *
 * Live reset, connections, etc. stay alive.
 *
 */
Node.prototype.reset = function() {

  // clear persistence
  this.persist = {};

  // clear any input
  this.freeInput();

  // reset status
  // note: also will retrigger the .start thing on nodebox.
  this.status = 'created';

  // reset any internal state.
  this.state = {};

  this.runCount = 0;

};

module.exports = Node;

},{"./node/interface":16,"./packet":18,"./sandbox/node":22,"./sandbox/port":23,"util":6}],16:[function(require,module,exports){
'use strict';

/* jshint -W040 */

var EventEmitter  = require('events').EventEmitter;
var util = require('util');
var Packet = require('../packet');
var isPlainObject = require('is-plain-object');
var InstanceOf    = require('instance-of');
var Connections = require('../ConnectionMap');

function xNode(id, node, identifier, CHI) {

  this.pid = null;

  // TODO: hope this work
  this.provider = node.provider;

  /**
   * @member {String} status
   * @public
   */
  this.status = 'unknown';

  /**
   * @member {String} id
   * @public
   */
  this.id = id;

  /**
   * @member {String} name
   * @public
   */
  this.name = node.name;

  /**
   * @member {String} ns
   * @public
   */
  this.ns = node.ns;

  /**
   * @member {String} title
   * @public
   */
  this.title = node.title;

  /**
   * @member {Object} metadata
   * @public
   */
  this.metadata = node.metadata || {};

  /**
   * @member {String} identifier
   * @public
   */
  this.identifier = identifier || node.ns + ':' + node.name;

  if (!node.hasOwnProperty('ports')) {
    return this.error('xNodeDefinition does not declare any ports');
  }

  if (!node.ports.output) {
    node.ports.output = {};
  }

  if (!node.ports.input) {
    node.ports.input = {};
  }

  if (CHI.constructor.name !== 'CHI') {
    return this.error('CHI should be instance of CHI');
  }

  this.CHI = CHI;

  // let the node `interface` instantiate all port objects.
	// each extended will already have port object setup.

	/**
   *
   * Ports which are opened by openPort.
   *
   * The Actor opens each port when it connects to it.
   *
   * Also for IIPs the port will have to be opened first.
   *
   * @private
   **/
  this.openPorts = [];

  /**
   *
   * Will keep a list of connections to each port.
   *
   */
  this._connections = new Connections();

 /** @member {Object} ports */
  this.ports = JSON.parse(JSON.stringify(node.ports));

  // how many times this node has run
  /** @member {Numeric} runCount */
  this.runCount = 0;

  // how many times this node gave port output
  /** @member {Numeric} outputCount */
  this.outputCount = 0;

  /** @member {Array} inPorts */
  Object.defineProperty(this, 'inPorts', {
    enumerable: true,
    get: function() { return Object.keys(this.ports.input); }
  });

  /** @member {Array} outPorts */
  Object.defineProperty(this, 'outPorts', {
    enumerable: true,
    get: function() { return Object.keys(this.ports.output); }
  });

  /** @member {Numeric} filled */
  Object.defineProperty(this, 'filled', {
    enumerable: true,
    configurable: false,
    get: function() {
      return Object.keys(this.input).length;
    }
  });

  // Always add complete port, :start port will be added
  // dynamicaly
  this.ports.output[':complete'] = {type: 'any'};

  var key;
  // TODO: should just be proper port objects.
  for (key in this.ports.input) {
    if (this.ports.input.hasOwnProperty(key)) {
      this.ports.input[key].fills   = 0;
      this.ports.input[key].rejects = 0;
    }
  }

  for (key in this.ports.output) {
    if (this.ports.output.hasOwnProperty(key)) {
      this.ports.output[key].fills = 0;
    }
  }

}

util.inherits(xNode, EventEmitter);

xNode.prototype.getPid = function() {
  return this.pid;
};

/**
 *
 * @param {type} pid
 * @public
 */
xNode.prototype.setPid = function(pid) {
  this.pid = pid;
};

/**
 *
 * Set Title
 *
 * Used to set the title of a node *within* a graph.
 * This property overwrites the setting of the node definition
 * and is returned during toJSON()
 *
 * @param {string} title
 * @public
 */
xNode.prototype.setTitle = function(title) {
  this.title = title;
};

/**
 *
 * Set Description
 *
 * Used to set the description of a node *within* a graph.
 * This property overwrites the setting of the node definition
 * and is returned during toJSON()
 *
 * @param {string} description
 * @public
 */
xNode.prototype.setDescription = function(description) {
  this.description = description;
};

/**
 *
 * Set metadata
 *
 * Currently:
 *
 *   x: x position hint for display
 *   y: y position hint for display
 *
 * These values are returned during toJSON()
 *
 * @param {object} metadata
 * @public
 */
xNode.prototype.setMetadata = function(metadata) {
  for (var k in metadata) {
    if (metadata.hasOwnProperty(k)) {
      this.setMeta(k, metadata[k]);
    }
  }
};

/**
 *
 * Returns the node representation to be stored along
 * with the graph.
 *
 * This is not the full definition of the node itself.
 *
 * The full definition can be found using the ns/name pair
 * along with the provider property.
 *
 */
xNode.prototype.toJSON = function() {

  var self = this;

  var json = {
    id: this.id,
    ns: this.ns,
    name: this.name
  };

  [
   'title',
   'description',
   'metadata',
   'provider'
  ].forEach(function(prop) {
    if (self[prop]) {
      if (typeof self[prop] !== 'object' ||
        Object.keys(self[prop]).length > 0) {
        json[prop] = self[prop];
      }
    }
  });

  return json;

};

/**
 *
 * @returns {Object}
 * @public
 */

xNode.prototype.report = function() {

  return {
    id: this.id,
    identifier: this.identifier,
    title: this.title,
    filled: this.filled,
    runCount: this.runCount,
    outputCount: this.outputCount,
    status: this.status,
    input: this._filteredInput(),
    context: this.context,
    ports: this.ports,
    state: this.state,
    openPorts: this.openPorts,
    connections: this._connections.toJSON()
  };

};

/**
 *
 * @param {string} key
 * @param {any} value
 */
xNode.prototype.setMeta = function(key, value) {
  this.metadata[key] = value;
};

/**
 *
 * Set node status.
 *
 * This is unused at the moment.
 *
 * Should probably contain states like:
 *
 *  - Hold
 *  - Complete
 *  - Ready
 *  - Error
 *  - Timeout
 *  - etc.
 *
 * Maybe something like Idle could also be implemented.
 * This would probably only make sense if there are persistent ports
 * which hold a reference to an instance upon which we can call methods.
 *
 * Such an `idle` state would indicate the node is ready to accept new
 * input.
 *
 * @param {String} status
 * @private
 */
xNode.prototype.setStatus = function(status) {

  this.status = status;

  /**
   * Status Update Event.
   *
   * Fired multiple times on output
   *
   * Once for every output port.
   *
   * @event xNode#statusUpdate
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} status - The status
   */
  this.event(':statusUpdate', {
    node: this.export(),
    status: this.status
  });

};

/**
 *
 * Get the current node status.
 *
 * This is unused at the moment.
 *
 * @public
 */
xNode.prototype.getStatus = function() {

  return this.status;

};

xNode.prototype.getParent = function() {
  return this.parent;
};

xNode.prototype.setParent = function(node) {
  this.parent = node;
};

xNode.prototype.hasParent = function() {
  return !!this.parent;
};

xNode.events = [
  ':branching',
  ':closePort',
  ':contextUpdate',
  ':contextClear',
  ':complete',
  ':error',
  ':executed',
  ':expose',
  ':fillCore',
  ':freePort',
  ':index',
  ':inputTimeout',
  ':inputValidated',
  ':nodeTimeout',
  ':openPort',
  ':output',
  ':plug',
  ':unplug',
  ':portFill',
  ':portReject',
  ':require',
  ':statusUpdate',
  ':start',
  ':shutdown'
];

/**
 *
 * @param {string} port
 * @param {Mixed} data
 * @private
 */
xNode.prototype._handleFunctionType = function(port, data) {
  var portObj = this.getPort('input', port);
  // convert function if it's not already a function
  if (portObj.type === 'function' &&
    typeof data === 'string') {
    // args, can be used as a hint for named parms
    // if there are no arg names defined, use arguments
    var args = portObj.args ? portObj.args : [];
    data = new Function(args, data);
  }

  return data;
};

/**
*
* Fills the port.
*
* Does the same as fillPort, however it also checks:
*
*   - port availability
*   - port settings
*
* FIXME: fill & fillPort can just be merged probably.
*
* @param {Object} target
* @public
*/
xNode.prototype.handleLinkSettings = function(target) {

  // FIX: hold is not handled anywhere as setting anymore
  if (target.has('hold')) {
    this.hold();
  } else if (target.has('persist')) {
    // FIX ME: has become a weird construction now
    //
    // THIS IS NOW BROKEN, on purpose.. :-)
    var index = target.get('index');

    // specialized case, make this more clear.
    // persist can be a boolean, or it becomes an array of
    // indexes to persist.
    if (index) {
      if (!Array.isArray(this.ports.input[target.port].persist)) {
        this.ports.input[target.port].persist = [];
      }
      this.ports.input[target.port].persist.push(index);
    } else {
      this.ports.input[target.port].persist = true;
    }
  }
};

xNode.prototype._receive = function(p, target) {

  if (this.status === 'error') {
    return new Error('Port fill refused process is in error state');
  }

  if (!this.portExists('input', target.port)) {

    return new Error(util.format(
      'Process %s has no input port named `%s`\n\n' +
      '\tInput ports available:\n\n\t%s',
      this.identifier,
      target.port,
      Object.keys(this.ports.input).join(', ')
    ));

  }

  if (!this.portIsOpen(target.port)) {
    return Error(util.format(
          'Trying to send to a closed port open it first: %s',
          target.port
          )
        );
  }

  this.handleLinkSettings(target);

  var type = this.ports.input[target.port].type;

  if (type === 'array' && target.has('index')) {
    return this._handleArrayPort(target, p);
  }

  if (type === 'object' && target.has('index')) {
    return this._handleObjectPort(target, p);
  }

  // queue manager could just act on the false return
  // instead of checking inputPortAvailable by itself
  var ret = this.inputPortAvailable(target);
  if (!ret) {

    /**
     * Port Reject Event.
     *
     * Fired when input on a port is rejected.
     *
     * @event xNode#portReject
     * @type {object}
     * @property {object} node - An export of this node
     * @property {string} port - Name of the port this rejection occured
     */
    this.event(':portReject', {
      node: this.export(),
      port: target.port,
      data: p
    });

    return false;

  } else {

    ret = this._fillPort(target, p);
    return ret;

  }

};

/**
*
* Handles an Array port
*
* [0,1,2]
*
* When sending IIPs the following can also happen:
* [undefined, undefined, 2]
* IIPs in this way must be send as a group.
* That group will be added in reverse order.
* This way 2 will create an array of length 3
* This is important because we will check the length
* whether we are ready to go.
*
* If 0 was added first, the length will be 1 and
* it seems like we are ready to go, then 1 comes
* and finds the process is already running..
*
* [undefined, undefined, 2]
*
* Connections:
* [undefined, undefined, 2]
*
* @param {Connector} target
* @param {Packet} p
* @private
*/
xNode.prototype._handleArrayPort = function(target, p) {

  // start building the array.
  if (target.has('index')) {

    // Marked the port as being indexed
    this.ports.input[target.port].indexed = true;

    // we have an index.
    // ok, one problem, with async, this.input
    // is never really filled...
    // look at that, will cause dangling data.
    if (!this.input[target.port]) {
      this.input[target.port] = [];
    }

    if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
      // input not available, it will be queued.
      // (queue manager also stores [])
      return false;
    } else {

      this.event(':index', {
        node: this.export(),
        port: target.port,
        index: target.get('index')
      });

      this.input[target.port][target.get('index')] = p.data;
    }

    // it should at least be our length
    if (this._arrayPortIsFilled(target.port)) {

      // packet writing, CHECK THIS.
      p.data = this.input[target.port]; // the array we've created.

      // Unmark the port as being indexed
      delete this.ports.input[target.port].indexed;

      return this._fillPort(target, p);

    } else {

      // input length less than known connections length.
      return false;
    }

  } else {

    this.error(util.format(
      '%s: `%s` value arriving at Array port `%s`, but no index[] is set',
      this.identifier,
      typeof p.data,
      target.port
    ));

    return false;

  }
};

/**
*
* Handles an Object port
*
* @param {String} port
* @param {Object} data
* @param {Object} chi
* @param {Object} source
* @private
*/
// todo, the name of the variable should be target not source.
// source is only handled during output.
xNode.prototype._handleObjectPort = function(target, p) {

  // start building the array.
  if (target.has('index')) {

    // we have a key.

    // Marked the port as being indexed
    this.ports.input[target.port].indexed = true;

    // Initialize empty object
    if (!this.input[target.port]) {
      this.input[target.port] = {};
    }

    // input not available, it will be queued.
    // (queue manager also stores [])
    if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
      return false;
    } else {

      this.event(':index', {
        node: this.export(),
        port: target.port,
        index: target.get('index')
      });

      // define the key
      this.input[target.port][target.get('index')] = p.data;
    }

    // it should at least be our length
    //
    // Bug:
    //
    // This check is not executed when another port triggers
    // execution. the input object is filled, so it will
    // start anyway.
    //
    if (this._objectPortIsFilled(target.port)) {

      // PACKET WRITING CHECK THIS.
      p.data = this.input[target.port];

      // Unmark the port as being indexed
      delete this.ports.input[target.port].indexed;

      return this._fillPort(target, p);

    } else {
      // input length less than known connections length.
      return false;
    }

  } else {

    this.error(util.format(
      '%s: `%s` value arriving at Object port `%s`, but no index[] is set',
      this.identifier,
      typeof p.data,
      target.port
    ));

    return false;

  }
};

// Ok to do this correctly I should at least have
// real port objects, so I can just ask each port
// whether it is filled or not.
// But that's kinda a big change.
// this.input will not be used anymore.
// since each port will keep it's own data.
/**
 *
 * @param {string} port
 * @private
 */
xNode.prototype._arrayPortIsFilled = function(port) {

  // Not even initialized
  if (typeof this.input[port] === undefined) {
    return false;
  }

  if (this.input[port].length < this._connections[port].length) {
    return false;
  }

  // Make sure we do not have undefined (unfulfilled ports)
  // (Should not really happen)
  for (var i = 0; i < this.input[port].length; i++) {
    if (this.input[port][i] === undefined) {
      return false;
    }
  }

  // Extra check for weird condition
  if (this.input[port].length > this._connections[port].length) {

    this.error(util.format(
      '%s: Array length out-of-bounds for port',
      this.identifier,
      port
    ));

    return false;

  }

  return true;

};

/**
 *
 * @param {string} port
 * @private
 */
xNode.prototype._objectPortIsFilled = function(port) {

  // Not even initialized
  if (typeof this.input[port] === undefined) {
    return false;
  }

  // Not all connections have provided input yet
  if (Object.keys(this.input[port]).length < this._connections[port].length) {
    return false;
  }

   // Make sure we do not have undefined (unfulfilled ports)
   // (Should not really happen)
  for (var key in this.input[port]) {
    if (this.input[port][key] === undefined) {
      return false;
    }
  }

  // Extra check for weird condition
  if (Object.keys(this.input[port]).length > this._connections[port].length) {

    this.error(util.format(
      '%s: Object keys length out-of-bounds for port `%s`',
      this.identifier,
      port
    ));

    return false;

  }

  return true;

};

/**
 *
 * @param {string} port
 * @param {Mixed} data
 * @private
 */
xNode.prototype._validateInput = function(port, data) {

  if (!this.ports.input.hasOwnProperty(port)) {

    var msg = Error(util.format('no such port: **%s**', port));

    this.event(':error', {
      node: this.export(),
      msg: msg
    });

    //return Error(this, msg);
    return Error(msg);
  }

  if (!this.validateData(this.ports.input[port].type, data)) {

    // TODO: emit these errors, with error constants
    var expected = this.ports.input[port].type;
    var real = Object.prototype.toString.call(data).match(/\s(\w+)/)[1];

    if (data && typeof data === 'object' &&
      data.constructor.name === 'Object') {
      var tmp = Object.getPrototypeOf(data).constructor.name;

      if (tmp) {
        // not sure, sometimes there is no name?
        // in witch case all you can do is type your name as being an 'object'
        real = tmp;
      }
    }
/*
    return Error(this, util.format(
      'Expected `%s` got `%s` on port `%s`',
      expected, real, port));
*/
    return Error(util.format(
      'Expected `%s` got `%s` on port `%s`',
      expected, real, port));
  }

  /**
   * Input Validated Event.
   *
   * Occurs when a port was succesfully validated
   *
   * @event xNode#inputValidated
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} port - Name of the port
   */
  this.event(':inputValidated', {
    node: this.export(),
    port: port
  });

  return true;
};

xNode.prototype.sendPortOutput = function(port, output, chi) {

  if (!chi) {
    chi = {};
  }

  this.CHI.merge(chi, this.chi, false);

  if (output === undefined) {
    throw Error(
      util.format(
        '%s: Undefined output is not allowed `%s`', this.identifier, port
      )
    );
  }

  if (port === 'error' && output === null) {

    // allow nodes to send null error, but don't trigger it as output.

  } else {

    if (this.ports.output.hasOwnProperty(port) ||
      xNode.events.indexOf(port) !== -1 // system events
      ) {

      if (this.ports.output.hasOwnProperty(port)) {
        this.ports.output[port].fills++;
        this.outputCount++;
      }

      // so basically all output is a new packet.
      // with chi sustained or enriched.
      var p = new Packet(output);
      p.set('chi', chi);

      this.emit('output', {
        node: this.export(),
        port: port,
        out: p
      });

    } else {
      throw Error(this.identifier + ': no such output port ' + port);
    }

  }

};

/**
*
* Validate a single value
*
* TODO: Object (and function) validation could be expanded
* to match an expected object structure, this information
* is already available.
*
* @param {String} type
* @param {Object} data
* @private
*/
xNode.prototype.validateData = function(type, data) {

  switch (type) {

  case 'string':
    return typeof data === 'string';

  case 'array':
    return Object.prototype.toString.call(data) === '[object Array]';

  case 'integer':
  case 'number':
    return Object.prototype.toString.call(data) === '[object Number]';

  case 'null':
    type = type.charAt(0).toUpperCase() + type.slice(1);
    return Object.prototype.toString.call(data) === '[object ' + type + ']';

  case 'boolean':
  case 'bool':
    return data === true || data === false || data === 0 || data === 1;

  case 'any':
    return true;
  case 'object':
    if (isPlainObject(data)) {
      return true;
    }
    // TODO: not sure if I meant to return all objects as valid objects.
    return InstanceOf(data, type);
  case 'function':
    return true;

  default:
    return InstanceOf(data, type);
  }

};

/**
 *
 * Does both send events through output ports
 * and emits them.
 *
 * Not sure whether sending the chi is really necessary..
 *
 * @param {string} eventName
 * @param {Packet} p
 * @protected
 */
xNode.prototype.event = function(eventName, p) {

  // event ports are prefixed with `:`
  this.sendPortOutput(eventName, p);

};

/**
 *
 * Could be used to externally set a node into error state
 *
 * xNode.error(node, Error('you are bad');
 *
 * @param {Error} err
 * @returns {Error}
 */
xNode.prototype.error = function(err) {

  var error = util.isError(err) ? err : Error(err);

  // Update our own status
  this.setStatus('error');

  // TODO: better to have full (custom) error objects
  var eobj  = {
    //node: node.export(),
    node: this, // do not export so soon.
    msg: err
  };

  // Used for in graph sending
  this.event(':error', eobj);

  // Used by Process Manager or whoever handles the node
  this.emit('error', eobj);

  return error;
};

/**
 *
 * Add context.
 *
 * Must be set in one go.
 *
 * @param {Object} context
 * @public
 */
xNode.prototype.addContext = function(context) {
  var port;
  for (port in context) {
    if (context.hasOwnProperty(port)) {
      this.setContextProperty(port, context[port]);
    }
  }
};

/**
 *
 * Do a lightweight export of this node.
 *
 * Used in emit's to give node information
 *
 *
 * @return {Object}
 * @public
 */
xNode.prototype.export = function() {

  return {

    id: this.id,
    ns: this.ns,
    name: this.name,
    title: this.title,
    pid: this.pid,
    identifier: this.identifier,
    ports: this.ports,
    cycles: this.cycles,
    inPorts: this.inPorts,
    outPorts: this.outPorts,
    filled: this.filled,
    context: this.context,
    require: this.require,
    status: this.status,
    runCount: this.runCount,
    expose: this.expose,
    active: this.active,
    metadata: this.metadata,
    provider: this.provider,
    input: this._filteredInput(),
    openPorts: this.openPorts,
    nodeTimeout: this.nodeTimeout,
    inputTimeout: this.inputTimeout
  };

};

/**
 *
 * Set context to a port.
 *
 * Can be changed during runtime, but will never trigger
 * a start.
 *
 * Adding the whole context in one go could trigger a start.
 *
 * Packet wise thise content is anonymous.
 *
 * @param {String} port
 * @param {Mixed} data
 * @fires xNode#contextUpdate
 * @private
 */
xNode.prototype.setContextProperty = function(port, data) {

  if (port === ':start') {
    this.initStartPort();
  }

  var res = this._validateInput(port, data);

  if (util.isError(res)) {

    this.event(':error', {
      node: this.export(),
      msg: Error('setContextProperty: ' + res.message)
    });

  } else {

    data = this._handleFunctionType(port, data);

    this.$setContextProperty(port, data);

    this.event(':contextUpdate', {
      node: this,
      port: port,
      data: data
    });

  }
};

/**
*
* Filters the input for export.
*
* Leaving out everything defined as a function
*
* Note: depends on the stage of emit whether this value contains anything
*
* @return {Object} Filtered Input
* @private
*/
xNode.prototype._filteredInput = function() {
  var port;
  var type;
  var input = {};

  for (port in this.input) {
    if (this.portExists('input', port)) {
      type = this.ports.input[port].type;

      if (type === 'string' ||
          type === 'number' ||
          type === 'enum' ||
          type === 'boolean') {
        input[port] = this.input[port];
      } else {
        // can't think of anything better right now
        input[port] = Object.prototype.toString.call(this.input[port]);
      }

    } else {

      // faulty but used during export so we want to know
      input[port] = this.input[port];

    }
  }

  return input;
};

// TODO: these port function only make sense for a graph
//       or a dynamic node.

xNode.prototype.addPort = function(type, port, def) {
  if (!this.portExists(type, port)) {
    this.ports[type][port] = def;
    return true;
  } else {
    return Error('Port already exists');
  }
};

xNode.prototype.removePort = function(type, port) {
  if (this.portExists(type, port)) {
    delete this.ports[type][port];
    if (type === 'input') {
      this.clearInput(port);
      this.clearContextProperty(port);
      return true;
    }
  } else {
    //return Error(this, 'No such port');
    return Error('No such port');
  }
};

xNode.prototype.renamePort = function(type, from, to) {
  if (this.portExists(type, from)) {
    this.ports[type][to] = this.ports[type][from];
    delete this.ports[type][from];
    return true;
  } else {
    //return Error(this, 'No such port');
    return Error('No such port');
  }
};

xNode.prototype.getPort = function(type, name) {
  if (this.ports.hasOwnProperty(type) &&
     this.ports[type].hasOwnProperty(name)) {
    return this.ports[type][name];
  } else {
    throw new Error('Port `' + name + '` does not exist');
  }
};

xNode.prototype.getPortOption = function(type, name, opt) {
  var port = this.getPort(type, name);
  if (port.hasOwnProperty(opt)) {
    return port[opt];
  } else {
    return undefined;
  }
};

xNode.prototype.portExists = function(type, port) {
  return this.ports[type] && this.ports[type].hasOwnProperty(port);
};

/**
*
* Set port to open state
*
* @param {String} port
* @public
*/
xNode.prototype.openPort = function(port) {

  if (this.portExists('input', port)) {

    if (this.openPorts.indexOf(port) === -1) {

      this.openPorts.push(port);

      this.event(':openPort', {
        node: this.export(),
        port: port,
        connections: this._connections.hasOwnProperty(port) ?
          this._connections[port].length : // enough info for now
          0 // set by context
      });

    }

    // opening twice is allowed.
    return true;

  } else {

    // TODO: make these error codes, used many times, etc.
    return Error(util.format('no such port: **%s**', port));

  }

};

/**
 *
 * @param {string} port
 * @returns {Boolean}
 */
xNode.prototype.closePort = function(port) {

  if (this.portExists('input', port)) {

    this.openPorts.splice(this.openPorts.indexOf(port), 1);

    this.event(':closePort', {
      node: this.export(),
      port: port
    });

    return true;

  } else {

    // TODO: make these error codes, used many times, etc.
    //return Error(this, util.format('no such port: **%s**', port));
    return Error(util.format('no such port: **%s**', port));

  }

};

/**
 * Whether a port is currently opened
 *
 * @param {String} port
 * @return {Boolean}
 * @private
 */
xNode.prototype.portIsOpen = function(port) {
  return this.openPorts.indexOf(port) >= 0;
};

/**
 *
 * Checks whether the input port is available
 *
 * @param {String} port
 * @param {String} source In case of ArrayPort
 * @public
 */

/*
 * Not used yet but for clarity
 *
 * Could be used to determine the reason of rejection.
 * (if proper bitmasks are used);
 *
 * */
var Port = {};
Port.AVAILABLE           = true;
Port.UNAVAILABLE         = false;
Port.INDEX_AVAILABLE     = true;
Port.INDEX_NOT_AVAILABLE = false;
Port.ARRAY_PORT_FULL     = false;
xNode.prototype.inputPortAvailable = function(target) {

  if (target.has('index')) {

    if (this.ports.input[target.port].type !== 'array' &&
       this.ports.input[target.port].type !== 'object') {

      return Error([
        this.identifier,
        'Unexpected Index[] information on non array port:',
        target.port
      ].join(' ')
      );
    }

    // not defined yet
    if (!this.input.hasOwnProperty(target.port)) {
      return Port.AVAILABLE;
    }

    // only available if [] is not already filled.
    if (this.input[target.port][target.get('index')] !== undefined) {
      return Port.INDEX_NOT_AVAILABLE;
    }

    // If it's full, it's running.
    // this case targets indexed connections and .could be buggy
    // if an array port is not treated as an indexed port
    // multiple connections to an indexed array port have different meaning.
    // multiple connections to a non-indexed port,
    // means who ever comes first gives input.
    // ah but this *is* about indexed connections.
    if (this.input.length === this._connections[target.port].length) {
      return Port.ARRAY_PORT_FULL;
    }

    return Port.INDEX_AVAILABLE;

  }

  var ret = !this.$portIsFilled(target.port) ?
    Port.AVAILABLE : Port.UNAVAILABLE;
  return ret;

};

/**
 *
 * @param {Link} link
 * @returns {Boolean}
 * @public
 */
xNode.prototype.plug = function(link) {

  if (link.target.port === ':start') {
    this._initStartPort();
  }

  if (link.source.wire !== link ||
     link.target.wire !== link) {
    throw Error('Broken wire');
  }

  if (this.portExists('input', link.target.port)) {

    if (!this._connections[link.target.port]) {
      this._connections[link.target.port] = [];
    }

    this._connections[link.target.port].push(link);

    this.event(':plug', {
      node: this.export(),
      port: link.target.port,
      connections: this._connections[link.target.port].length
    });

    this.openPort(link.target.port);

    return true;

  } else {

    // problem of whoever tries to attach
    return Error(util.format(
      'Process `%s` has no input port named `%s`\n\n\t' +
      'Input ports available: %s\n\n\t',
      this.identifier,
      link.target.port,
      Object.keys(this.ports.input).join(', ')
    ));

  }

};

/**
*
* Determine whether this node has any connections
*
* FIX this.
*
* @return {Boolean}
* @public
*/
xNode.prototype.hasConnections = function() {
  //return this.openPorts.length;
  var port;
  for (port in this._connections) {
    if (this._connections[port] &&
      this._connections[port].length) {
      return true;
    }
  }

  return false;
};

/**
*
* Unplugs a connection from a port
*
* Will decrease the amount of connections to a port.
*
* TODO: make sure we remove the exact target
*       right now it just uses pop()
*
* @param {Link} link
* @public
*/
xNode.prototype.unplug = function(link) {

  if (this.portExists('input', link.target.port)) {

    if (!this._connections[link.target.port] ||
       !this._connections[link.target.port].length) {
      return this.error('No such connection');
    }

    var pos = this._connections[link.target.port].indexOf(link);
    if (pos === -1) {
      // problem of whoever tries to unplug it
      //return Error(this, 'Link is not connected to this port');
      return Error('Link is not connected to this port');
    }

    this._connections[link.target.port].splice(pos, 1);

    this.event(':unplug', {
      node: this.export(),
      port: link.target.port,
      connections: this._connections[link.target.port].length
    });

    // ok port should only be closed if there are no connections to it
    if (!this.portHasConnections(link.target.port)) {
      this.closePort(link.target.port);
    }

    // if this is the :start port also remove it from inports
    // this port is re-added next time during open port
    // TODO: figure out what happens with multiple connections to a :start port
    // because that's also possible, when true connections are made to it,
    // not iip onces,
    if (link.target.port === ':start' &&
        link.source.port === ':iip' &&
         this._connections[link.target.port].length === 0) {
      this.removePort('input', ':start');
    }

    return true;

  } else {

    // :start is dynamic, maybe the throw below is no necessary at all
    // no harm in unplugging something non-existent
    if (link.target.port !== ':start') {

      // problem of whoever tries to unplug
      return Error(util.format(
        'Process `%s` has no input port named `%s`\n\n\t' +
        'Input ports available: \n\n\t%s',
        this.identifier,
        link.target.port,
        Object.keys(this.ports.input).join(', ')
      ));

    }

  }

};

xNode.prototype.start = function() {
  throw Error('xNode needs to implement start()');
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 * @param {string} type
 * @param {string} name
 * @param {string} opt
 * @param {any} value
 * @returns {undefined}
 */
xNode.prototype.setPortOption = function(type, name, opt, value) {
  var port = this.getPort(type, name);
  port[opt] = value;
};

xNode.prototype.setPortOptions = function(type, options) {
  var opt;
  var port;
  for (port in options) {
    if (options.hasOwnProperty(port)) {
      for (opt in options[port]) {
        if (options[port].hasOwnProperty(opt)) {
          if (options.hasOwnProperty(opt)) {
            this.setPortOption(type, port, opt, options[opt]);
          }
        }
      }
    }
  }
};

// Connection Stuff, should be in the Port object
xNode.prototype.portHasConnection = function(port, link) {
  return this._connections[port] && this._connections[port].indexOf(link) >= 0;
};
xNode.prototype.portHasConnections = function(port) {
  return !!(this._connections[port] && this._connections[port].length > 0);
};

xNode.prototype.portGetConnections = function(port) {
  return this._connections[port] || [];
};

module.exports = xNode;

},{"../ConnectionMap":7,"../packet":18,"events":1,"instance-of":33,"is-plain-object":35,"util":6}],17:[function(require,module,exports){
'use strict';

/* global document */

var util = require('util');
var Packet = require('../packet');
var xNode = require('./interface');

/**
 *
 * This whole context, default thing is handled differently here.
 * They only make sense on startup as defaults.
 *
 * Since all they are is attributes.
 *
 * For non attribute input ports context & default make no sense.
 * so are ignored.
 *
 * @param {type} id
 * @param {type} node
 * @param {type} identifier
 * @param {type} CHI
 * @returns {PolymerNode}
 */

function PolymerNode(id, node, identifier, CHI) {

  // not sure where to call this yet.
  PolymerNode.super_.apply(this, arguments);

  var self = this;

  this.id = id;

  this.ns = node.ns;
  this.name  = node.name;

  this.type = 'polymer';

  this.identifier = identifier;

  this.chi = {};

  this.CHI = CHI;

  /* wanna use this with a Polymer node? */
  this.input = {};

  var da = this.id.split('');
  da.forEach(function(v, i, arr) {
     if(/[A-Z]/.test(v)) {
       arr.splice(i, 1, (i > 0 ? '-' : '') + v.toLowerCase());
     }
  });

  this.elementId = da.join('');

  // TODO: will I use this.ports?
	// for required, default, type etc I still need it.

  /**
   *
   * Problem here is I use uuid's
   * This can be solved by not generating them.
   *
   **/
  this.wc  = document.getElementById(this.elementId);
  if (!this.wc) {
    // automatically create the element
    console.log('creating', this.name);
    this.wc  = document.createElement(this.name);
    this.wc.setAttribute('id', this.elementId);
    document.querySelector('body').appendChild(this.wc);
  }

  if (!this.wc) {
    throw Error('Polymer Web Component could not be found');
  }

  // TODO: do some basic check whether this really is a polymer element

  // there should be dynamic stuff for e.g. on-tap
  // Ok it's also clear .fbp graphs become just as nested
  // as the components itself, other wise it will not work.
  // one graph means one component.
  // Also if there are then template variable they need to be described.
  // blargh. :-)
  // Ok but these node definitions are so they are selectable within
  // the .fbp that's kinda solved.
  // I should not try to do to much logic for the UI itself.
  // that's not necessary and undoable.
  // So the best example is chix-configurator and the reason I've
  // created it in the first place.
/*
Problem a component is composite, defines properties.

Graph is composite defines external ports.

Fbpx Graph !== Composite Webcomponent.

However I treat the composite component as a node Definition.
So then I have the problem of the same component.
representing a nodeDefinion but also a graph.

Which would almost indicate a webcomponent is always also
a graph, which could be possible, because a graph is also
a nodeDefinition in chix.

err, it is possible, but a bit complex.

which means a polymerNode is closer to xFlow then to xNode.

*/
  function sendPortOutput(port) {
    return function(ev) {
      self.emit('output', {
        node: self.export(),
        port: port,
        out: new Packet(ev)
      });
    };
  }

  if (Object.keys(node.ports.output).length) {
    for (var port in node.ports.output) {
      if (node.ports.output.hasOwnProperty(port)) {
        this.wc.addEventListener(port, sendPortOutput(port));
      }
    }
  }

  this.status = 'ready';

}

util.inherits(PolymerNode, xNode);

PolymerNode.prototype.start = function() {
  /* nothing to do really */
  return true;
};

/**
 *
 * Must do the same kind of logic as xNode
 * Therefor having Ports at this point would be handy
 * Let's at least start by putting those methods in the `interface`.
 */
PolymerNode.prototype.fill = function(target, p) {

  /* input can be an attribute, or one of our methods */
  if (typeof this.wc[target.port] === 'function') {
    this.wc[target.port](p.data);
  } else {
    // must be an attribute
    this.wc.setAttribute(target.port, p.data);
  }

};

PolymerNode.prototype.$portIsFilled = function(/*port*/) {
  //return this.input.hasOwnProperty(port);
  return false;
};

/**
*
* Holds all input until release is called
*
* @public
*/
PolymerNode.prototype.hold = function() {
  this.setStatus('hold');
};

/**
*
* Releases the node if it was on hold
*
* @public
*/
PolymerNode.prototype.release = function() {

  this.setStatus('ready');

  if (this.__halted) {
    this.__halted = false;
		// not much to do
  }
};

module.exports = PolymerNode;

},{"../packet":18,"./interface":16,"util":6}],18:[function(require,module,exports){
'use strict';

/**
 *
 * A packet wraps the data.
 *
 * Enabling tracking and adding metadata
 *
 * Filters are not really creating new packets.
 * But modify the data.
 *
 * Maybe use getters and setters?
 *
 * var p = new Packet(data);
 *
 * drop(p);
 *
 * Curious, Packet containing it's own map of source & target.
 * Could be possible, only what will happen on split.
 * End target could be itself. :-)
 *
 */
function Packet(data) {

  this.data       = data;
  this.chi        = {};
  this.owner      = undefined;

  // probably too much info for a basic packet.
  // this.created_at =
  // this.updated_at =

}

Packet.prototype.read = function() {
  return this.data;
};

Packet.prototype.write = function(data) {
  this.data = data;
};

// clone can only take place on plain object data.

/**
 * Clone the current packet
 *
 * In case of non plain objects it's mostly desired
 * not to clone the data itself, however do create a *new*
 * packet with the other cloned information.
 *
 * To enable this set cloneData to true.
 *
 * @param {Boolean} cloneData Whether or not to clone the data.
 */
Packet.prototype.clone = function(cloneData) {
  var p = new Packet(
    cloneData === undefined?
    JSON.parse(JSON.stringify(this.data)) :
    this.data
  );
  p.set('chi', JSON.parse(JSON.stringify(this.chi)));
  return p;
};

Packet.prototype.set = function(prop, val) {
  this[prop] = val;
};

Packet.prototype.get = function(prop) {
  return this[prop];
};

Packet.prototype.del = function(prop) {
  delete this[prop];
};

Packet.prototype.has = function(prop) {
  return this.hasOwnProperty(prop);
};

module.exports = Packet;

},{}],19:[function(require,module,exports){
(function (process){
'use strict';

var util         = require('util');
var uuid         = require('uuid').v4;
var EventEmitter = require('events').EventEmitter;

var onExit = [];
if (process.on) { // old browserify
  process.on('exit', function() {
    onExit.forEach(function(instance) {

      var key;
      var process;
      var report;
      var reports = {};

      for (key in instance.processes) {
        if (instance.processes.hasOwnProperty(key)) {
          process = instance.processes[key];
          if (process.type === 'flow') {
            report = process.report();
            if (!report.ok) {
              reports[key] = report;
            }
          }
        }
      }

      if (Object.keys(reports).length) {
        instance.emit('report', reports);
      }

    });
  });
}

/**
 *
 * Default Process Manager
 *
 * @constructor
 * @public
 *
 */
function ProcessManager() {

  this.processes = {};

  onExit.push(this);

}

util.inherits(ProcessManager, EventEmitter);

ProcessManager.prototype.getMainGraph = function() {
  return this.getMainGraphs().pop();
};

ProcessManager.prototype.getMainGraphs = function() {

  var main = [];
  var key;
  var p;

  for (key in this.processes) {
    if (this.processes.hasOwnProperty(key)) {
      p = this.processes[key];
      if (p.type === 'flow' && !p.hasParent()) {
        main.push(p);
      }
    }
  }

  return main;

};

ProcessManager.prototype.register = function(node) {

  var self = this;

  if (node.pid) {
    throw new Error('Refusing to add node with existing process id');
  }

  var pid = uuid();
  node.setPid(pid);
  this.processes[pid] = node;

  var onProcessStart = function onProcessStart(event) {
    // data.node
    self.emit('startProcess', event.node);
  };

  var onProcessStop = function onProcessStop(event) {
    // data.node
    self.emit('stopProcess', event.node);
  };

  // Note: at the moment only subgraphs emit the start event.
  // and only subgraphs can be stopped, this is good I think.
  // The process manager itself holds *all* nodes.
  // Start is a push on the actor.
  // However, when we start a network we only care about
  // the push on the main actor, not the subgraphs.
  // So this is something to think about when you listen
  // for startProcess.
  // Maybe for single stop and start of nodes the actor should be used
  // and the actor emits the stop & start events, with the node info
  // To stop a node: this.get(graphId).hold(nodeId);
  // Ok you just do not stop single nodes, you hold them.
  // Stop a node and your network is borked.
  this.processes[pid].on('start', onProcessStart);
  this.processes[pid].on('stop', onProcessStop);

  // Process manager handles all errors.
  // or in fact, ok we have to add a errorHandler ourselfes also
  // but the process manager will be able to do maintainance?
  node.on('error', this.processErrorHandler.bind(this));

  // pid is in node.pid
  this.emit('addProcess', node);

};

/**
 *
 * Process Error Handler.
 *
 * The only errors we receive come from the nodes themselves.
 * It's also garanteed if we receive an error the process itself
 * Is already within an error state.
 *
 */
ProcessManager.prototype.processErrorHandler = function(event) {

  if (event.node.status !== 'error') {
    console.log('STATUS', event.node.status);
    throw Error('Process is not within error state', event.node.status);
  }

  // Emit it, humans must solve this.
  this.emit('error', event);

};

ProcessManager.prototype.changePid = function(from, to) {

  if (this.processes.hasOwnProperty(from)) {
    this.processes[to] = this.processes[from];
    delete this.processes[from];
  } else {
    throw Error('Process id not found');
  }

  this.emit('changePid', {from: from, to: to});

};

// TODO: improve start, stop, hold, release logic..
ProcessManager.prototype.start = function(node) {

  // allow by pid and by node object
  var pid = typeof node === 'object' ? node.pid : node;

  if (this.processes.hasOwnProperty(pid)) {
    if (this.processes[pid].type === 'flow') {
      this.processes[pid].start();
    } else {
      this.processes[pid].release();
    }
  } else {
    throw Error('Process id not found');
  }
};

ProcessManager.prototype.stop = function(node, cb) {

  // allow by pid and by node object
  var pid = typeof node === 'object' ? node.pid : node;

  if (this.processes.hasOwnProperty(pid)) {
    if (this.processes[pid].type === 'flow') {
      this.processes[pid].stop(cb);
    } else {
      this.processes[pid].hold(cb);
    }
  } else {
    throw Error('Process id not found');
  }
};

// TODO: just deleting is not enough.
// links also contains the pids
// on remove process those links should also be removed.
ProcessManager.prototype.unregister = function(node, cb) {

  var self = this;

  if (!node.pid) {
    throw new Error('Process id not found');
  }

  function onUnregister(snode, cb) {

    self.emit('removeProcess', node);

    delete self.processes[node.pid];

    // remove pid
    delete node.pid;

    // todo maybe normal nodes should also use stop + cb?
    if (cb) {
      cb();
    }

  }

  if (this.processes[node.pid].type === 'flow') {

    // wait for `subnet` to be finished
    self.stop(node, onUnregister.bind(this, node, cb));

  } else {

    node.shutdown(onUnregister.bind(this, node, cb));

  }

  node.removeListener('error', this.processErrorHandler);

};

/**
*
* Get Process
* Either by id or it's pid.
*
*/
ProcessManager.prototype.get = function(pid) {

  return this.processes[pid];

};

/**
 *
 * Using the same subgraph id for processes can work for a while.
 *
 * This method makes it possible to find graphs by id.
 *
 * Will throw an error if there is a process id conflict.
 *
 */
ProcessManager.prototype.getById = function(id) {
  var found;
  var process;
  for (process in this.processes) {
    if (this.processes.hasOwnProperty(process)) {
      if (this.processes[process].id === id) {
        if (found) {
          console.log(this.processes);
          throw Error('conflict: multiple pids with the same id');
        }
        found = this.processes[process];
      }
    }
  }
  return found;
};

ProcessManager.prototype.filterByStatus = function(status) {
  return this.filterBy('status', status);
};

ProcessManager.prototype.filterBy = function(prop, value) {

  var id;
  var filtered = [];

  for (id in this.processes) {
    if (this.processes.hasOwnProperty(id)) {
      if (this.processes[id][prop] === value) {
        filtered.push(this.processes[id]);
      }
    }
  }

  return filtered;

};

module.exports = ProcessManager;

}).call(this,require("uojqOp"))
},{"events":1,"uojqOp":4,"util":6,"uuid":42}],20:[function(require,module,exports){
(function (process){
'use strict';

var util = require('util');

function Queue() {
  this.lock = false;
  this.queue = [];
  this.pounders = 0;
}

/**
 *
 * Default Queue Manager
 *
 * @constructor
 * @public
 *
 */
function QueueManager(dataHandler) {

  this.queues = {};
  this._shutdown    = false;

  this.locks = {}; /* node locks */

  Object.defineProperty(this, 'inQueue', {
    enumerable: true,
    get: function() {
      // snapshot of queueLength
      var id;
      var inQ = 0;
      for (id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          inQ += this.queues[id].queue.length;
        }
      }
      return inQ;
    }
  });

  this.onData(dataHandler);
}

QueueManager.prototype.onData = function(handler) {
  this.sendData = handler;
};

QueueManager.prototype.pounder = function() {

  var self = this.self;
  if (!self.queues.hasOwnProperty(this.id)) {
    throw Error('Unclean shutdown: Pounding on non-exist substance');
  }

  var queue = self.queues[this.id];
  queue.pounders--;

  var inQueue = queue.queue.length;
  if (inQueue === 0) {
    // console.log('nothing in queue this should not happen! ID:', this.id, this.self);
    throw Error('nothing in queue this should not happen!');
  }

  var p = self.pick(this.id);

  if (self._shutdown) {

    self.drop('queued', this.id, p);

  } else if (self.isLocked(this.id)) {
    self.unshift(this.id, p);

  } else {
    self.sendData(this.id, p);
  }

};

QueueManager.prototype.getQueue = function(id) {

  if (this.queues.hasOwnProperty(id)) {
    return this.queues[id];
  }

  throw Error(util.format('queue id: `%s` is unmanaged', id));

};

QueueManager.prototype.pound = function(id) {

  if (!id) {
    throw Error('no id!');
  }

  this.getQueue(id).pounders++;

  // no reason this should be timeout.
  process.nextTick(
    this.pounder.bind({
      id: id,
      self: this
    }), 0
  );

};

QueueManager.prototype.get = function(id) {
  return this.getQueue(id).queue;
};

/**
 *
 * Queue data for the link given
 *
 * @param {string} id
 * @param {Packet} p
 * @public
 */
QueueManager.prototype.queue = function(id, p) {

  if (p.constructor.name !== 'Packet') {
    throw Error('not an instance of Packet');
  }

  if (this._shutdown) {
    this.drop('queue', id, p);
  } else {

    this.init(id);
    this.getQueue(id).queue.push(p);

    // as many pounds as there are items within queue.
    // the callback is just picking the last item not per se
    // the item we have just put within queue.
    this.pound(id);

  }

};

QueueManager.prototype.init = function(id) {
  if (!this.queues.hasOwnProperty(id)) {
    this.queues[id] = new Queue();
  }
};

QueueManager.prototype.unshift = function(id, p) {

  var queue = this.getQueue(id);
  queue.queue.unshift(p);

  this.unlock(id);

};

/**
 *
 * Pick an item from the queue.
 *
 * @param {id} id
 * @public
 */
QueueManager.prototype.pick = function(id) {
  if (this.hasQueue(id)) {
    return this.queues[id].queue.shift();
  }
};

/**
 *
 * Determine whether there is a queue for this link.
 *
 * @param {string} id
 * @public
 */
QueueManager.prototype.hasQueue = function(id) {
  return this.queues[id] && this.queues[id].queue.length > 0;
};

QueueManager.prototype.isManaged = function(id) {
  return this.queues.hasOwnProperty(id);
};

QueueManager.prototype.size = function(id) {
  return this.getQueue(id).queue.length;
};

/**
 *
 * Reset this queue manager
 *
 * @public
 */
QueueManager.prototype.reset = function(cb) {

  var self = this;
  var retries;
  var countdown;

  this._shutdown = true;

  // all unlocked
  this.unlockAll();

  countdown = retries = 10; // 1000;

  var func = function ShutdownQueManager() {

    if (countdown === 0) {
      console.warn(
        util.format('Failed to stop queue after %s cycles', retries)
      );
    }
    if (self.inQueue === 0 || countdown === 0) {

      self.queues = {};

      self._shutdown = false;

      if (cb) {
        cb();
      }

    } else {

      countdown--;
      setTimeout(func, 0);

    }

  };

  // put ourselves at the back of all unlocks.
  setTimeout(func, 0);

};

QueueManager.prototype.isLocked = function(id) {
  // means whether it has queue length..
  if (!this.isManaged(id)) {
    return false;
  }
  var q = this.getQueue(id);
  return q.lock;
};

QueueManager.prototype.lock = function(id) {
  this.init(id);
  var q = this.getQueue(id);
  q.lock = true;

};

QueueManager.prototype.flushAll = function() {
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.flush(id);
    }
  }
};

QueueManager.prototype.purgeAll = function() {
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.purge(this.queues[id]);
    }
  }
};

QueueManager.prototype.purge = function(q) {
  while (q.queue.length) {
    this.drop('purge', q.queue.pop());
  }
};

QueueManager.prototype.unlockAll = function() {
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.unlock(id);
    }
  }
};

QueueManager.prototype.unlock = function(id) {
  if (this.hasQueue(id)) {
    this.flush(id);
  }
};

QueueManager.prototype.flush = function(id) {

  var i;
  var q = this.getQueue(id);

  // first determine current length
  var currentLength = (q.queue.length - q.pounders);

  q.lock = false;

  for (i = 0; i < currentLength; i++) {
    this.pound(id);
  }
};

// not sure, maybe make only the ioHandler responsible for this?
QueueManager.prototype.drop = function(type) {
  console.warn('QueueManager: dropping packet: ', type, this.inQueue);
};

/**
 *
 * Used to get all queues which have queues.
 * Maybe I should just remove queues.
 * But queues reappear so quickly it's not
 * worth removing it.
 *
 * Something to fix later, in that case this.queues
 * would always be queues which have items.
 *
 * Anyway for debugging it's also much easier
 * because there will not be a zillion empty queues.
 *
 * Usage:
 *
 * if (qm.inQueue()) {
 *   var queued = qm.getQueued();
 * }
 *
 */
QueueManager.prototype.getQueues = function() {

  var id;
  var queued = {};
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      if (this.queues[id].queue.length > 0) {
        queued[id] = this.queues[id];
      }
    }
  }
  return queued;
};

module.exports = QueueManager;

}).call(this,require("uojqOp"))
},{"uojqOp":4,"util":6}],21:[function(require,module,exports){
'use strict';

var DefaultContextProvider = require('./context/defaultProvider');

/**
 *
 * We will run inside an instance.
 *
 * At the moment the run context is purely the callback.
 * TODO: which fails hard
 *
 */
function Run(actor, callback) {

  var iId;

  this.actor = actor;

  // Used with callback handling
  // Keeps track of the number of exposed output ports
  this.outputPorts = [];

  // data we will give to the callback
  this.output = {};
  this.outputCount = 0;

  this.callback = callback;

  if (!actor.contextProvider) {
    actor.contextProvider = new DefaultContextProvider();
  }

  for (iId in actor.nodes) {
    if (actor.nodes.hasOwnProperty(iId)) {

      // Als deze node in onze view zit
      if (actor.view.indexOf(iId) >= 0) {

        if (
          this.callback &&
          actor.nodes[iId].ports &&
          actor.nodes[iId].ports.output
          ) {

          for (var key in actor.nodes[iId].ports.output) {
            // this is related to actions.
            // not sure If I want to keep that..
            // Anyway expose is gone, so this is never
            // called now.
            //
            // expose bestaat niet meer, de integrerende flow
            // krijgt gewoon de poorten nu.
            if (actor.nodes[iId].ports.output[key].expose) {
              this.outputPorts.push(key);
            }
          }

          actor.nodes[iId].on(
            'output',
            this.handleOutput.bind(this)
          );

        }
      }

    }

  }

  if (this.callback && !this.outputPorts.length) {

    throw new Error('No exposed output ports available for callback');

  }

  if (actor.trigger) {
    actor.sendIIP(actor.trigger, '');
  }

}

Run.prototype.handleOutput = function(data) {

  if (this.outputPorts.indexOf(data.port) >= 0) {

    if (!this.output.hasOwnProperty(data.node.id)) {
      this.output[data.node.id] = {};
    }

    this.output[data.node.id][data.port] = data.out;

    this.outputCount++;

    if (this.outputPorts.length === this.outputCount) {

      this.outputCount = 0; // reset

      this.callback.apply(this.actor, [this.output]);

      this.output = {};

    }

  }

};

module.exports = Run;

},{"./context/defaultProvider":10}],22:[function(require,module,exports){
(function (process,global){
'use strict';

var IOBox = require('iobox');
var util  = require('util');
var path  = require('path');

// taken from underscore.string.js
function _underscored(str) {
  // also underscore dot
  return str
    .replace(/([a-z\d])([A-Z]+)/g, '$1_$2')
    .replace(/[\.\-\s]+/g, '_')
    .toLowerCase();
}

/**
 *
 * NodeBox
 *
 * @constructor
 * @public
 *
 */
function NodeBox(name) {

  if (!(this instanceof NodeBox)) {
    return new NodeBox(name);
  }

  this.args = {};

  // what to return from the function
  this.return = ['output', 'state', 'on'];

  // Define the structure
  this.addArg('input', {});
  this.addArg('output', {});
  this.addArg('console', console);
  this.addArg('done', null);
  this.addArg('state', {});
  this.addArg('cb', null);
  this.addArg('on', {input: {}});

  this.name = name || 'NodeBox';

}

util.inherits(NodeBox, IOBox);

/**
*
* Used to access the properties at the top level,
* but still be able to get all relevant arguments
* at once using this.args
*
* TODO: just move this to IOBox.
*
* @param {String} key
* @param {Mixed} initial
*/
NodeBox.prototype.addArg = function(key, initial) {

  Object.defineProperty(this, key, {
    set: function(val) { this.args[key] = val; },
    get: function() { return this.args[key]; }
  });

  if (typeof initial !== 'undefined') {
    this[key] = initial;
  }

};

/**
*
* Sets a property of the sandbox.
* Because the keys determine what arguments will
* be generated for the function, it is important
* we keep some kind of control over what is set.
*
* @param {String} key
* @param {Mixed} value
*
*/
NodeBox.prototype.set = function(key, value) {

  if (this.args.hasOwnProperty(key)) {
    this.args[key] = value;
  } else {
    throw new Error([
      'Will not set unknown property',
      key
    ].join(' '));
  }
};

/**
*
* Add requires to the sandbox.
*
* xNode should use check = true and then have
* a try catch block.
*
* @param {Object} requires
* @param {Boolean} check
*/
NodeBox.prototype.require = function(requires, check) {

  // Ok, the generic sandbox should do the same logic
  // for adding the requires but should not check if
  // they are available.
  var key;
  var ukey;

  // 'myrequire': '<version'
  for (key in requires) {

    if (requires.hasOwnProperty(key)) {

      // only take last part e.g. chix-flow/SomeThing-> some_thing
      ukey = _underscored(key.split('/').pop());

      this.emit('require', {require: key});

      if (check !== false) {

        try {

          this.args[ukey] = require(key);

        } catch (e) {

          // last resort, used by cli
          var p =  path.resolve(
              process.cwd(),
              'node_modules',
              key
          );

          this.args[ukey] = require(p);
        }

      } else {

        // just register it, used for generate
        this.args[ukey] = undefined;

      }
    }
  }
};

NodeBox.prototype.expose = function(expose, CHI) {

  var i;
  // created to allow window to be exposed to a node.
  // only meant to be used for dom nodes.
  var g = typeof window === 'undefined' ? global : window;

  if (expose) {

    for (i = 0; i < expose.length; i++) {

      this.emit('expose', {expose: expose[i]});

      if (expose[i] === 'window') {
        this.args.win = window;
      } else if (expose[i] === 'chi') {
        this.args.chi = CHI;
      } else if (expose[i] === 'self') {
        this.args.self = this;
      } else {
        // Do not re-expose anything already going in
        if (!this.args.hasOwnProperty(expose[i])) {
          this.args[expose[i]] = g[expose[i]];
        }
      }
    }

  }
};

NodeBox.prototype.compile = function(fn) {

  return IOBox.prototype.compile.call(
    this, fn, Object.keys(this.args), this.return, true // return as object
  );

};

/**
 *
 * Runs the sandbox.
 *
 */
NodeBox.prototype.run = function(bind) {

  var k;
  var res = IOBox.prototype.run.apply(this, [this.args, bind]);
  var ret;

  // puts the result back into our args/state
  for (k in res) {
    if (k === 'return') {
      ret = res['return'];
    } else if (res.hasOwnProperty(k)) {
      this.args[k] = res[k];
    }
  }
  return ret; // original return value
};

module.exports = NodeBox;

}).call(this,require("uojqOp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"iobox":34,"path":3,"uojqOp":4,"util":6}],23:[function(require,module,exports){
'use strict';

var NodeBox = require('./node');
var util = require('util');

/**
 *
 * PortBox
 *
 * @constructor
 * @public
 *
 */
function PortBox(name) {

  if (!(this instanceof PortBox)) {
    return new PortBox(name);
  }

  this.args = {};

  // what to return from the function.
  this.return = ['state'];

  // Define the structure
  this.addArg('data', null);
  this.addArg('x', {}); // not sure, _is_ used but set later
  this.addArg('source', null); // not sure..
  this.addArg('state', {});
  this.addArg('input', {});
  this.addArg('output', null); // output function should be set manually

  this.name = name || 'PortBox';

}

util.inherits(PortBox, NodeBox);

module.exports = PortBox;

},{"./node":22,"util":6}],24:[function(require,module,exports){
'use strict';

var util         = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * Setting
 *
 * Both used by Connector and xLink
 *
 * @constructor
 * @public
 *
 */
function Setting(settings) {

  for (var key in settings) {
    if (settings.hasOwnProperty(key)) {
      this.set(key, settings[key]);
    }
  }
}

util.inherits(Setting, EventEmitter);

/**
 *
 * Set
 *
 * Sets a setting
 *
 * @param {String} name
 * @param {Any} val
 */
Setting.prototype.set = function(name, val) {
  if (undefined !== val) {
    if (!this.setting) {
      this.setting = {};
    }
    this.setting[name] = val;
  }
};

/**
 *
 * Get
 *
 * Returns the setting or undefined.
 *
 * @returns {Any}
 */
Setting.prototype.get = function(name) {
  return this.setting ? this.setting[name] : undefined;
};

/**
 *
 * Delete a setting
 *
 * @returns {Any}
 */
Setting.prototype.del = function(name) {
  if (this.setting && this.setting.hasOwnProperty(name)) {
    delete this.setting[name];
  }
};

/**
 *
 * Check whether a setting is set.
 *
 * @returns {Any}
 */
Setting.prototype.has = function(name) {
  return this.setting && this.setting.hasOwnProperty(name);
};

module.exports = Setting;

},{"events":1,"util":6}],25:[function(require,module,exports){
'use strict';

var jsongate = require('json-gate');
var mSjson = require('../schemas/map.json');
var nDjson = require('../schemas/node.json');
var mapSchema = jsongate.createSchema(mSjson);
var nodeSchema = jsongate.createSchema(nDjson);

function ValidationError(message, id, obj) {
  this.message = message;
  this.id = id;
  this.obj = obj;
  this.name = 'ValidationError';
}

/**
 *
 * Check if we are not adding a (rotten) flow. Where there are id's which
 * overlap other ids in other flows.
 *
 * This shouldn't happen but just perform this check always.
 *
 * Currently it _will_ happen if you open the same flow twice. Saving those
 * seperatly can cause weird results ofcourse.
 *
 * So also modify the code, so if you do this you will just go To the screen
 * which already has the flow open.
 *
 * Add a growl like notication that this is done so.
 *
 * This should be added to Actor
 *
 */
function _checkIds(flow, nodeDefinitions) {

  var i;
  var knownIds = [];
  var nodes = {};
  var node;
  var link;
  var source;
  var target;

  if (flow.nodes.length > 0 && !nodeDefinitions) {
    throw new Error('Cannot validate without nodeDefinitions');
  }

  // we will not add the flow, we will show a warning and stop adding the
  // flow.
  for (i = 0; i < flow.nodes.length; i++) {

    node = flow.nodes[i];

    // nodeDefinition should be loaded
    if (!node.ns) {
      throw new ValidationError(
          'NodeDefinition without namespace: ' + node.name
          );
    }
    if (!nodeDefinitions[node.ns]) {
      throw new ValidationError(
          'Cannot find nodeDefinition namespace: ' + node.ns
          );
    }
    if (!nodeDefinitions[node.ns][node.name]) {
      throw new ValidationError(
          'Cannot find nodeDefinition name ' + node.ns + ' ' + node.name
          );
    }

    knownIds.push(node.id);
    nodes[node.id] = node;

    //_checkPortDefinitions(nodeDefinitions[node.ns][node.name]);
  }

  for (i = 0; i < flow.links.length; i++) {

    link = flow.links[i];

    // links should not point to non-existing nodes.
    if (knownIds.indexOf(link.source.id) === -1) {
      throw new ValidationError(
        'Source node does not exist ' + link.source.id
      );
    }
    if (knownIds.indexOf(link.target.id) === -1) {
      throw new ValidationError(
        'Target node does not exist ' + link.target.id
      );
    }

    // check if what is specified as port.out is an input port on the target
    source = nodes[link.source.id];
    target = nodes[link.target.id];

    // allow :start
    if (link.source.port[0] !== ':' &&
        !nodeDefinitions[source.ns][source.name]
        .ports.output[link.source.port]) {
      throw new ValidationError([
          'Process',
          link.source.id,
          'has no output port named',
          link.source.port,
          '\n\n\tOutput ports available:',
          '\n\n\t',
          Object.keys(
            nodeDefinitions[source.ns][source.name].ports.output
            ).join(', ')
          ].join(' '));
    }

    if (link.target.port[0] !== ':' &&
        !nodeDefinitions[target.ns][target.name]
        .ports.input[link.target.port]) {
      throw new ValidationError([
          'Process',
          link.target.id,
          'has no input port named',
          link.target.port,
          '\n\n\tInput ports available:',
          '\n\n\t',
          Object.keys(
            nodeDefinitions[target.ns][target.name].ports.input
            ).join(', ')
          ].join(' '));
    }

  }

  return true;

}

/**
 *
 * Validates a nodeDefinition
 *
 */
function validateNodeDefinition(nodeDef) {

  nodeSchema.validate(nodeDef);

  // _checkIds(flow, nodeDefinitions);

  // make sure the id's are correct

}

/**
 *
 * Validates the flow
 *
 */
function validateFlow(flow) {

  mapSchema.validate(flow);

  // _checkIds(flow, nodeDefinitions);

  // make sure the id's are correct

}

module.exports = {
  flow: validateFlow,
  nodeDefinition: validateNodeDefinition,
  nodeDefinitions: _checkIds
};

},{"../schemas/map.json":43,"../schemas/node.json":44,"json-gate":38}],"chix-flow":[function(require,module,exports){
module.exports=require('jXAsbI');
},{}],"jXAsbI":[function(require,module,exports){
'use strict';

var xNode = require('./lib/node');
var xFlow = require('./lib/flow');
var xLink = require('./lib/link');
var Actor = require('./lib/actor');
var mapSchema = require('./schemas/map.json');
var nodeSchema = require('./schemas/node.json');
var stageSchema = require('./schemas/stage.json');
var Validate = require('./lib/validate');

module.exports = {
  Node: xNode,
  Flow: xFlow,
  Link: xLink,
  Actor: Actor,
  Validate: Validate,
  Schema: {
    Map: mapSchema,
    Node: nodeSchema,
    Stage: stageSchema
  }
};

},{"./lib/actor":8,"./lib/flow":11,"./lib/link":13,"./lib/node":15,"./lib/validate":25,"./schemas/map.json":43,"./schemas/node.json":44,"./schemas/stage.json":45}],28:[function(require,module,exports){
'use strict';

var util         = require('util');
var Store        = require('./store');
var Group        = require('./group');
var PortSyncer   = require('./portSyncer');
var PortPointer  = require('./portPointer');
var EventEmitter = require('events').EventEmitter;

function CHI() {

  if (!(this instanceof CHI)) return new CHI();

  this.groups   = new Store(); // for groups
  this.pointers = new Store(); // for 'pointers'
  this._sync    = new Store(); // for 'syncing'

  this.queue = {};
}

util.inherits(CHI, EventEmitter);

/**
 *
 * Creates a new group/collection
 *
 */
CHI.prototype.group = function(port, cb) {
  // Generates new groupID
  var g = new Group(port, cb);

  this.groups.set(g.gid(), g);
  this.emit('begingroup', g);

  return g;
};

/**
 *
 * Simple way to give a unique common id to the data
 * at the output ports which want to be synced later on.
 *
 *  *in indicates we want to take along the common id of
 *  the other ports also pointing to the process.
 *
 *  Later this can be used with input ports that have
 *  been set to `sync` with the output originating from
 *  a process they specify.
 *
 * @param {String} nodeId
 * @param {String} port      The current port
 * @param {Object} chi
 * @param {Array}  syncPorts Array of port names to sync
 */
CHI.prototype.pointer = function(sourceId, port, p, identifier) {

  if(p.chi.hasOwnProperty(sourceId)) {
    return;
    /*
    throw new Error(
      'item already set'
    );
    */
  }

  var pp = this.pointers.get(sourceId);

  if(!pp) {
    pp = new PortPointer(identifier);
    this.pointers.set(sourceId, pp);
  }

  // will give the correct id, based on the ports queue
  var itemId = pp.add(port);

  // send along with the chi.
  // note: is within the same space as the groups.
  //
  // The packet now remembers the item id given by this node.
  // The Port Pointer which is created per node, stores this
  // item id.
  //
  // The only job of the PortPointer is assigning unique
  // itemIds, ids which are incremented.
  //
  // Then this.pointers keeps track of these PortPointers
  // per node.
  //
  // So what we end up with is a node tagging each and every
  // node who wanted a pointer and keeping track of
  // what ids were assigned. The collection name *is* a PortPointer
  //
  // Then now, how is the match then actually made?
  //
  // Ah... going different routes, that what this was about.
  // The origin is *one* output event *one* item.
  //
  // Then traveling different paths we ask for port sync.
  //
  // This sync is then based on this id, there became different
  // packets carrying this same item id.
  //
  // So probably the problem is cloning, I just have send
  // the chi along and copied that, so everywhere where that's
  // taking place a clone should take place.
  //
  // If I'll look at how sync works, there is probably
  // not a lot which could go wrong. it's the cloning not taking
  // place. I think something get's overwritten constantly.
  // ending up with the last `contents`
  //
  // De packet data keeps changing which is ok, but the chi
  // changes along with it or something.
  p.chi[sourceId] = itemId;

};

CHI.prototype.sync = function(link, originId, p, syncPorts) {

  var ps = this._sync.get(link.target.pid);
  if(!ps) {
    ps = new PortSyncer(originId, syncPorts);
    this._sync.set(link.target.pid, ps);
  }

  //var ret = ps.add(link, data, chi);
  //
  // This returns whatever is synced
  // And somehow this doesn't give us correct syncing.
  var ret = ps.add(link, p);
  if(ret !== undefined) {
    // what do we get returned?
    this.emit('synced', link.target.pid, ret);
  }

  // chi, need not be removed it could be re-used.
};

//CHI.prototype.collect = function(link, output, chi) {
CHI.prototype.collect = function(link, p) {

  var idx, mx = -1, self = this;

  // ok this is actually hard to determine.
  for(var gid in p.chi) {
    if(p.chi.hasOwnProperty(gid)) {
      // determine last group
      idx = this.groups.order.indexOf(gid);
      mx = idx > mx ? idx : mx;
    }
  }

  if(mx === -1) {
    throw Error('Could not match group');
  }

  gid = this.groups.order[mx];

  if(!this.queue.hasOwnProperty(link.ioid)) {
    this.queue[link.ioid] = {};
  }

  if(!Array.isArray(this.queue[link.ioid][gid])) {
    this.queue[link.ioid][gid] = [];
    this.groups.get(gid).on('complete', function() {
      //self.readySend(link, gid, chi);
      self.readySend(link, gid, p);
    });
  }

  // only push the data, last packet is re-used
  // to write the data back.
  this.queue[link.ioid][gid].push(p.data);

  //this.readySend(link, gid, chi);
  this.readySend(link, gid, p);

};

// TODO: should not work on link here..
//CHI.prototype.readySend = function(link, gid, chi) {
CHI.prototype.readySend = function(link, gid, p) {

  // get group
  var group = this.groups.get(gid);

  if(
     // if group is complete
     group.complete &&
     // if queue length matches the group length
     this.queue[link.ioid][gid].length === group.length
     ) {

    // Important: group seizes to exist for _this_ path.
    delete p.chi[gid];

    // Reusing last collected packet to write the group data
    p.write(this.queue[link.ioid][gid]);
    link.write(p);

    // reset
    this.queue[link.ioid][gid] = [];

    /* Not sure..
      delete output.chi[gid];        // remove it for our requester
      // group still exists for other paths.
      delete this.store[gid];        // remove from the store
      this.groupOrder.splice(mx, 1); // remove from the groupOrder.
    */
  }

};

// TODO: could just accept a packet and merge it.
CHI.prototype.merge = function (newChi, oldChi, unique) {

  // nothing to merge
  if(Object.keys(oldChi).length) {

    for(var c in oldChi) {
      if(oldChi.hasOwnProperty(c)) {

        if(newChi.hasOwnProperty(c) &&
          newChi[c] !== oldChi[c]
          ) {

          // problem here is, you are overwriting itemId's
          // Test, not sure if this should never happen.
          // When we merge that *is* what is happening no?
          if(unique) {
            throw new Error('refuse to overwrite chi item');
          }
        } else {
          newChi[c] = oldChi[c];
        }
      }
    }
  }
};

module.exports = CHI;

},{"./group":29,"./portPointer":30,"./portSyncer":31,"./store":32,"events":1,"util":6}],29:[function(require,module,exports){
'use strict';

var util = require('util'),
  uuid = require('uuid').v4,
  EventEmitter = require('events').EventEmitter;

/**
 *
 * Simple grouping.
 *
 * Group can be used from within blackbox.
 *
 * Or is used during cyclic and collect mode.
 *
 * During cyclic mode it can be considered virtual grouping.
 *
 * The virtual group will be recollected during collect mode.
 *
 * For now this will be simple, there can only be one collector
 * and the group will seize too exists once it's collected.
 *
 */
function Group(port, cb) {
  if(arguments.length !== 2) {
    throw new Error('Not enough arguments');
  }

  // these are undefined in virtual mode
  this.cb = cb;
  this.port = port;

  var prefix = 'gid-';
  prefix    += port ? port : '';

  this.info = {
    gid: Group.gid(prefix + '-'),
    complete: false,
    items: []
  };

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.info.items.length;
    }
  });

  Object.defineProperty(this, 'complete', {
    get: function() {
      return this.info.complete;
    }
  });

  /**
   *
   * Used to collect incomming data.
   * Until everything from this group is received.
   *
   */
  this.store = [];

  // send out the group info
  // Ok this will not work with the virtual ones
  // there is no port to send to.
  this.send();
}

util.inherits(Group, EventEmitter);

// allow (tests) to overwrite them
Group.gid    = function(prefix) { return prefix + uuid(); };
Group.itemId = uuid;

/**
 *
 * Generates a new itemId and returns
 * The group and itemId
 *
 * Used like this:
 *
 *  cb({
 *    match: match
 *  }, g.item());
 *
 * The item id is send across 'the wire' and we
 * maintain the total group info overhere.
 *
 * [<gid>] = itemId
 * [<gid>] = itemId
 *
 * Which is a bit too magical, so that must change.
 *
 */
Group.prototype.item = function(obj) {

  // auto merging, could be a bit risky
  // no idea if item is ever called without obj?
  obj = obj || {};
  if(obj.hasOwnProperty(this.info.gid)) {
    throw Error('Object is already within group');
  }

  var id = Group.itemId();

  // This is an ordered array
  this.info.items.push(id);

  obj[this.info.gid] = id;
  return obj;
};

/**
 *
 *
 */
Group.prototype.collect = function(packet) {

  this.store.push(packet);

};

Group.prototype.done = function() {
  // ok, now the send should take place.
  // so this triggers the whole output handling
  // of the node, which is what we want.
  // this is the asyncOutput btw..
  this.info.complete = true;
  // check here if something want's this group.
  // or just emit to CHI and let that class check it.
  this.send();

  this.emit('complete', this);

};

// TODO: remove done..
Group.prototype.end = Group.prototype.done;

/***
 *
 * Sends the output using the callback of the
 * node who requested the group.
 *
 * In case of grouping during cyclic mode, for now,
 * there is nothing to send to. In which case
 * the callback is empty.
 *
 */
Group.prototype.send = function() {

  // only send out if we have a callback.
  if(this.cb) {
    var out = {};
    out[this.port] = {
      gid: this.info.gid,
      complete: !!this.info.complete, // loose reference
      items: this.info.items
    };
    this.cb(out);
  }

};

Group.prototype.items = function() {
  return this.info.items;
};

Group.prototype.gid = function() {
  return this.info.gid;
};

module.exports = Group;

},{"events":1,"util":6,"uuid":42}],30:[function(require,module,exports){
'use strict';

var uuid = require('uuid').v4;

/**
 *
 * The PortPointer initializes
 * each source with the same unique
 * itemId.
 *
 * These are then increased per port.
 * So their id's stay in sync.
 *
 * This does give the restriction both
 * ports should give an equal amount of output.
 *
 * Which is err. pretty errorprone :-)
 * Or at least it depends per node, whether it is.
 */
function PortPointer(identifier) {

  // little more unique than just a number.
  this.id = PortPointer.uid(identifier ? identifier + '-' : '');

  // the idea of this counter is increment
  this.counter = 0;

  //this.cols = cols;

  this.store = {};
}

PortPointer.uid = function(prefix) {
  return prefix + uuid().split('-')[0];
};

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 */
PortPointer.prototype.add = function(port) {

  if(!this.store.hasOwnProperty(port)) {
    this.store[port] = [this.counter];
  }

  // not just taking store[port].length, don't want to reset during flush
  var nr = this.store[port][this.store[port].length - 1];
  this.store[port].push(++nr);

  // At some point we actually do not care about the id's anymore.
  // that's when all ports have the same id. fix that later.

  return this.id + '-' + nr;

};

module.exports = PortPointer;

},{"uuid":42}],31:[function(require,module,exports){
'use strict';

////
//
// Ok a syncArray is made per nodeId.
// So this is with that scope.
//
// chi: {
//   <nodeId>: <uuid>
// }
//
// We keep on serving as a gate for the
// synced ports here.
//
function PortSyncer(originId, syncPorts) {

  this.syncPorts = syncPorts;
  this.originId  = originId;

  this.store = {};

}

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 * If we send the data, we can remove it from our store..
 *
 */
//PortSyncer.prototype.add = function(link, data, chi) {
PortSyncer.prototype.add = function(link, p) {

  if(!p.chi.hasOwnProperty(this.originId)) {
    // that's a fail
    throw new Error([
      'Origin Node',
      this.originId,
      'not found within chi'
    ].join(' '));

  }

  if(this.syncPorts.indexOf(link.target.port) === -1) {
    throw new Error([
      'Refuse to handle data for unknown port:',
      link.target.port
      ].join('')
    );
  }

  // <originId>: <itemId>
  // Read back the item id the PortPointer for this node gave us
  var itemId = p.chi[this.originId];

  // if there is no store yet for this item id, create one
  if(!this.store.hasOwnProperty(itemId)) {
    // Create an object for the sync group
    // To contain the data per port.
    this.store[itemId] = {};
  }

  // store this port's data.
  this.store[itemId][link.target.port] = { link: link, p: p };

  // Ok the case of pointing twice with a port
  // using several links is not covered yet..

  // if we have synced all ports, both have added their data
  // then we are ready to send it back.
  // This is done by CHI.sync based on what is returned here.
  // So.. THE reason why we get wrong merged content can only
  // be if some `chi` has stored the wrong item id.
  // And this can only happen, during merging.
  // However merging does this check, so it does not happen
  // during CHI.merge. If it doesn't happen during CHI.merge
  // We have reference somewhere, where there shouldn't be
  // a reference. we re-use a packet.
  // Nice, so where does that take place.
  // and how to prevent it. at least where itemid is set
  // there should be a check whether it's already set.
  if(Object.keys(this.store[itemId]).length === this.syncPorts.length) {

    // return { in1: <data>, in2: <data> }
    // the synced stuff.
    var dat = this.store[itemId];

    // we will never see this itemId again
    delete this.store[itemId];

    return dat;

  } else {

    // not ready yet.
    return undefined;
  }

};

module.exports = PortSyncer;

},{}],32:[function(require,module,exports){
'use strict';

function Store() {
  this.store = {};
  this.order = [];

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.order.length;
    }
  });
}

Store.prototype.set = function(id, obj) {
  this.store[id] = obj;
  this.order.push(id);
};

Store.prototype.get = function(id) {
  return this.store[id];
};

Store.prototype.del = function(id) {
  this.order.splice(this.order.indexOf(id), 1);
  delete this.store[id];
};

Store.prototype.items = function() {
  return this.store;
};

Store.prototype.pop = function() {
  var id  = this.order.pop();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.shift = function() {
  var id  = this.order.shift();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.isEmpty = function() {
  return Object.keys(this.store).length === 0 &&
    this.order.length === 0;
};

module.exports = Store;

},{}],33:[function(require,module,exports){
module.exports = function InstanceOf(obj, type) {
  if(obj === null) return false;
  if(type === 'array') type = 'Array';
  var t = typeof obj;
  if(t === 'object') {
    if(type.toLowerCase() === t) return true; // Object === object
    if(obj.constructor.name === type) return true;
    if(obj.constructor.toString().match(/function (\w*)/)[1] === type) return true;
    return InstanceOf(Object.getPrototypeOf(obj), type);
  } else {
    return t === type;
  }
};

},{}],34:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * IO Box
 *
 * @param {Array} ins
 * @param {Array} outs
 */
var IOBox = function(name) {

  if (!(this instanceof IOBox)) return new IOBox(name);

  EventEmitter.apply(this, arguments);

  this.name = name || 'UNNAMED';

};

util.inherits(IOBox, EventEmitter);

IOBox.prototype.setup = function(ins, outs) {

  var i;

  this.keys = ins;
  this.ins  = {};
  this.outs = outs;
  this.fn  = undefined;

  // setup the empty input arguments object
  for(i = 0; i < ins.length; i++) {
    this.ins[ins[i]] = undefined;
  }

  for(i = 0; i < outs.length; i++) {
    if(this.keys.indexOf(outs[i]) === -1) {
      throw new Error([
        'Output `',
        outs[i],
        '` is not one of',
        this.keys.join(', ')
      ].join(' '));
    }
  }
};

/**
 *
 * Compiles and returns the generated function.
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.compile = function(fn, ins, outs, asObject) {

  if(!this.code) this.generate(fn, ins, outs, asObject);

  this.fn = new Function(this.code)();

  return this.fn;

};

/**
 *
 * Wraps the function in yet another function
 *
 * This way it's possible to get the original return.
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype._returnWrap = function(fn) {
  return ['function() {', fn, '}.call(this);'].join('\n');
};

/**
 *
 * Generates the function.
 *
 * This can be used directly
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.generate = function(fn, ins, outs, asObject) {

  this.setup(ins, outs);

  this.code = [
    'return function ',
    this.name,
    '(',
    this.keys.join(','),
    ') {\n',
    'var ret = ', // ret goes to 'return'
    this._returnWrap(fn),
    '; return ',
    asObject ? this._asObject() : this._asArray(),
    '; }'
  ].join('');

  return this.code;
};

/**
 *
 * Return output as array.
 *
 * @return {Array}
 */
IOBox.prototype._asArray = function() {
  return '[' + this.outs.join(',') + ',ret]';
};

/**
 *
 * Return output as object.
 *
 * @return {String}
 */
IOBox.prototype._asObject = function() {
  var ret = [];
  for(var i = 0; i < this.outs.length; i++) {
    ret.push(this.outs[i] + ':' + this.outs[i]);
  }
  ret.push('return:' + 'ret');

  return '{' +  ret.join(',') + '}';
};

/**
 *
 * Renders the function to string.
 *
 * @return {String}
 */
IOBox.prototype.toString = function() {
  if(this.fn) return this.fn.toString();
  return this.fn;
};

/**
 *
 * Runs the generated function
 *
 * @param {Mixed} input
 * @param {Mixed} bind   Context to bind to the function
 * @return {Mixed}
 */
IOBox.prototype.run = function(input, bind) {

  var v = [], k;

  if(Array.isArray(input)) {
    // array must be passed correctly
    v = input;
  } else {
    // automatic ordering of input
    for (k in input) {
      if(this.ins.hasOwnProperty(k)) {
        v[this.keys.indexOf(k)] = input[k];
      } else {
        throw new Error('unknown input ' + k);
      }
    }
  }

  // returns the output, format depends on the `compile` step
  return this.fn.apply(bind, v);

};

module.exports = IOBox;

},{"events":1,"util":6}],35:[function(require,module,exports){
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

module.exports = function isPlainObject(o) {
  return !!o && typeof o === 'object' && o.constructor === Object;
};
},{}],36:[function(require,module,exports){
exports.getType = function (obj) {
	switch (Object.prototype.toString.call(obj)) {
		case '[object String]':
			return 'string';
		case '[object Number]':
			return (obj % 1 === 0) ? 'integer' : 'number';
		case '[object Boolean]':
			return 'boolean';
		case '[object Object]':
			return 'object';
		case '[object Array]':
			return 'array';
		case '[object Null]':
			return 'null';
		default:
			return 'undefined';
	}
}

exports.prettyType = function(type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
			return 'a ' + type;
		case 'integer':
		case 'object':
		case 'array':
			return 'an ' + type;
		case 'null':
			return 'null';
		case 'any':
			return 'any type';
		case 'undefined':
			return 'undefined';
		default:
			if (typeof type === 'object') {
				return 'a schema'
			} else {
				return type;
			}
	}
}


exports.isOfType = function (obj, type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
		case 'object':
		case 'array':
		case 'null':
			type = type.charAt(0).toUpperCase() + type.slice(1);
			return Object.prototype.toString.call(obj) === '[object ' + type + ']';
		case 'integer':
			return Object.prototype.toString.call(obj) === '[object Number]' && obj % 1 === 0;
		case 'any':
		default:
			return true;
	}
}

exports.getName = function (names) {
	return names.length === 0 ? '' : ' property \'' + names.join('.') + '\'';
};

exports.deepEquals = function (obj1, obj2) {
	var p;

	if (Object.prototype.toString.call(obj1) !== Object.prototype.toString.call(obj2)) {
		return false;
	}

	switch (typeof obj1) {
		case 'object':
			if (obj1.toString() !== obj2.toString()) {
				return false;
			}
			for (p in obj1) {
				if (!(p in obj2)) {
					return false;
				}
				if (!exports.deepEquals(obj1[p], obj2[p])) {
					return false;
				}
			}
			for (p in obj2) {
				if (!(p in obj1)) {
					return false;
				}
			}
			return true;
		case 'function':
			return obj1[p].toString() === obj2[p].toString();
		default:
			return obj1 === obj2;
	}
};

},{}],37:[function(require,module,exports){
var RE_0_TO_100 = '([1-9]?[0-9]|100)';
var RE_0_TO_255 = '([1-9]?[0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';

function validateFormatUtcMillisec(obj) {
	return obj >= 0;
}

function validateFormatRegExp(obj) {
	try {
		var re = RegExp(obj);
		return true;
	} catch(err) {
		return false;
	}
}

var COLORS = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow'];
var colorsReHex3 = /^#[0-9A-Fa-f]{3}$/; // #rgb
var colorsReHex6 = /^#[0-9A-Fa-f]{6}$/; // #rrggbb
var colorsReRgbNum = RegExp('^rgb\\(\\s*' + RE_0_TO_255 + '(\\s*,\\s*' + RE_0_TO_255 + '\\s*){2}\\)$'); // rgb(255, 0, 128)
var colorsReRgbPerc = RegExp('^rgb\\(\\s*' + RE_0_TO_100 + '%(\\s*,\\s*' + RE_0_TO_100 + '%\\s*){2}\\)$'); // rgb(100%, 0%, 50%)

function validateFormatColor(obj) {
	return COLORS.indexOf(obj) !== -1 || obj.match(colorsReHex3) || obj.match(colorsReHex6)
		|| obj.match(colorsReRgbNum) || obj.match(colorsReRgbPerc);
}

var phoneReNational = /^(\(\d+\)|\d+)( \d+)*$/;
var phoneReInternational = /^\+\d+( \d+)*$/;

function validateFormatPhone(obj) {
	return obj.match(phoneReNational) || obj.match(phoneReInternational);
}

var formats = {
	'date-time': { // ISO 8601 (YYYY-MM-DDThh:mm:ssZ in UTC time)
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d:[0-5]\d([.,]\d+)?Z$/
	},
	'date': { // YYYY-MM-DD
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}$/
	},
	'time': { // hh:mm:ss
		types: ['string'],
		regex: /^[0-2]\d:[0-5]\d:[0-5]\d$/
	},
	'utc-millisec': {
		types: ['number', 'integer'],
		func: validateFormatUtcMillisec
	},
	'regex': { // ECMA 262/Perl 5
		types: ['string'],
		func: validateFormatRegExp
	},
	'color': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatColor
	},
	/* TODO: support style
		* style - A string containing a CSS style definition, based on CSS 2.1 [W3C.CR-CSS21-20070719].
		Example: `'color: red; background-color:#FFF'`.

	'style': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatStyle
	},*/
   	'phone': { // E.123
		types: ['string'],
		func: validateFormatPhone
	},
	'uri': {
		types: ['string'],
		regex: RegExp("^([a-z][a-z0-9+.-]*):(?://(?:((?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(?::(\\d*))?(/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?|(/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?)(?:\\?((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?(?:#((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?$", 'i')
	},
	'email': {
		types: ['string'],
		regex: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
	},
	'ip-address': {
		types: ['string'],
		regex: RegExp('^' + RE_0_TO_255 + '(\\.' + RE_0_TO_255 + '){3}$')
	},
	'ipv6': {
		types: ['string'],
		regex: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
	},
	'host-name': {
		types: ['string'],
		regex: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
	}
};

exports.formats = formats;

},{}],38:[function(require,module,exports){
var validateSchema = require('./valid-schema'),
	validateObject = require('./valid-object');

var Schema = function(schema) {
	this.schema = schema;
	validateSchema(schema);

	this.validate = function(obj, done) {
		validateObject(obj, schema, done);
	}
}

module.exports.createSchema = function (schema) {
	return new Schema(schema);
}

},{"./valid-object":39,"./valid-schema":40}],39:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	deepEquals = common.deepEquals;

function throwInvalidValue(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidAttributeValue(names, attribFullName, value, expected) {
	throw new Error('JSON object' + getName(names) + ': ' + attribFullName + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidType(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function throwInvalidDisallow(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should not be ' + expected);
}

function validateRequired(obj, schema, names) {
	//console.log('***', names, 'validateRequired');
	if (schema.required) {
		if (obj === undefined) {
			throw new Error('JSON object' + getName(names) + ' is required');
		}
	}
}

function applyDefault(obj, schema, names) {
	//console.log('***', names, 'applyDefault');
	if (schema.default !== undefined) {
		obj = schema.default;
	}

	return obj;
}

function validateType(obj, schema, names) {
	//console.log('***', names, 'validateType');
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type
				if (!isOfType(obj, schema.type)) {
					throwInvalidType(names, obj, prettyType(schema.type));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.type[i])) {
								return; // success
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								return validateSchema(obj, schema.type[i], names);
							} catch(err) {
								// validation failed
								// TOOD: consider propagating error message upwards
							}
							break;
					}
				}
				throwInvalidType(names, obj, 'either ' + schema.type.map(prettyType).join(' or '));
				break;
		}
	}
}

function validateDisallow(obj, schema, names) {
	//console.log('***', names, 'validateDisallow');
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type
				if (isOfType(obj, schema.disallow)) {
					throwInvalidDisallow(names, obj, prettyType(schema.disallow));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.disallow[i])) {
								throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(obj, schema.disallow[i], names);
							} catch(err) {
								// validation failed
								continue;
							}
							throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							// TOOD: consider propagating error message upwards
							break;
					}
				}
				break;
		}
	}
}

function validateEnum(obj, schema, names) {
	//console.log('***', names, 'validateEnum');
	if (schema['enum'] !== undefined) {
		for (var i = 0; i < schema['enum'].length; ++i) {
			if (deepEquals(obj, schema['enum'][i])) {
				return;
			}
		}
		throw new Error('JSON object' + getName(names) + ' is not in enum');
	}
}

function validateArray(obj, schema, names) {
	//console.log('***', names, 'validateArray');
	var i, j;

	if (schema.minItems !== undefined) {
		if (obj.length < schema.minItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at least ' + schema.minItems);
		}
	}

	if (schema.maxItems !== undefined) {
		if (obj.length > schema.maxItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.maxItems);
		}
	}

	if (schema.items !== undefined) {
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				for (i = 0; i < obj.length; ++i) {
					obj[i] = validateSchema(obj[i], schema.items, names.concat([ '['+i+']' ]));
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				var numChecks = Math.min(obj.length, schema.items.length);
				for (i = 0; i < numChecks; ++i) {
					obj[i] = validateSchema(obj[i], schema.items[i], names.concat([ '['+i+']' ]));
				}
				if (obj.length > schema.items.length) {
					if (schema.additionalItems !== undefined) {
						if (schema.additionalItems === false) {
							throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.items.length + ' - the length of schema items');
						}
						for (; i < obj.length; ++i) {
							obj[i] = validateSchema(obj[i], schema.additionalItems, names.concat([ '['+i+']' ]));
						}
					}
				}
				break;
		}
	}

	if (schema.uniqueItems !== undefined) {
		for (i = 0; i < obj.length - 1; ++i) {
			for (j = i + 1; j < obj.length; ++j) {
				if (deepEquals(obj[i], obj[j])) {
					throw new Error('JSON object' + getName(names) + ' items are not unique: element ' + i + ' equals element ' + j);
				}
			}
		}
	}
}

function validateObject(obj, schema, names) {
	//console.log('***', names, 'validateObject');
	var prop, property;
	if (schema.properties !== undefined) {
		for (property in schema.properties) {
			prop = validateSchema(obj[property], schema.properties[property], names.concat([property]));
			if (prop === undefined) {
				delete obj[property];
			} else {
				obj[property] = prop;
			}
		}
	}

	var matchingProperties = {};
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			var re = RegExp(reStr);
			for (property in obj) {
				if (property.match(re)) {
					matchingProperties[property] = true;
					prop = validateSchema(obj[property], schema.patternProperties[reStr], names.concat(['patternProperties./' + property + '/']));
					if (prop === undefined) {
						delete obj[property];
					} else {
						obj[property] = prop;
					}
				}
			}
		}
	}

	if (schema.additionalProperties !== undefined) {
		for (property in obj) {
			if (schema.properties !== undefined && property in schema.properties) {
				continue;
			}
			if (property in matchingProperties) {
				continue;
			}
			// additional
			if (schema.additionalProperties === false) {
				throw new Error('JSON object' + getName(names.concat([property])) + ' is not explicitly defined and therefore not allowed');
			}
			obj[property] = validateSchema(obj[property], schema.additionalProperties, names.concat([property]));
		}
	}

	if (schema.dependencies !== undefined) {
		for (property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency
					if (property in obj && !(schema.dependencies[property] in obj)) {
						throw new Error('JSON object' + getName(names.concat([schema.dependencies[property]])) + ' is required by property \'' + property + '\'');
					}
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (property in obj && !(schema.dependencies[property][i] in obj)) {
							throw new Error('JSON object' + getName(names.concat([schema.dependencies[property][i]])) + ' is required by property \'' + property + '\'');
						}
					}
					break;
				case 'object':
					// schema dependency
					validateSchema(obj, schema.dependencies[property], names.concat([ '[dependencies.'+property+']' ]));
					break;
			}
		}
	}
}

function validateNumber(obj, schema, names) {
	//console.log('***', names, 'validateNumber');

	if (schema.minimum !== undefined) {
		if (schema.exclusiveMinimum ? obj <= schema.minimum : obj < schema.minimum) {
			throwInvalidValue(names, obj, (schema.exclusiveMinimum ? 'greater than' : 'at least') + ' ' + schema.minimum);
		}
	}

	if (schema.maximum !== undefined) {
		if (schema.exclusiveMaximum ? obj >= schema.maximum : obj > schema.maximum) {
			throwInvalidValue(names, obj, (schema.exclusiveMaximum ? 'less than' : 'at most') + ' ' + schema.maximum);
		}
	}

	if (schema.divisibleBy !== undefined) {
		if (!isOfType(obj / schema.divisibleBy, 'integer')) {
			throwInvalidValue(names, obj, 'divisible by ' + schema.divisibleBy);
		}
	}
}

function validateString(obj, schema, names) {
	//console.log('***', names, 'validateString');

	if (schema.minLength !== undefined) {
		if (obj.length < schema.minLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at least ' + schema.minLength);
		}
	}

	if (schema.maxLength !== undefined) {
		if (obj.length > schema.maxLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at most ' + schema.maxLength);
		}
	}

	if (schema.pattern !== undefined) {
		if (!obj.match(RegExp(schema.pattern))) {
			throw new Error('JSON object' + getName(names) + ' does not match pattern');
		}
	}
}

function validateFormat(obj, schema, names) {
	//console.log('***', names, 'validateFormat');
	if (schema.format !== undefined) {
		var format = formats[schema.format];
		if (format !== undefined) {
			var conforms = true;
			if (format.regex) {
				conforms = obj.match(format.regex);
			} else if (format.func) {
				conforms = format.func(obj);
			}
			if (!conforms) {
				throw new Error('JSON object' + getName(names) + ' does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(obj, schema, names) {
	//console.log('***', names, 'validateItem');
	switch (getType(obj)) {
		case 'number':
		case 'integer':
			validateNumber(obj, schema, names);
			break;
		case 'string':
			validateString(obj, schema, names);
			break;
	}

	validateFormat(obj, schema, names);
}

function validateSchema(obj, schema, names) {
	//console.log('***', names, 'validateSchema');

	validateRequired(obj, schema, names);
	if (obj === undefined) {
		obj = applyDefault(obj, schema, names);
	}
	if (obj !== undefined) {
		validateType(obj, schema, names);
		validateDisallow(obj, schema, names);
		validateEnum(obj, schema, names);

		switch (getType(obj)) {
			case 'object':
				validateObject(obj, schema, names);
				break;
			case 'array':
				validateArray(obj, schema, names);
				break;
			default:
				validateItem(obj, schema, names);
		}
	}

	return obj;
}

// Two operation modes:
// * Synchronous - done callback is not provided. will return nothing or throw error
// * Asynchronous - done callback is provided. will not throw error.
//        will call callback with error as first parameter and object as second
// Schema is expected to be validated.
module.exports = function(obj, schema, done) {
	try {
		validateSchema(obj, schema, []);

		if (done) {
			done(null, obj);
		}
	} catch(err) {
		if (done) {
			done(err);
		} else {
			throw err;
		}
	}
};

},{"./common":36,"./formats":37}],40:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	validateObjectVsSchema = require('./valid-object');

function throwInvalidType(names, attribFullName, value, expected) {
	throw new Error('Schema' + getName(names) + ': ' + attribFullName + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function assertType(schema, attribName, expectedType, names) {
	if (schema[attribName] !== undefined) {
		if (!isOfType(schema[attribName], expectedType)) {
			throwInvalidType(names, '\'' + attribName + '\' attribute', schema[attribName], prettyType(expectedType));
		}
	}
}

function validateRequired(schema, names) {
	assertType(schema, 'required', 'boolean', names);
}

function validateDefault(schema, names) {
	if (schema.default !== undefined) {
		try {
			validateObjectVsSchema(schema.default, schema);
		} catch(err) {
			throw new Error('Schema' + getName(names) + ': \'default\' attribute value is not valid according to the schema: ' + err.message);
		}
	}
}

function validateType(schema, names) {
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.type.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'type\' attribute union length is ' + schema.type.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.type[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'type\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'type\' attribute union element ' + i, schema.type[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'type\' attribute', schema.type, 'either a string or an array');
		}
	}
}

function validateDisallow(schema, names) {
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.disallow.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union length is ' + schema.disallow.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.disallow[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'disallow\' attribute union element ' + i, schema.disallow[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'disallow\' attribute', schema.disallow, 'either a string or an array');
		}
	}
}

function validateEnum(schema, names) {
	assertType(schema, 'enum', 'array', names);
}

function validateArray(schema, names) {
	assertType(schema, 'minItems', 'integer', names);
	assertType(schema, 'maxItems', 'integer', names);

	if (schema.items !== undefined) {
		var i;
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				try {
					validateSchema(schema.items, []);
				} catch(err) {
					throw new Error('Schema' + getName(names) + ': \'items\' attribute is not a valid schema: ' + err.message);
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				for (i = 0; i < schema.items.length; ++i) {
					try {
						validateSchema(schema.items[i], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'items\' attribute element ' + i + ' is not a valid schema: ' + err.message);
					}
				}
				break;
			default:
				throwInvalidType(names, '\'items\' attribute', schema.items, 'either an object (schema) or an array');
		}
	}

	if (schema.additionalItems !== undefined) {
		if (schema.additionalItems === false) {
			// ok
		} else if (!isOfType(schema.additionalItems, 'object')) {
			throwInvalidType(names, '\'additionalItems\' attribute', schema.additionalItems, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalItems, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalItems\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'uniqueItems', 'boolean', names);
}

function validateObject(schema, names) {
	assertType(schema, 'properties', 'object', names);
	if (schema.properties !== undefined) {
		for (var property in schema.properties) {
			validateSchema(schema.properties[property], names.concat([property]));
		}
	}

	assertType(schema, 'patternProperties', 'object', names);
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			validateSchema(schema.patternProperties[reStr], names.concat(['patternProperties./' + reStr + '/']));
		}
	}

	if (schema.additionalProperties !== undefined) {
		if (schema.additionalProperties === false) {
			// ok
		} else if (!isOfType(schema.additionalProperties, 'object')) {
			throwInvalidType(names, '\'additionalProperties\' attribute', schema.additionalProperties, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalProperties, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalProperties\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'dependencies', 'object', names);
	if (schema.dependencies !== undefined) {
		for (var property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency - nothing to validate
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (isOfType(schema.dependencies[property][i], 'string')) {
							// simple dependency (inside array) - nothing to validate
						} else {
							throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\' element ' + i, schema.dependencies[property][i], 'a string');
						}
					}
					break;
				case 'object':
					// schema dependency
					try {
						validateSchema(schema.dependencies[property], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'dependencies\' attribute: value of property \'' + property + '\' is not a valid schema: ' + err.message);
					}
					break;
				default:
					throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\'', schema.dependencies[property], 'either a string, an array or an object (schema)');
			}
		}
	}
}

function validateNumber(schema, names) {
	assertType(schema, 'minimum', 'number', names);
	assertType(schema, 'exclusiveMinimum', 'boolean', names);
	assertType(schema, 'maximum', 'number', names);
	assertType(schema, 'exclusiveMaximum', 'boolean', names);
	assertType(schema, 'divisibleBy', 'number', names);
	if (schema.divisibleBy !== undefined) {
		if (schema.divisibleBy === 0) {
			throw new Error('Schema' + getName(names) + ': \'divisibleBy\' attribute must not be 0');
		}
	}
};

function validateString(schema, names) {
	assertType(schema, 'minLength', 'integer', names);
	assertType(schema, 'maxLength', 'integer', names);
	assertType(schema, 'pattern', 'string', names);
}

function validateFormat(schema, names) {
	assertType(schema, 'format', 'string', names);

	if (schema.format !== undefined) {
		if (schema.format in formats) {
			if (formats[schema.format].types.indexOf(schema.type) === -1) {
				throw new Error('Schema' + getName(names) + ': \'type\' attribute does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(schema, names) {
	validateNumber(schema, names);
	validateString(schema, names);
	validateFormat(schema, names);
}

function validateSchema(schema, names) {
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema' + getName(names) + ' is ' + prettyType(getType(schema)) + ' when it should be an object');
	}
	validateRequired(schema, names);
	validateType(schema, names);
	validateDisallow(schema, names);
	validateEnum(schema, names);
	validateObject(schema, names);
	validateArray(schema, names);
	validateItem(schema, names);
	// defaults are applied last after schema is validated
	validateDefault(schema, names);
}

module.exports = function(schema) {
	if (schema === undefined) {
		throw new Error('Schema is undefined');
	}

	// validate schema parameters for object root
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema is ' + prettyType(getType(schema)) + ' when it should be an object');
	}

	validateSchema(schema, []);
};

},{"./common":36,"./formats":37,"./valid-object":39}],41:[function(require,module,exports){
(function (global){

var rng;

if (global.crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],42:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":41}],43:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Map",
  "collectionName": "flows",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "type": {
      "type":"string",
      "required": true
    },
    "env": {
      "type":"string",
      "required": false
    },
    "ns": {
      "type":"string",
      "required": false
    },
    "name": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string"
    },
    "provider": {
      "type":"string"
    },
    "providers": {
      "type":"object"
    },
    "keywords": {
      "type":"array"
    },
    "ports": {
      "type":"object",
      "properties": {
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        }
      }
    },
    "nodes": {
      "type":"array",
      "title":"Nodes",
      "required": true,
      "items": {
        "type": "object",
        "title": "Node",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": false,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "target": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}

},{}],44:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Nodes",
  "properties":{
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string",
      "required": false
    },
    "_id": {
      "type":"string"
    },
    "name": {
      "type":"string",
      "required": true
    },
    "ns": {
      "type":"string",
      "required": true
    },
    "phrases": {
      "type":"object"
    },
    "env": {
      "type":"string",
      "enum": ["server","browser","polymer","phonegap"]
    },
    "async": {
      "type":"boolean",
      "required": false
    },
    "dependencies": {
      "type":"object",
      "required": false
    },
    "provider": {
      "required": false,
      "type":"string"
    },
    "providers": {
      "required": false,
      "type":"object"
    },
    "expose": {
      "type":"array",
      "required": false
    },
    "fn": {
      "type":"string",
      "required": false
    },
    "ports": {
      "type":"object",
      "required": true,
      "properties":{
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        },
        "event": {
          "type":"object"
        }
      }
    },
    "type": {
      "enum":["node","flow","provider","data","polymer"],
      "required": false
    }
  },
  "additionalProperties": false
}

},{}],45:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Stage",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "env": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": true
    },
    "description": {
      "type":"string",
      "required": true
    },
    "actors": {
      "type":"array",
      "title":"Actors",
      "required": true,
      "items": {
        "type": "object",
        "title": "Actor",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": true,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"string",
            "required": true
          },
          "target": {
            "type":"string",
            "required": true
          },
          "out": {
            "type":"string",
            "required": false
          },
          "in": {
            "type":"string",
            "required": false
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  }
}

},{}],46:[function(require,module,exports){
'use strict';

/**
 *
 * Ok, this should be a general listener interface.
 *
 * One who will use it is the Actor.
 * But I want to be able to do the same for e.g. Loader.
 *
 * They will all be in chix-monitor-*
 *
 * npmlog =  Listener(instance, options);
 *
 * The return is just in case you want to do other stuff.
 *
 * e.g. fbpx wants to add this to npmlog:
 *
 * Logger.level = program.verbose ? 'verbose' : program.debug;
 *
 */
// function NpmLogActorMonitor(actor, opts) {
module.exports = function NpmLogActorMonitor(Logger, actor) {

   // TODO: just make an NpmLogIOMonitor.
   var ioHandler = actor.ioHandler;

   actor.on('removeLink', function(event) {
     Logger.debug(
       event.node ? event.node.identifier : 'Some Actor',
       'removed link'
     );
   });

   // Ok emiting each and every output I don't like for the IOHandler.
   // but whatever can change it later.
   ioHandler.on('output', function(data) {

     // I don't like this data.out.port thing vs data.port
     switch(data.port) {

        case ':plug':
         Logger.debug(
           data.node.identifier,
           'port %s plugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':unplug':
         Logger.debug(
           data.node.identifier,
           'port %s unplugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':portFill':
         Logger.info(
           data.node.identifier,
           'port %s filled with data',
           data.out.read().port);
        break;

        case ':contextUpdate':
         Logger.info(
           data.node.identifier,
           'port %s filled with context',
           data.out.read().port);
        break;

        case ':inputValidated':
          Logger.debug(data.node.identifier, 'input validated');
        break;

        case ':start':
          Logger.info(data.node.identifier, 'START');
        break;

        case ':freePort':
          Logger.debug(data.node.identifier, 'free port %s', data.out.read().port);
        break;

/*
       case ':queue':
         Logger.debug(
           data.node,
           'queue: %s',
           data.port
         );
       break;
*/

       case ':openPort':
         Logger.info(
           data.node.identifier,
           'opened port %s (%d)',
           data.out.read().port,
           data.out.read().connections
           );
       break;

       case ':closePort':
         Logger.info(
           data.node.identifier,
           'closed port %s',
           data.out.read().port
           );
       break;

       case ':index':
         Logger.info(
           data.node.identifier,
           '[%s] set on port `%s`',
           data.out.read().index,
           data.out.read().port
           );
       break;

       case ':nodeComplete':
         // console.log('nodeComplete', data);
         Logger.info(data.node.identifier, 'completed');
       break;

       case ':portReject':
         Logger.debug(
           data.node.identifier,
           'rejected input on port %s',
           data.out.read().port
         );
       break;

       case ':inputRequired':
         Logger.error(
           data.node.identifier,
           'input required on port %s',
           data.out.read().port);
       break;

       case ':error':
         Logger.error(
           data.node.identifier,
           data.out.read().msg
         );
       break;

       case ':nodeTimeout':
         Logger.error(
           data.node.identifier,
           'node timeout'
         );
       break;

       case ':executed':
         Logger.info(
           data.node.identifier,
           'EXECUTED'
         );
       break;

       case ':inputTimeout':
         Logger.info(
           data.node.identifier,
           'input timeout, got %s need %s',
           Object.keys(data.node.input).join(', '),
           data.node.openPorts.join(', '));
       break;

       default:
         // TODO: if the above misses a system port it will be reported
         //       as default normal output.
         Logger.info(data.node.identifier, 'output on port %s', data.port);
       break;

     }

   });

   return Logger;

};

},{}],47:[function(require,module,exports){
'use strict';

/**
 *
 * NpmLog monitor for the Loader
 *
 */
module.exports = function NpmLogLoaderMonitor(Logger, loader) {

  loader.on('loadUrl', function(data) {
    Logger.info( 'loadUrl', data.url);
  });

  loader.on('loadFile', function(data) {
    Logger.info( 'loadFile', data.path);
  });

  loader.on('loadCache', function(data) {
    Logger.debug( 'cache', 'loaded cache file %s', data.file);
  });

  loader.on('purgeCache', function(data) {
    Logger.debug( 'cache', 'purged cache file %s', data.file);
  });

  loader.on('writeCache', function(data) {
    Logger.debug( 'cache', 'wrote cache file %s', data.file);
  });

  return Logger;

};

},{}],"chix-monitor-npmlog":[function(require,module,exports){
module.exports=require('HNG52E');
},{}],"HNG52E":[function(require,module,exports){
exports.Actor = require('./lib/actor');
exports.Loader = require('./lib/loader');

},{"./lib/actor":46,"./lib/loader":47}],"dot-object":[function(require,module,exports){
module.exports=require('C/EKgi');
},{}],"C/EKgi":[function(require,module,exports){
'use strict';

function DotObject(seperator, override) {

  if (!(this instanceof DotObject)) {
    return new DotObject(seperator, override);
  }

  if (typeof seperator === 'undefined') { seperator = '.'; }
  if (typeof override === 'undefined') { override = false; }
  this.seperator = seperator;
  this.override = override;
}

DotObject.prototype._fill = function(a, obj, v, mod) {
  var k = a.shift();

  if (a.length > 0) {
    obj[k] = obj[k] || {};

    if (obj[k] !== Object(obj[k])) {
      if (this.override) {
        obj[k] = {};
      } else {
        throw new Error(
          'Trying to redefine `' + k + '` which is a ' + typeof obj[k]
        );
      }
    }

    this._fill(a, obj[k], v, mod);
  } else {
    if (obj[k] === Object(obj[k]) && Object.keys(obj[k]).length) {
      throw new Error('Trying to redefine non-empty obj[\'' + k + '\']');
    }

    obj[k] = this.process(v, mod);
  }
};

DotObject.prototype.process = function(v, mod) {
  var i;

  if (typeof mod === 'function') {
    v = mod(v);
  } else if (mod instanceof Array) {
    for (i = 0; i < mod.length; i++) {
      v = mod[i](v);
    }
  }

  return v;
};

DotObject.prototype.object = function(obj, mods) {
  var self = this;

  Object.keys(obj).forEach(function(k) {
    var mod = mods === undefined ? null : mods[k];

    if (k.indexOf(self.seperator) !== -1) {
      self._fill(k.split(self.seperator), obj, obj[k], mod);
      delete obj[k];
    } else if (self.override) {
      obj[k] = self.process(obj[k], mod);
    }
  });
};

/**
 *
 * @param {String} str
 * @param {String} v
 * @param {Object} obj
 * @param {Function|Array} mod
 *
 */
DotObject.prototype.str = function(str, v, obj, mod) {
  if (str.indexOf(this.seperator) !== -1) {
    this._fill(str.split(this.seperator), obj, v, mod);
  } else if (this.override) {
    obj[str] = this.process(v, mod);
  }
};

/**
 *
 * Pick a value from an object using dot notation.
 *
 * Optionally remove the value
 *
 * @param {String} path
 * @param {Object} obj
 * @param {Boolean} remove
 */
DotObject.prototype.pick = function(path, obj, remove) {
  var i;
  var keys;
  var val;

  if (path.indexOf(this.seperator) !== -1) {
    keys = path.split(this.seperator);
    for (i = 0; i < keys.length; i++) {
      if (obj.hasOwnProperty(keys[i])) {
        if (i === (keys.length - 1)) {
          if (remove) {
            val = obj[keys[i]];
            delete obj[keys[i]];
            return val;
          } else {
            return obj[keys[i]];
          }
        } else {
          obj = obj[keys[i]];
        }
      } else {
        return undefined;
      }
    }
    return obj;
  } else {
    if (remove) {
      val = obj[path];
      delete obj[path];
      return val;
    } else {
      return obj[path];
    }
  }
};

/**
 *
 * Move a property from one place to the other.
 *
 * If the source path does not exist (undefined)
 * the target property will not be set.
 *
 * @param {String} source
 * @param {String} target
 * @param {Object} obj
 * @param {Boolean} merge
 *
 */
DotObject.prototype.move = function(source, target, obj, merge) {

  this.set(target, this.pick(source, obj, true), obj, merge);

  return obj;

};

/**
 *
 * Transfer a property from one object to another object.
 *
 * If the source path does not exist (undefined)
 * the property on the other object will not be set.
 *
 * @param {String} source
 * @param {String} target
 * @param {Object} obj1
 * @param {Object} obj2
 * @param {Boolean} merge
 */
DotObject.prototype.transfer = function(source, target, obj1, obj2, merge) {

  this.set(target, this.pick(source, obj1, true), obj2, merge);

  return obj2;

};

/**
 *
 * Copy a property from one object to another object.
 *
 * If the source path does not exist (undefined)
 * the property on the other object will not be set.
 *
 * @param {String} source
 * @param {String} target
 * @param {Object} obj1
 * @param {Object} obj2
 * @param {Boolean} merge
 */
DotObject.prototype.copy = function(source, target, obj1, obj2, merge) {

  this.set(target, this.pick(source, obj1, false), obj2, merge);

  return obj2;

};

function isObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

/**
 *
 * Set a property on an object using dot notation.
 *
 * @param {String} path
 * @param {Mixed} val
 * @param {Object} obj
 * @param {Boolean} merge
 */
DotObject.prototype.set = function(path, val, obj, merge) {
  var i;
  var k;
  var keys;

  // Do not operate if the value is undefined.
  if (typeof val === 'undefined') {
    return obj;
  }

  if (path.indexOf(this.seperator) !== -1) {
    keys = path.split(this.seperator);
    for (i = 0; i < keys.length; i++) {
      if (i === (keys.length - 1)) {
        if (merge && isObject(val) && isObject(obj[keys[i]])) {
          for (k in val) {
            if (val.hasOwnProperty(k)) {
              obj[keys[i]][k] = val[k];
            }
          }

        } else if (Array.isArray(obj[keys[i]]) && Array.isArray(val)) {
          for (var j = 0; j < val.length; j++) {
            obj[keys[i]].push(val[j]);
          }
        } else {
          obj[keys[i]] = val;
        }
      } else if (
        // force the value to be an object
        !obj.hasOwnProperty(keys[i]) ||
        !isObject(obj[keys[i]])) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    return obj;
  } else {
    if (merge && isObject(val)) {
      for (k in val) {
        if (val.hasOwnProperty(k)) {
          obj[path][k] = val[k];
        }
      }
    } else if (Array.isArray(obj[path]) && Array.isArray(val)) {
      obj[path].push(val);
    } else {
      obj[path] = val;
    }
    return obj;
  }
};

module.exports = DotObject;

},{}],"websocket":[function(require,module,exports){
module.exports=require('zPp5gi');
},{}],"zPp5gi":[function(require,module,exports){
var _global = (function() { return this; })();
var nativeWebSocket = _global.WebSocket || _global.MozWebSocket;


/**
 * Expose a W3C WebSocket class with just one or two arguments.
 */
function W3CWebSocket(uri, protocols) {
	var instance;

	if (protocols) {
		instance = new nativeWebSocket(uri, protocols);
	}
	else {
		instance = new nativeWebSocket(uri);
	}

	return instance;
}

if (nativeWebSocket) {
	W3CWebSocket.prototype = nativeWebSocket.prototype;
}


/**
 * Module exports.
 */
module.exports = {
    'w3cwebsocket' : nativeWebSocket ? W3CWebSocket : null,
    'version'      : require('./version')
};

},{"./version":54}],54:[function(require,module,exports){
module.exports = require('../package.json').version;

},{"../package.json":55}],55:[function(require,module,exports){
module.exports={
  "name": "websocket",
  "description": "Websocket Client & Server Library implementing the WebSocket protocol as specified in RFC 6455.",
  "keywords": [
    "websocket",
    "websockets",
    "socket",
    "networking",
    "comet",
    "push",
    "RFC-6455",
    "realtime",
    "server",
    "client"
  ],
  "author": {
    "name": "Brian McKelvey",
    "email": "brian@worlize.com",
    "url": "https://www.worlize.com/"
  },
  "version": "1.0.14",
  "repository": {
    "type": "git",
    "url": "https://github.com/theturtle32/WebSocket-Node.git"
  },
  "homepage": "https://github.com/theturtle32/WebSocket-Node",
  "engines": {
    "node": ">=0.8.0"
  },
  "dependencies": {
    "debug": "~2.1.0",
    "nan": "~1.0.0",
    "typedarray-to-buffer": "~3.0.0"
  },
  "devDependencies": {
    "faucet": "0.0.1",
    "gulp": "git+https://github.com/gulpjs/gulp.git#4.0",
    "gulp-jshint": "^1.9.0",
    "jshint-stylish": "^1.0.0",
    "tape": "^3.0.0"
  },
  "config": {
    "verbose": false
  },
  "scripts": {
    "install": "(node-gyp rebuild 2> builderror.log) || (exit 0)",
    "test": "faucet test/unit",
    "gulp": "gulp"
  },
  "main": "index",
  "directories": {
    "lib": "./lib"
  },
  "browser": "lib/browser.js",
  "readme": "WebSocket Client & Server Implementation for Node\n=================================================\n\n[![npm version](https://badge.fury.io/js/websocket.svg)](http://badge.fury.io/js/websocket)\n\n[![NPM](https://nodei.co/npm/websocket.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/websocket/)\n\n[![NPM](https://nodei.co/npm-dl/websocket.png?height=3)](https://nodei.co/npm/websocket/)\n\nOverview\n--------\nThis is a (mostly) pure JavaScript implementation of the WebSocket protocol versions 8 and 13 for Node.  There are some example client and server applications that implement various interoperability testing protocols in the \"test/scripts\" folder.\n\nFor a WebSocket client written in ActionScript 3, see my [AS3WebScocket](https://github.com/theturtle32/AS3WebSocket) project.\n\n\nDocumentation\n=============\n\n[You can read the full API documentation in the docs folder.](docs/index.md)\n\n\nChangelog\n---------\n\n***Current Version: 1.0.14*** — Released 2014-12-03\n\n***Version 1.0.14***\n\n* Resolves [issue #173](https://github.com/theturtle32/WebSocket-Node/issues/173) - To allow the W3CWebSocket interface to accept an optional non-standard configuration object as its third parameter, which will be ignored when running in a browser context.\n\n\n***Version 1.0.13***\n\n* Fixes [issue #171](https://github.com/theturtle32/WebSocket-Node/issues/171) - Code to prevent calling req.accept/req.reject multiple times breaks sanity checks in req.accept\n\n\n***Version 1.0.12***\n\n* Fixes [issue #170](https://github.com/theturtle32/WebSocket-Node/issues/170) - Non-native XOR implementation broken after making JSHint happy\n\n\n***Version 1.0.11***\n\n* Fixes some undefined behavior surrounding closing WebSocket connections and more reliably handles edge cases.\n* Adds an implementation of the W3C WebSocket API for browsers to facilitate sharing code between client and server via browserify. (Thanks, [@ibc](https://github.com/ibc)!)\n* `WebSocketConnection.prototype.close` now accepts optional `reasonCode` and `description` parameters.\n* Calling `accept` or `reject` more than once on a `WebSocketRequest` instance will now throw an error.  [Issue #149](https://github.com/theturtle32/WebSocket-Node/issues/149)\n* Handling connections dropped by client before accepted by server [Issue #167](https://github.com/theturtle32/WebSocket-Node/issues/167)\n* Integrating Gulp and JSHint (Thanks, [@ibc](https://github.com/ibc)!)\n* Starting to add individual unit tests (using substack's [tape](github.com/substack/tape) and [faucet](github.com/substack/faucet))\n\n[View the full changelog](CHANGELOG.md)\n\nBrowser Support\n---------------\n\nAll current browsers are fully supported.\n\n* Firefox 7-9 (Old) (Protocol Version 8)\n* Firefox 10+ (Protocol Version 13)\n* Chrome 14,15 (Old) (Protocol Version 8)\n* Chrome 16+ (Protocol Version 13)\n* Internet Explorer 10+ (Protocol Version 13)\n* Safari 6+ (Protocol Version 13)\n\n***Safari older than 6.0 is not supported since it uses a very old draft of WebSockets***\n\n***If you need to simultaneously support legacy browser versions that had implemented draft-75/draft-76/draft-00, take a look here: https://gist.github.com/1428579***\n\nBenchmarks\n----------\nThere are some basic benchmarking sections in the Autobahn test suite.  I've put up a [benchmark page](http://theturtle32.github.com/WebSocket-Node/benchmarks/) that shows the results from the Autobahn tests run against AutobahnServer 0.4.10, WebSocket-Node 1.0.2, WebSocket-Node 1.0.4, and ws 0.3.4.\n\nAutobahn Tests\n--------------\nThe very complete [Autobahn Test Suite](http://autobahn.ws/testsuite/) is used by most WebSocket implementations to test spec compliance and interoperability.\n\n- [View Server Test Results](http://theturtle32.github.com/WebSocket-Node/test-report/servers/)\n- [View Client Test Results](http://theturtle32.github.com/WebSocket-Node/test-report/clients/)\n\nNotes\n-----\nThis library has been used in production on [worlize.com](https://www.worlize.com) since April 2011 and seems to be stable.  Your mileage may vary.\n\n**Tested with the following node versions:**\n\n- 0.8.28\n- 0.10.33\n\nIt may work in earlier or later versions but I'm not actively testing it outside of the listed versions.  YMMV.\n\nInstallation\n------------\n\nA few users have reported difficulties building the native extensions without first manually installing node-gyp.  If you have trouble building the native extensions, make sure you've got a C++ compiler, and have done `npm install -g node-gyp` first. \n\nNative extensions are optional, however, and WebSocket-Node will work even if the extensions cannot be compiled.\n\nIn your project root:\n\n    $ npm install websocket\n  \nThen in your code:\n\n```javascript\nvar WebSocketServer = require('websocket').server;\nvar WebSocketClient = require('websocket').client;\nvar WebSocketFrame  = require('websocket').frame;\nvar WebSocketRouter = require('websocket').router;\nvar W3CWebSocket = require('websocket').w3cwebsocket;\n```\n\nNote for Windows Users\n----------------------\nBecause there is a small C++ component used for validating UTF-8 data, you will need to install a few other software packages in addition to Node to be able to build this module:\n\n- [Microsoft Visual C++](http://www.microsoft.com/visualstudio/en-us/products/2010-editions/visual-cpp-express)\n- [Python 2.7](http://www.python.org/download/) (NOT Python 3.x)\n\n\nCurrent Features:\n-----------------\n- Licensed under the Apache License, Version 2.0\n- Protocol version \"8\" and \"13\" (Draft-08 through the final RFC) framing and handshake\n- Can handle/aggregate received fragmented messages\n- Can fragment outgoing messages\n- Router to mount multiple applications to various path and protocol combinations\n- TLS supported for outbound connections via WebSocketClient\n- TLS supported for server connections (use https.createServer instead of http.createServer)\n  - Thanks to [pors](https://github.com/pors) for confirming this!\n- Cookie setting and parsing\n- Tunable settings\n  - Max Receivable Frame Size\n  - Max Aggregate ReceivedMessage Size\n  - Whether to fragment outgoing messages\n  - Fragmentation chunk size for outgoing messages\n  - Whether to automatically send ping frames for the purposes of keepalive\n  - Keep-alive ping interval\n  - Whether or not to automatically assemble received fragments (allows application to handle individual fragments directly)\n  - How long to wait after sending a close frame for acknowledgment before closing the socket.\n- [W3C WebSocket API](http://www.w3.org/TR/websockets/) for applications running on both Node and browsers (via the `W3CWebSocket` class). \n\n\nKnown Issues/Missing Features:\n------------------------------\n- No API for user-provided protocol extensions.\n\n\nUsage Examples\n==============\n\nServer Example\n--------------\n\nHere's a short example showing a server that echos back anything sent to it, whether utf-8 or binary.\n\n```javascript\n#!/usr/bin/env node\nvar WebSocketServer = require('websocket').server;\nvar http = require('http');\n\nvar server = http.createServer(function(request, response) {\n    console.log((new Date()) + ' Received request for ' + request.url);\n    response.writeHead(404);\n    response.end();\n});\nserver.listen(8080, function() {\n    console.log((new Date()) + ' Server is listening on port 8080');\n});\n\nwsServer = new WebSocketServer({\n    httpServer: server,\n    // You should not use autoAcceptConnections for production\n    // applications, as it defeats all standard cross-origin protection\n    // facilities built into the protocol and the browser.  You should\n    // *always* verify the connection's origin and decide whether or not\n    // to accept it.\n    autoAcceptConnections: false\n});\n\nfunction originIsAllowed(origin) {\n  // put logic here to detect whether the specified origin is allowed.\n  return true;\n}\n\nwsServer.on('request', function(request) {\n    if (!originIsAllowed(request.origin)) {\n      // Make sure we only accept requests from an allowed origin\n      request.reject();\n      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');\n      return;\n    }\n    \n    var connection = request.accept('echo-protocol', request.origin);\n    console.log((new Date()) + ' Connection accepted.');\n    connection.on('message', function(message) {\n        if (message.type === 'utf8') {\n            console.log('Received Message: ' + message.utf8Data);\n            connection.sendUTF(message.utf8Data);\n        }\n        else if (message.type === 'binary') {\n            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');\n            connection.sendBytes(message.binaryData);\n        }\n    });\n    connection.on('close', function(reasonCode, description) {\n        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');\n    });\n});\n```\n\nClient Example\n--------------\n\nThis is a simple example client that will print out any utf-8 messages it receives on the console, and periodically sends a random number.\n\n*This code demonstrates a client in Node.js, not in the browser*\n\n```javascript\n#!/usr/bin/env node\nvar WebSocketClient = require('websocket').client;\n\nvar client = new WebSocketClient();\n\nclient.on('connectFailed', function(error) {\n    console.log('Connect Error: ' + error.toString());\n});\n\nclient.on('connect', function(connection) {\n    console.log('WebSocket Client Connected');\n    connection.on('error', function(error) {\n        console.log(\"Connection Error: \" + error.toString());\n    });\n    connection.on('close', function() {\n        console.log('echo-protocol Connection Closed');\n    });\n    connection.on('message', function(message) {\n        if (message.type === 'utf8') {\n            console.log(\"Received: '\" + message.utf8Data + \"'\");\n        }\n    });\n    \n    function sendNumber() {\n        if (connection.connected) {\n            var number = Math.round(Math.random() * 0xFFFFFF);\n            connection.sendUTF(number.toString());\n            setTimeout(sendNumber, 1000);\n        }\n    }\n    sendNumber();\n});\n\nclient.connect('ws://localhost:8080/', 'echo-protocol');\n```\n\nClient Example using the *W3C WebSocket API*\n--------------------------------------------\n\nSame example as above but using the [W3C WebSocket API](http://www.w3.org/TR/websockets/).\n\n```javascript\nvar W3CWebSocket = require('websocket').w3cwebsocket;\n\nvar client = new W3CWebSocket('ws://localhost:8080/', 'echo-protocol');\n\nclient.onerror = function() {\n    console.log('Connection Error');\n};\n\nclient.onopen = function() {\n    console.log('WebSocket Client Connected');\n\n    function sendNumber() {\n        if (client.readyState === client.OPEN) {\n            var number = Math.round(Math.random() * 0xFFFFFF);\n            client.send(number.toString());\n            setTimeout(sendNumber, 1000);\n        }\n    }\n    sendNumber();\n};\n\nclient.onclose = function() {\n    console.log('echo-protocol Client Closed');\n};\n\nclient.onmessage = function(e) {\n    if (typeof e.data === 'string') {\n        console.log(\"Received: '\" + e.data + \"'\");\n    }\n};\n```\n    \nRequest Router Example\n----------------------\n\nFor an example of using the request router, see `libwebsockets-test-server.js` in the `test` folder.\n\n\nResources\n---------\n\nA presentation on the state of the WebSockets protocol that I gave on July 23, 2011 at the LA Hacker News meetup.  [WebSockets: The Real-Time Web, Delivered](http://www.scribd.com/doc/60898569/WebSockets-The-Real-Time-Web-Delivered)\n",
  "readmeFilename": "README.md",
  "bugs": {
    "url": "https://github.com/theturtle32/WebSocket-Node/issues"
  },
  "_id": "websocket@1.0.14",
  "_from": "websocket@*"
}

},{}],"0NvpFQ":[function(require,module,exports){
var Loader = function() {

  // will be replaced with the json.
  this.dependencies = {"npm":{"websocket":"1.x.x","dot-object":"0.x.x"}};
  //this.nodes = ;
  this.nodeDefinitions = {"https://serve-chix.rhcloud.com/nodes/{ns}/{name}":{"websocket":{"client":{"_id":"533eef893c8d3cd858002db4","name":"client","ns":"websocket","description":"Websocket Client","async":true,"phrases":{"active":"Creating websocket client"},"ports":{"input":{"url":{"type":"string","title":"Url","async":true},"protocol":{"title":"Protocol","type":"string","default":null},"send":{"title":"Send","type":"any","async":true}},"output":{"client":{"type":"WebSocket","title":"WebSocket"},"open":{"type":"any","title":"Open"},"close":{"type":"any","title":"Close"},"message":{"type":"any","title":"Message"},"error":{"type":"Object","title":"Error"}}},"dependencies":{"npm":{"websocket":"1.x.x"}},"fn":"on.input.url = function() {\n\n  state.client = null;\n\n  if(input.protocol) {\n    state.client = new websocket.w3cwebsocket(input.url, input.protocol);\n  } else {\n    state.client = new websocket.w3cwebsocket(input.url);\n  }\n\n  state.client.onmessage = function(event) {\n    output({ message: JSON.parse(event.data) });\n  };\n\n  state.client.onerror = function(event) {\n    output({ error: event });\n  };\n\n  state.client.onclose = function(event) {\n    output({ close: event });\n  };\n\n  state.client.onopen = function(event) {\n    output({\n      client: state.client,\n      open: event\n    });\n  };\n\n};\n\non.input.send = function(data) {\n console.log(state.client.readyState, state.client.OPEN); if(state.client && state.client.readyState === state.client.OPEN) {\n    state.client.send(JSON.stringify(data));\n  } else {\n    // should revoke input && re-queue\n    return false;\n  }\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"console":{"log":{"_id":"52645993df5da0102500004e","name":"log","ns":"console","description":"Console log","async":true,"phrases":{"active":"Logging to console"},"ports":{"input":{"msg":{"type":"any","title":"Log message","description":"Logs a message to the console","async":true,"required":true}},"output":{"out":{"type":"any","title":"Log message"}}},"fn":"on.input.msg = function() {\n  console.log(data);\n  output( { out: data });\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"error":{"_id":"5491085d0e9c46154a015c8e","name":"error","ns":"console","description":"Console Error","async":true,"phrases":{"active":"Logging error to console"},"ports":{"input":{"msg":{"type":"any","title":"Log message","description":"Logs an error message to the console","async":true,"required":true}},"output":{"out":{"type":"any","title":"Log message"}}},"fn":"on.input.msg = function() {\n  console.error(data);\n  output( { out: data });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"dom":{"querySelector":{"_id":"527299bb30b8af4b8910216b","name":"querySelector","ns":"dom","title":"querySelector","description":"[Document query selector](https://developer.mozilla.org/en-US/docs/Web/API/document.querySelector)","expose":["document"],"phrases":{"active":"Gathering elements matching criteria: {{input.selector}}"},"ports":{"input":{"element":{"title":"Element","type":"HTMLElement","default":null},"selector":{"title":"Selector","type":"string"}},"output":{"element":{"title":"Element","type":"HTMLElement"},"selection":{"title":"Selection","type":"HTMLElement"},"error":{"title":"Error","type":"Error"}}},"fn":"var el = input.element ? input.element : document;\noutput = {\n  element: el\n};\n\nvar selection = el.querySelector(input.selector);\nif(selection) {\n  output.selection = selection;\n} else {\n  output.error = Error('Selector ' + input.selector + ' did not match');\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"object":{"router":{"_id":"5491419d0e9c46154a015c8f","name":"router","ns":"object","description":"Route packets based on a path, input index will result in same index on output","async":true,"dependencies":{"npm":{"dot-object":"0.x.x"}},"phrases":{"active":"Routing"},"ports":{"input":{"in":{"title":"Input Object","type":"object","async":true},"route":{"title":"Routes","type":"array"}},"output":{"out":{"title":"Route","type":"array","async":true}}},"fn":"on.input.in = function(data) {\n\n  var out = [];\n  for(var i = 0; i < input.route.length; i++) {\n    var res = dot_object().pick(input.route[i], data);\n    // err.. does pick remove the value?\n    if(undefined !== res) {\n      out[i] = data; // send out the data, not the actual picked value.\n      output({out: out});\n      break;\n    }\n  }\n  // maybe send to error port if no matches.\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"set":{"_id":"52ef3631cf8e1bab142d5399","name":"set","ns":"object","async":true,"description":"Set a property on an object, or else create a new object and set the property","phrases":{"active":"Setting property {{input.key}}"},"dependencies":{"npm":{"dot-object":"0.x.x"}},"ports":{"input":{"in":{"title":"Value","type":"any","async":true},"path":{"title":"Path","type":"string"},"object":{"title":"Object","type":"object","default":null}},"output":{"out":{"title":"out","type":"object"}}},"fn":"on.input.in = function(data) {\n  var obj = input.object ? input.object : {};\n  dot_object().set(input.path, data, obj);\n  output({out: obj});\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"data":{"pick":{"_id":"527d857e83f0adcc47800e7c","name":"pick","ns":"data","title":"Pick","async":true,"description":"Pick one value from an object","phrases":{"active":"Picking {{input.path}} from object"},"ports":{"input":{"in":{"title":"Object","description":"An Object, e.g { name: { first: 'John', last: 'Doe' } }","type":"object","async":true},"path":{"title":"Path","description":"Specify a path with . syntax (e.g. name.last )","type":"string","required":true}},"output":{"out":{"title":"Output","type":"any"},"error":{"title":"Error","type":"Error"}}},"dependencies":{"npm":{"dot-object":"0.x.x"}},"fn":"on.input.in = function(data) {\n  // dot_object api should be fixed..\n  var res = dot_object().pick(input.path, data);\n  if(typeof res !== 'undefined') {\n    output({out: res});\n  } else {\n    output({error: Error(input.path + ' not found')});\n  }\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}}};

};

Loader.prototype.hasNodeDefinition = function(nodeId) {

  return !!this.nodes[nodeId];

};

Loader.prototype.getNodeDefinition = function(node) {

  if (!this.nodeDefinitions[node.provider]) {
    throw new Error('Node Provider not found for ' + node.name);
  }

  return this.nodeDefinitions[node.provider][node.ns][node.name];

};

var Flow = require('chix-flow').Flow;
var loader = new Loader();

var map = {"id":"78d3d429-38f5-4aa6-807e-359a28cbb614","type":"flow","links":[{"source":{"id":"WsClient","port":"message"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"WsClient message -> msg Log"}},{"source":{"id":"WsClient","port":"open"},"target":{"id":"OpenMsg","port":"msg"},"metadata":{"title":"WsClient open -> msg OpenMsg"}},{"source":{"id":"WsClient","port":"close"},"target":{"id":"CloseMsg","port":"msg"},"metadata":{"title":"WsClient close -> msg CloseMsg"}},{"source":{"id":"WsClient","port":"error"},"target":{"id":"ErrorLog","port":"msg"},"metadata":{"title":"WsClient error -> msg ErrorLog"}},{"source":{"id":"WsClient","port":"message"},"target":{"id":"Router","port":"in"},"metadata":{"title":"WsClient message -> in Router"}},{"source":{"id":"Router","port":"out","setting":{"index":0}},"target":{"id":"getGraph","port":"in"},"metadata":{"title":"Router out -> in getGraph"}},{"source":{"id":"getGraph","port":"out"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"getGraph out -> msg Log"}},{"source":{"id":"getGraph","port":"out"},"target":{"id":"Subscribe","port":"in"},"metadata":{"title":"getGraph out -> in Subscribe"}},{"source":{"id":"Subscribe","port":"out"},"target":{"id":"WsClient","port":"send"},"metadata":{"title":"Subscribe out -> send WsClient"}}],"nodes":[{"id":"WsClient","title":"WsClient","ns":"websocket","name":"client"},{"id":"Log","title":"Log","ns":"console","name":"log"},{"id":"ErrorLog","title":"ErrorLog","ns":"console","name":"error"},{"id":"BodyEl","title":"BodyEl","ns":"dom","name":"querySelector"},{"id":"OpenMsg","title":"OpenMsg","ns":"console","name":"log","context":{"msg":"Connected to websocket"}},{"id":"CloseMsg","title":"CloseMsg","ns":"console","name":"log","context":{"msg":"Disonnected from websocket"}},{"id":"Router","title":"Router","ns":"object","name":"router"},{"id":"getGraph","title":"getGraph","ns":"data","name":"pick","context":{"path":"payload.graph"}},{"id":"Subscribe","title":"Subscribe","ns":"object","name":"set","context":{"object":{"protocol":"graph","command":"subscribe"},"path":"payload.graph"}}],"title":"Dagre D3 Graph","providers":{"@":{"url":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}};

var actor;
window.Actor = actor = Flow.create(map, loader);

var monitor = require('chix-monitor-npmlog').Actor;
monitor(console, actor);

function onDeviceReady() {
actor.run();
actor.push();
actor.sendIIPs([{"source":{"id":"78d3d429-38f5-4aa6-807e-359a28cbb614","port":":iip"},"target":{"id":"BodyEl","port":"selector"},"metadata":{"title":"Dagre D3 Graph :iip -> selector BodyEl"},"data":"body"},{"source":{"id":"78d3d429-38f5-4aa6-807e-359a28cbb614","port":":iip"},"target":{"id":"WsClient","port":"url"},"metadata":{"title":"Dagre D3 Graph :iip -> url WsClient"},"data":"ws://localhost:9000/"},{"source":{"id":"78d3d429-38f5-4aa6-807e-359a28cbb614","port":":iip"},"target":{"id":"WsClient","port":"protocol"},"metadata":{"title":"Dagre D3 Graph :iip -> protocol WsClient"},"data":"noflo"},{"source":{"id":"78d3d429-38f5-4aa6-807e-359a28cbb614","port":":iip"},"target":{"id":"WsClient","port":"send"},"metadata":{"title":"Dagre D3 Graph :iip -> send WsClient"},"data":{"protocol":"runtime","command":"getruntime","payload":{}}},{"source":{"id":"78d3d429-38f5-4aa6-807e-359a28cbb614","port":":iip"},"target":{"id":"Router","port":"route","setting":{"index":0}},"metadata":{"title":"Dagre D3 Graph :iip -> route Router"},"data":["command","runtime"]}]);

};

if (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/)) {
  document.addEventListener("deviceready", onDeviceReady, false);
} else {
  document.addEventListener("DOMContentLoaded" , onDeviceReady); //this is the browser
}

// for entry it doesn't really matter what is the module.
// as long as this module is loaded.
module.exports = actor;

},{"chix-flow":"jXAsbI","chix-monitor-npmlog":"HNG52E"}],"live":[function(require,module,exports){
module.exports=require('0NvpFQ');
},{}]},{},["0NvpFQ"])