const fs = require('fs')
const path = require('path')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const pool = require('../models/db')
// описываем локальную стратегию аутентификации
passport.use(
    new LocalStrategy(
      {
        username: 'username'
      },
      (username, password, done) => {
        const values = [username, password]
        pool.query(`select * from users where username=$1 and password=$2;`, 
        values, (q_err, q_res) => {
                if(q_err) return done(q_err)
        // Сравниваем пользователя из хранилища (в нашем случае это объект)
        // с тем что пришло с POST запроса на роутер /login
        // в полях email и password
        if (q_res.rows[0] && username === q_res.rows[0].username && password === q_res.rows[0].password) {
            console.log(q_res.rows[0])

          // если они совпадают передаем объект user в callback функцию done
          return done(null, q_res.rows[0]);
        } else {
          // если не соответствуют то отдаем false
          return done(null, false);
        }
      }
    )
}))
  passport.serializeUser((user, done) => {
    done(null, user.uid);
  });
  
  passport.deserializeUser((id, done) => {
    // здесь необходимо найти пользователя с данным id
    // но он у нас один и мы просто сравниваем
    pool.query(`select from users where uid=$1;`, 
        id, (q_err, q_res) => {
                if(q_err) done(q_err);
        // Сравниваем пользователя из хранилища (в нашем случае это объект)
        // с тем что пришло с POST запроса на роутер /login
        // в полях email и password
        const _user = q_res.rows[0]
        if (_user){
            done(null, _user);
        } else done(null, false)
    })
  });
  
  module.exports.post =(req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (user) {
        return res.json(user);
      }
    })(req, res, next);
  }