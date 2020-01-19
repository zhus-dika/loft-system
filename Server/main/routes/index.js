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
//mongoose.connect(url, { useNewUrlParser: true })
// установка схемы
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
const User = mongoose.model("User", userScheme);
const Token= mongoose.model("Token", tokenScheme);
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;
var jwt = require('jsonwebtoken');
const config = require('../../config')
router.use(bodyParser.urlencoded({
  extended: true
}));
router.use(bodyParser.json())
//ar jwtOptions = {}
//jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
//jwtOptions.secretOrKey = config.secret;
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
  console.log(req.get.authorization);
  try {
    var decoded = jwt.verify(req.get('Authorization'), jwtOptions.secretOrKey)
   } catch (e) {
     console.log('accessToken expired')
     //return res.status(401).json({message: 'accessToken expired'});
     res.redirect('/api/refresh-token')
   }
   //let headers = new Headers({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token });
   //headers.append('Authorization','Bearer ')
   //let options = new RequestOptions();
   console.log('accessToken is valid')
   let userId = decoded.id
   User.findById(userId)
   .then(function(doc){
     res.send(doc)
   })
   .catch(function (err){
     return res.status(401).json({message: err});
   })
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

router.delete('/api/users/:id', (req, res, next) => {
  pool.query(`DELETE FROM users
              WHERE uid = $1`, [req.params['id']],
              (q_err, q_res) => {
                  res.json(q_res.rows[0])
        })
})
router.get('/api/news', (req, res, next ) => {
  console.log(req.session.token)
  pool.query("SELECT * FROM news ORDER BY created_at DESC", (q_err, q_res) => {
    res.json(q_res.rows)
    })
})

router.post('/api/news', (req, res, next) => {
  const values = [req.body.title, req.body.text, passport.user]
  console.log(passport.user)
  pool.query(`INSERT INTO news(text, title, user_id, created_at) 
              VALUES($1, $2, $3, NOW() )`, values, (q_err, q_res) => {
          if(q_err) return next(q_err);
          res.json(q_res.rows)
    })
})
/*
router.patch('/api/profile', (req, res, next) => {
  const values = [req.body.firstName, req.body.middleName, req.body.surName,
     req.body.newPassword, req.body.avatar.name]
  pool.query(`UPDATE users SET firstName= $1, middleName=$2, surName=$3, password=$5, image=$6
              WHERE pid = $4`, values,
              (q_err, q_res) => {
                console.log(q_res)
                console.log(q_err)
        })
})

router.get('/api/get/post', (req, res, next) => {
  const post_id = req.query.post_id

  pool.query(`SELECT * FROM posts
              WHERE pid=$1`, [ post_id ],
              (q_err, q_res) => {
                res.json(q_res.rows)
      })
} )


 router.post('/api/post/posttodb', (req, res, next) => {
   const values = [req.body.title, req.body.body, req.body.uid, req.body.username]
   pool.query(`INSERT INTO posts(title, body, user_id, author, date_created)
               VALUES($1, $2, $3, $4, NOW() )`, values, (q_err, q_res) => {
           if(q_err) return next(q_err);
           res.json(q_res.rows)
     })
 })

router.put('/api/put/post', (req, res, next) => {
  const values = [req.body.title, req.body.body, req.body.uid, req.body.pid, req.body.username]
  pool.query(`UPDATE posts SET title= $1, body=$2, user_id=$3, author=$5, date_created=NOW()
              WHERE pid = $4`, values,
              (q_err, q_res) => {
                console.log(q_res)
                console.log(q_err)
        })
})

router.delete('/api/delete/postcomments', (req, res, next) => {
  const post_id = req.body.post_id
  pool.query(`DELETE FROM comments
              WHERE post_id = $1`, [post_id],
              (q_err, q_res) => {
                  //res.json(q_res.rows)
                  console.log(q_err)
        })
})

router.delete('/api/delete/post', (req, res, next) => {
  const post_id = req.body.post_id
  pool.query(`DELETE FROM posts WHERE pid = $1`, [ post_id ],
              (q_err, q_res) => {
                res.json(q_res.rows)
                console.log(q_err)
       })
})

/*
    COMMENTS ROUTES SECTION
*/


router.post('/api/post/commenttodb', (req, res, next) => {
  const values = [ req.body.comment, req.body.user_id, req.body.username, req.body.post_id]

  pool.query(`INSERT INTO comments(comment, user_id, author, post_id, date_created)
              VALUES($1, $2, $3, $4, NOW())`, values,
              (q_err, q_res ) => {
                  res.json(q_res.rows)
                  console.log(q_err)
      })
})

router.put('/api/put/commenttodb', (req, res, next) => {
  const values = [ req.body.comment, req.body.user_id, req.body.post_id, req.body.username, req.body.cid]

  pool.query(`UPDATE comments SET
              comment = $1, user_id = $2, post_id = $3, author = $4, date_created=NOW()
              WHERE cid=$5`, values,
              (q_err, q_res ) => {
                  res.json(q_res.rows)
                  console.log(q_err)
      })
})


router.delete('/api/delete/comment', (req, res, next) => {
  const cid = req.body.comment_id
  console.log(cid)
  pool.query(`DELETE FROM comments
              WHERE cid=$1`, [ cid ],
              (q_err, q_res ) => {
                  res.json(q_res)
                  console.log(q_err)
      })
})


router.get('/api/get/allpostcomments', (req, res, next) => {
  const post_id = String(req.query.post_id)
  pool.query(`SELECT * FROM comments
              WHERE post_id=$1`, [ post_id ],
              (q_err, q_res ) => {
                  res.json(q_res.rows)
      })
})

/*
  USER PROFILE SECTION
*/

router.post('/api/posts/userprofiletodb', (req, res, next) => {
  const values = [req.body.profile.nickname, req.body.profile.email, req.body.profile.email_verified]
  pool.query(`INSERT INTO users(username, email, email_verified, date_created)
              VALUES($1, $2, $3, NOW())
              ON CONFLICT DO NOTHING`, values,
              (q_err, q_res) => {
                res.json(q_res.rows)
      })
} )

router.get('/api/get/userprofilefromdb', (req, res, next) => {
  const email = req.query.email
  console.log(email)
  pool.query(`SELECT * FROM users
              WHERE email=$1`, [ email ],
              (q_err, q_res) => {
                res.json(q_res.rows)
      })
} )

router.get('/api/get/userposts', (req, res, next) => {
  const user_id = req.query.user_id
  console.log(user_id)
  pool.query(`SELECT * FROM posts
              WHERE user_id=$1`, [ user_id ],
              (q_err, q_res) => {
                res.json(q_res.rows)
      })
} )


router.put('/api/put/likes', (req, res, next) => {
  const uid = [req.body.uid]
  const post_id = String(req.body.post_id)

  const values = [ uid, post_id ]
  console.log(values)
  pool.query(`UPDATE posts
              SET like_user_id = like_user_id || $1, likes = likes + 1
              WHERE NOT (like_user_id @> $1)
              AND pid = ($2)`,
     values, (q_err, q_res) => {
    if (q_err) return next(q_err);
    console.log(q_res)
    res.json(q_res.rows);
  });
});


//Search Posts
router.get('/api/get/searchpost', (req, res, next) => {
  search_query = String(req.query.search_query)
  pool.query(`SELECT * FROM posts
              WHERE search_vector @@ to_tsquery($1)`,
    [ search_query ], (q_err, q_res) => {
    if (q_err) return next(q_err);
    res.json(q_res.rows);
  });
});

//Save posts to db
router.post('/api/post/posttodb', (req, res, next) => {
  const body_vector = String(req.body.body)
  const title_vector = String(req.body.title)
  const username_vector = String(req.body.username)

  const search_vector = [title_vector, body_vector, username_vector]
  const values = [req.body.title, req.body.body, search_vector, req.body.uid, req.body.username]
  pool.query(`INSERT INTO
              posts(title, body, search_vector, user_id, author, date_created)
              VALUES($1, $2, to_tsvector($3), $4, $5, NOW())`,
    values, (q_err, q_res) => {
    if (q_err) return next(q_err);
    res.json(q_res.rows);
  });
});


// Retrieve another users profile from db based on username
router.get('/api/get/otheruserprofilefromdb', (req, res, next) => {
  // const email = [ "%" + req.query.email + "%"]
  const username = String(req.query.username)
  pool.query(`SELECT * FROM users
              WHERE username = $1`,
    [ username ], (q_err, q_res) => {
    res.json(q_res.rows)
  });
});
/*
//Get another user's posts based on username
router.get('/api/get/otheruserposts', (req, res, next) => {
  const username = String(req.query.username)
  pool.query(`SELECT * FROM posts
              WHERE author = $1`,
    [ username ], (q_err, q_res) => {
    res.json(q_res.rows)
  });
});*/
/*
//Send Message to db
router.post('/api/post/messagetodb', (req, res, next) => {

  const from_username = String(req.body.message_sender)
  const to_username = String(req.body.message_to)
  const title = String(req.body.title)
  const body = String(req.body.body)

  const values = [from_username, to_username, title, body]
  pool.query(`INSERT INTO messages(message_sender, message_to, message_title, message_body, date_created)
              VALUES($1, $2, $3, $4, NOW())`,
    values, (q_err, q_res) => {
    if (q_err) return next(q_err);
    console.log(q_res)
    res.json(q_res.rows);
  });
});*/
/*
//Get another user's posts based on username
router.get('/api/get/usermessages', (req, res, next) => {
  const username = String(req.query.username)
  console.log(username)
  pool.query(`SELECT * FROM messages
              WHERE message_to = $1`,
    [ username ], (q_err, q_res) => {
    res.json(q_res.rows)
  });
});

//Delete a message with the message id
router.delete('/api/delete/usermessage', (req, res, next) => {
  const mid = req.body.mid
  pool.query(`DELETE FROM messages
              WHERE mid = $1`,
    [ mid ], (q_err, q_res) => {
    if (q_err) return next(q_err);
    console.log(q_res)
    res.json(q_res.rows);
  });
});
*/

module.exports = router
