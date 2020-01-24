var express = require('express')
var router = express.Router()
const path = require('path')
const passport = require('passport');
const fs = require('fs')
var passportJWT = require("passport-jwt");
var bodyParser = require("body-parser");
const formidable = require('formidable')
const mongoose = require("mongoose");
const config = require('../../config')
mongoose.set('useFindAndModify', false);
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
//const url = "mongodb://localhost:27017/loft_system";
const url = config.mongodb

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
  id: {type:String, unique: true},
  firstName: String,
  image: String,
  middleName: String,
  permission: {
      chat: { C: Boolean, R: Boolean, U: Boolean, D: Boolean },
      news: { C: Boolean, R: Boolean, U: Boolean, D: Boolean },
      settings: { C: Boolean, R: Boolean, U: Boolean, D: Boolean }
  },
  surName: String,
  username: {type:String, unique: true},
  password: String, 
  accessToken: String,
  refreshToken: String,
  accessTokenExpiredAt: Date,
  refreshTokenExpiredAt: Date
});
const newsScheme = new Schema({
  id: String,
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
const News = mongoose.model("News", newsScheme);
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var jwt = require('jsonwebtoken');
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
/*************************A P I / L O G I N*************************************/
router.post("/api/login", function(req, res) {
  let username = req.body.username
  let password = req.body.password
  var id
  if(username && password){
    User.findOne({username: username, password: password}).lean().exec(function(err, doc) {
      if (err) {
        return res.status(401).json({message: err});
      } else {
        if (doc) {
          if (err) return res.status(401).json({message: err})
          id = doc._id
        } else return res.status(401).json({message: "no such user found"})
        let update =  new Promise(function(resolve, reject){
          var payload = {id: id, username: username};
          const accessToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: config.accessTokenLife})
          const refreshToken = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: config.refreshTokenLife}) 
          const accessTokenExpiredAt = Date.now() + config.accessTokenLife
          const refreshTokenExpiredAt = Date.now() + config.refreshTokenLife
          User.findByIdAndUpdate(id, {
          accessToken: accessToken,
          refreshToken: refreshToken, 
          accessTokenExpiredAt: accessTokenExpiredAt, 
          refreshTokenExpiredAt: refreshTokenExpiredAt
        }).lean().exec(function(err, doc) {
          if (err) return res.status(401).json({message: err});
          resolve(id)
        })
      })
        update.then(function(id){
          User.findById(id, function(err, doc){
            res.send(doc)
          })
        }).catch(function(err) {
          return res.status(401).json({message: err}); 
        })      
      }
    })
  }
})
/***********************A P I / R E G I S T R A T I O N***************************************/
router.post('/api/registration', (req, res, next) => {
  var pass = false;
  while(pass) {
    User.count({username: req.body.username}, function (err, count){ 
      if(count>0){
        pass = false
      } else pass = true
    })
  }
  User.countDocuments({}, function(err, count) {
    const user = new User({
      id: count++,
      firstName: req.body.firstName,
      surName: req.body.surName,
      middleName: req.body.middleName,
      username: req.body.username,
      password: req.body.password,
      image: null,
      permission: {
        chat: { C: false, R: true, U: true, D: true },
        news: { C: false, R: true, U: true, D: false },
        settings: { C: false, R: false, U: false, D: false }
        /**for admin**/
        /*chat: { C: true, R: true, U: true, D: true },
        news: { C: true, R: true, U: true, D: true },
        settings: { C: true, R: true, U: true, D: true}*/
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
})
/****************************A P I / P R O F I L E**********************************/
router.get("/api/profile", function(req, res){
  let authorization = req.headers.authorization
  try {
    var decoded = jwt.verify(authorization, jwtOptions.secretOrKey)
   } catch (err) {
    return res.status(401).json({message: err});
   }
   let userId = decoded.id
   User.findById(userId)
   .then(function(doc){
     res.send(doc)
   })
   .catch(function (err){
    return res.status(401).json({message: err})
   })
})
/**************************A P I / R E F R E S H - T O K E N*********************************** */
router.post("/api/refresh-token", function(req, res) {
  let authorization = req.headers.authorization
    try {
        var decoded = jwt.verify(authorization, jwtOptions.secretOrKey);
    } catch (err) {
      return res.status(401).json({message: err});
    }
    let userId = decoded.id
    var payload = {id: id, username: username};
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
        //res.redirect('/api/login')
        return res.status(401).json({message: err});
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

router.patch('/api/profile', function(req, res){
  let authorization = req.headers.authorization
  try {
      var decoded = jwt.verify(authorization, jwtOptions.secretOrKey);
  } catch (err) {
    return res.status(401).json({message: err});
  }
  let userId = decoded.id
  let form = new formidable.IncomingForm()
  let upload = path.join('../Client/build/assets/img')
  form.uploadDir = upload
  form.parse(req, function (err, fields, files) {
    if (err) {
      return next(err)
    } 
    if(files.avatar) {
      const fileName = path.join(upload, files.avatar.name)
      fs.rename(files.avatar.path, fileName, function (err) {
        if (err) {
          return res.status(401).json({message: err});
        }
        User.findById(userId)
     .then(function(doc){
       if(doc.password == fields.oldPassword) {
        doc.firstName = fields.firstName
        doc.middleName = fields.middleName, 
        doc.surName = fields.surName, 
        doc.password = fields.newPassword,
        doc.image = path.join('assets', 'img', files.avatar.name)
        doc.save()
        .then(function(ndoc){
          res.send(ndoc)
        })
        .catch(function (err){
          return res.status(401).json({message: err});
        })
        } else return res.status(401).json({message: 'password is incorrect'});
      })
      })
    } else {
      User.findById(userId)
      .then(function(doc){
        if(doc.password == fields.oldPassword) {
         doc.firstName = fields.firstName
         doc.middleName = fields.middleName, 
         doc.surName = fields.surName, 
         doc.password = fields.newPassword,
         doc.save()
         .then(function(ndoc){
           res.send(ndoc)
         })
         .catch(function (err){
           return res.status(401).json({message: err});
         })
         } else return res.status(401).json({message: 'password is incorrect'});
       })
    }
  })
})
  
  /**************************D E L E T E  U S E R  B Y  I D *********************************** */

router.delete('/api/users/:id', (req, res) => {//passport.authenticate('jwt', { session: false }), (req, res) => {
    User.deleteOne({ id: req.params['id']}, function(err, doc) {
      if (err) return res.status(401).json({message: err})
      res.send(doc)
    })
})
  /**************************G E T  A L L  N E W S *********************************** */

router.get('/api/news', (req, res, next ) => {
  News.find()
   .then(function(doc){
     res.send(doc)
   })
   .catch(function (err){
     return res.status(401).json({message: err});
   })

})
  /**************************C R E A T E  N E W S *********************************** */

router.post('/api/news', (req, res, next) => {
  let authorization = req.headers.authorization
  try {
      var decoded = jwt.verify(authorization, jwtOptions.secretOrKey);
  } catch (err) {
    return res.status(401).json({message: err});
  }
  let userId = decoded.id
  User.findById(userId)
   .then(function(doc){
    News.countDocuments({}, function(err, count) {
    const news = new News({
      id: count++,
      created_at: Date.now(),
      text: req.body.text,
      title: req.body.title,
      user: {
        firstName: doc.firstName,
        id: doc.id,
        image: '',
        middleName: doc.middleName,
        surName: doc.surName,
        username: doc.username
      }
    })
    news.save()
    .then(function(doc){
      News.find()
      .then(function(indoc){
        res.send(indoc)
      })
      .catch(function (err){
        return res.status(401).json({message: err});
      })
    })
    .catch(function (err){
      return res.status(401).json({message: err});
    })
  }) 
  })
   .catch(function (err){
     return res.status(401).json({message: err});
   })
})
  /**************************U P D A T E  N E W S ************************************/
router.patch('/api/news/:id', (req, res, next) => {
  News.findOneAndUpdate({id: req.params['id'] }, {
    text: req.body.text,
    title: req.body.title
  }, function (err, doc) {
    if (err) return res.status(401).json({message: err})
  }).then(()=>{
    News.find()
   .then(function(doc){
     res.send(doc)
   })
   .catch(function (err){
     return res.status(401).json({message: err});
   })
  }) 
})
  /**************************D E L E T E  N E W S ************************************/
router.delete('/api/news/:id', (req, res, next) => {
  console.log(req.params['id'])
  News.deleteOne({ id: req.params['id']}, function(err, doc) {
    if (err) return res.status(401).end({message: err})
  })
  .then(function(err, doc) {
    News.find()
    .then(function(doc){
      res.json(doc)
    })
    .catch(function (err){
    return res.status(401).json({message: err});
    })
    .catch(function (err){
      return res.status(401).json({message: err});
    })
  })
})
  /**************************G E T  A L L  U S E R S ************************************/
router.get('/api/users', (req, res, next ) => {
  User.find()
  .then(function(doc){
    res.send(doc)
  })
  .catch(function (err){
    return res.status(401).json({message: err});
  })
})
  /**************************U P D A T E  U S E R  P E R M I S S I O N************************************/
  router.patch('/api/users/:id/permission', (req, res, next) => {
    User.findOne({ id: req.params['id'] }, function (err, doc) {
      if (err) return res.status(401).json({message: err})
      doc.permission.chat.C = req.body.permission.chat.C
      doc.permission.chat.R = req.body.permission.chat.R
      doc.permission.chat.U = req.body.permission.chat.U
      doc.permission.chat.D = req.body.permission.chat.D

      doc.permission.news.C = req.body.permission.news.C
      doc.permission.news.R = req.body.permission.news.R
      doc.permission.news.U = req.body.permission.news.U
      doc.permission.news.D = req.body.permission.news.D

      doc.permission.settings.C = req.body.permission.settings.C
      doc.permission.settings.R = req.body.permission.settings.R
      doc.permission.settings.U = req.body.permission.settings.U
      doc.permission.settings.D = req.body.permission.settings.D
      doc.save()
      .then(function(doc){
        User.find()
        .then(function(inpdoc){
          res.send(inpdoc)
        })
        .catch(function (err){
          return res.status(401).json({message: err});
        })
      })
      .catch(function (err){
        return res.status(401).json({message: err});
      })
    })    
  })
module.exports = router
