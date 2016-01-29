'use strict';

var Connection = require('./src/dataConnection');
var dc = new Connection('peer', {}, {});

console.log(dc.id);
