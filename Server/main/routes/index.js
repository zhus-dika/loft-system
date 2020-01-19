var express = require('express')
var router = express.Router()
const passport = require('passport');
const session = require('express-session');
var passportJWT = require("passport-jwt");
var bodyParser = require("body-parser");
const fetch = require('node-fetch');
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// для работы с promise
mongoose.Promise = global.Promise;
// подключение
const url = "mongodb://localhost:27017/loft_system";
mongoose
.connect(url, {
useUnifiedTopology: true,
useNewUrlParser: true,
})
.then(() => console.log('DB Connected!'))
.catch(err => {
console.log('DB Connection Error: ${err.message}');
});
const userScheme = new Schema({
  firstName: String,
  image: String,
  middleName: String,
  permission: {
      chat: { C: Boolean, R: Boolean, U: Boolean, D: Boolean },
      news: { C: Boolean, R: Boolean, U: Boolean, D: Boolean },
      settings: { C: Boolean, R: Boolean, U: Boolean, D: Boolean }
  },
  surName: String,
  username: { type : String},// , unique : true},//, required : true, dropDups: true },
  password: { type: String},//, required: true},
  accessToken: String,
  refreshToken: String,
  accessTokenExpiredAt: Date,
  refreshTokenExpiredAt: Date
});
const tokenScheme = new Schema({
  accessToken: String,
  refreshToken: String,
  accessTokenExpiredAt: Date ,
  refreshTokenExpiredAt: Date
})
const newsScheme = new Schema({
  created_at: Date,
  text: String,
  title: String,
  user: {
    firstName: String,
    id: String,
    image: String,
    middleName: String,
    surName: String,
    username: String
  }
})
const User = mongoose.model("User", userScheme);
const Token = mongoose.model("Token", tokenScheme);
const News = mongoose.model("News", newsScheme);
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var jwt = require('jsonwebtoken');
const config = require('../../config')
router.use(bodyParser.urlencoded({
  extended: true
}));
router.use(bodyParser.json())
const jwtOptions = {  
  // Telling Passport to check authorization headers for JWT
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  // Telling Passport where to find the secret
  secretOrKey: config.secret,
  passReqToCallback: true //<= Important, so that the verify function can accept the req param ie verify(req,payload,done)
}; 
router.use(passport.initialize());
var strategy = new JwtStrategy(jwtOptions, function(req, jwt_payload, done) {
  console.log('payload received', jwt_payload);
  let userId = jwt_payload.id
  User.findById(userId)
   .then(function(doc){
     req.user = doc
     done(null, doc);
   })
   .catch(function (err){
     done(null, false);
   })
})
passport.use(strategy);
function getTokenFromHeaders(req){
  if(req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer'){
      return req.headers.authorization.split(' ')[1];
  }
  return null;
}
/*************************A P I / L O G I N*************************************/

router.post("/api/login", function(req, res) {
  let username = req.body.username
  let password = req.body.password
  if(username && password){
    User.findOne({username: username, password: password}).lean().exec(function(err, doc) {
      if (err) {
        return res.status(401).json({message: "no such user found"});
      } else {
        if (doc) {
          var payload = {id: doc._id};
          const accessToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: config.accessTokenLife})
          const refreshToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: config.refreshTokenLife}) 
          const accessTokenExpiredAt = Date.now() + config.accessTokenLife
          const refreshTokenExpiredAt = Date.now() + config.refreshTokenLife
          User.findByIdAndUpdate(doc._id, {
            accessToken: accessToken,
            refreshToken: refreshToken, 
            accessTokenExpiredAt: accessTokenExpiredAt, 
            refreshTokenExpiredAt: refreshTokenExpiredAt
          }, function(err, doc) {
            if (err) return res.status(401).json({message: err});
          })
          User.findById(doc._id,
            function(err, doc) {
            if (err) return res.status(401).json({message: err});
            res.send(doc)
          })
        } else return res.status(401).json({message: "no such user found"}); 
      }
    })
  }
})
/***********************A P I / R E G I S T R A T I O N***************************************/
router.post('/api/registration', (req, res, next) => {
  const user = new User({
    firstName: req.body.firstName,
    surName: req.body.surName,
    middleName: req.body.middleName,
    username: req.body.username,
    password: req.body.password,
    permission: {
      chat: { C: false, R: true, U: true, D: true },
      news: { C: false, R: true, U: true, D: false },
      settings: { C: false, R: false, U: false, D: false }
    },
    accessToken: '',
    refreshToken: '',
    accessTokenExpiredAt: Date.now(),
    refreshTokenExpiredAt: Date.now()
  })
  user.save()
  .then(function(doc){
    res.send(doc)
  })
  .catch(function (err){
    return res.status(401).json({message: err});
  })
})
/****************************A P I / P R O F I L E**********************************/
router.get("/api/profile", passport.authenticate('jwt', { session: false }), function(req, res){
  let user = req.user
  try {
    var decoded = jwt.verify(user.accessToken, jwtOptions.secretOrKey)
   } catch (err) {
    return res.status(401).json({message: err});
   }
   res.send(user)
})
/**************************A P I / R E F R E S H - T O K E N*********************************** */
router.post("/api/refresh-token", passport.authenticate('jwt', { session: false }), function(req, res) {
  let authorization = req.user.refreshToken
    try {
        var decoded = jwt.verify(authorization, jwtOptions.secretOrKey);
    } catch (e) {
        res.redirect('/api/login');
    }
    let userId = decoded.id
    var payload = {id: userId};
    const accessToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: config.accessTokenLife})
    const refreshToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: config.refreshTokenLife}) 
    const accessTokenExpiredAt = Date.now() + config.accessTokenLife
    const refreshTokenExpiredAt = Date.now() + config.refreshTokenLife
    User.findByIdAndUpdate(userId, {
      accessToken: accessToken,
      refreshToken: refreshToken, 
      accessTokenExpiredAt: accessTokenExpiredAt, 
      refreshTokenExpiredAt: refreshTokenExpiredAt
    }).lean().exec(function(err, doc) {
      if (err) return res.status(401).json({message: err});
      if (doc.refreshToken != authorization) {
        res.redirect('/api/login')
      }
      req.headers.authorization = refreshToken
      res.send({
        accessToken: accessToken, 
        refreshToken: refreshToken,
        accessTokenExpiredAt: accessTokenExpiredAt,
        refreshTokenExpiredAt: refreshTokenExpiredAt
      })
    })
  })
  /**************************A P I / P R O F I L E  P A T C H *********************************** */

router.patch("/api/profile", passport.authenticate('jwt', { session: false }), function(req, res){
  let user = req.user
  if(user.password == req.body.oldPassword) {
    user.firstName = req.body.firstName,
    user.middleName = req.body.middleName, 
    user.surName = req.body.surName, 
    user.password = req.body.newPassword,
      //image: req.file.name
    user.save()
    .then(function(doc){
      res.send(doc)
    })
    .catch(function (err){
      return res.status(401).json({message: err});
    })
  }
})
  /**************************D E L E T E  U S E R  B Y  I D *********************************** */

router.delete('/api/users/:id', passport.authenticate('jwt', { session: false }), (req, res) => {
    User.deleteOne({ _id: req.params['id']}, function(err, doc) {
      if (err) return res.status(401).json({message: err})
      res.send(doc)
    })
})
  /**************************G E T  A L L  N E W S *********************************** */

router.get('/api/news', passport.authenticate('jwt', { session: false }), (req, res, next ) => {
  News.find()
   .then(function(doc){
     res.send(doc)
   })
   .catch(function (err){
     return res.status(401).json({message: err});
   })

})
  /**************************C R E A T E  N E W S *********************************** */

router.post('/api/news', passport.authenticate('jwt', { session: false }), (req, res, next) => {
  let user = req.user
  const news = new News({
    created_at: Date.now(),
    text: req.body.text,
    title: req.body.title,
    user: {
      firstName: user.firstName,
      id: user._id,
      image: user.image,
      middleName: user.middleName,
      surName: user.surName,
      username: user.username
    }
  })
  news.save()
    .then(function(doc){
      res.send(doc)
    })
    .catch(function (err){
      return res.status(401).json({message: err});
    })
  
})
  /**************************U P D A T E  N E W S *********************************** */
router.patch('/api/news/:id', passport.authenticate('jwt', { session: false }), (req, res, next) => {
  News.findOne({ _id: req.params['id'] }, function (err, doc) {
    if (err) return res.status(401).json({message: "news doesn't exist"})
    doc.text = req.body.text
    doc.title = req.body.title
    doc.save()
    .then(function(doc){
      res.redirect('/api/news')
    })
    .catch(function (err){
      return res.status(401).json({message: err});
    })
  })    
})

module.exports = router
