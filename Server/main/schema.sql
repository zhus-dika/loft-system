CREATE TABLE permission_object(
  poid SERIAL PRIMARY KEY,
  C BOOLEAN default FALSE, 
  R BOOLEAN default FALSE, 
  U BOOLEAN default FALSE, 
  D BOOLEAN default FALSE
);

CREATE TABLE permission (
  pid SERIAL PRIMARY KEY,
  chat INT REFERENCES permission_object(poid),
  news INT REFERENCES permission_object(poid),
  settings INT REFERENCES permission_object(poid)
);

CREATE TABLE users (
  uid SERIAL PRIMARY KEY,
  firstName VARCHAR(255),
  surName VARCHAR(255),
  username VARCHAR(255),
  middleName VARCHAR(255),
  password VARCHAR(255),
  u_image VARCHAR(255),
  perm_id INT REFERENCES permission(pid),
  accessToken VARCHAR(255),
  refreshToken VARCHAR(255),
  accessTokenExpiredAt TIMESTAMP,
  refreshTokenExpiredAt TIMESTAMP
);
CREATE TABLE news (
  nid SERIAL PRIMARY KEY,
  created_at TIMESTAMP,
  text VARCHAR(255),
  title VARCHAR(255),
  user_id INT REFERENCES users(uid));