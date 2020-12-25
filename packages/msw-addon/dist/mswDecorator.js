"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initializeWorker = initializeWorker;
exports.mswDecorator = void 0;

var _addons = require("@storybook/addons");

var _msw = require("msw");

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var worker;

function initializeWorker() {
  if (typeof global.process === 'undefined') {
    worker = (0, _msw.setupWorker)();
    worker.start();
  }
}

var mswDecorator = (0, _addons.makeDecorator)({
  name: 'withMsw',
  parameterName: 'msw',
  wrapper: function wrapper(storyFn, context, _ref) {
    var parameters = _ref.parameters;

    if (worker) {
      var _worker;

      (_worker = worker).use.apply(_worker, _toConsumableArray(parameters));
    }

    return storyFn(context);
  }
});
exports.mswDecorator = mswDecorator;