"use strict";

/* global chrome */
/*
 Script embedded on each user page
 Listens messages from translation module and renders popup
 with translated text
*/

var View = require("./view.coffee");
var content = new View();