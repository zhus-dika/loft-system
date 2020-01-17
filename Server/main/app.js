var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
var indexRouter = require('./routes')
var app = express();

// parse application/x-www-form-urlencoded
// for easier testing with Postman or plain HTML forms



// parse application/json
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
//app.get('/*', (req, res) => res.sendFile('../../Client/public/index.html'))
app.use('/', indexRouter)


module.exports = app;
