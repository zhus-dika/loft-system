var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookie = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const config = require('../../Server/config')
var indexRouter = require('./routes')
var cors = require('cors')
var app = express();

// parse application/x-www-form-urlencoded
// for easier testing with Postman or plain HTML forms
app.use(
  session({
    secret: config.secret,
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 10 * 60 * 1000
    },
    saveUninitialized: false,
    resave: false
  })
)
// parse application/json
app.use(logger('dev'));
app.use(express.json());
app.use(cors())
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
//app.get('/*', (req, res) => res.sendFile('index.html', { root: '../Client/public' }))
app.use('/', indexRouter)
app.use(cookie())

module.exports = app;
