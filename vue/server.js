const express = require('express');
const serveStatic = require('serve-static');

const helmet = require('helmet');
const app = express();
app.use(serveStatic(__dirname + "/dist"));
app.use(helmet());

var port = process.env.PORT || 7440;
app.listen(port);
