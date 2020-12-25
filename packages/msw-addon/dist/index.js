"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mswDecorator = require("./mswDecorator");

Object.keys(_mswDecorator).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _mswDecorator[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _mswDecorator[key];
    }
  });
});