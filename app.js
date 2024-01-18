const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running At http://localhost:3000/")
    );
  } catch (e) {
    console.log(`Db Error ${e.message}`);
    process.exit(1);
  }
};

initializeDbServer();

//API 1
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const checkUserQuery = `select * from user where username = '${username}'`;
  const checkUser = await db.get(checkUserQuery);

  if (checkUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      checkUser.password
    );

    if (isPasswordMatched === true) {
      const payload = { username: username };

      const jwtToken = jwt.sign(payload, "TWITTER_CLONE");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authenticate JWT Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "TWITTER_CLONE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserIdQuery = `select user_id from user where username = '${username}'`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowingUserIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowingUserIds = await db.all(getFollowingUserIdsQuery);

  const getFollowingIds = getFollowingUserIds.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const latestTweetsQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime 
      from user inner join tweet 
      on user.user_id= tweet.user_id where user.user_id in (${getFollowingIds})
       order by tweet.date_time desc limit 4 ;`;
  const latestTweetsArray = await db.all(latestTweetsQuery);

  response.send(latestTweetsArray);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserIdQuery = `select user_id from user where username = '${username}'`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowingUserIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowingUserIds = await db.all(getFollowingUserIdsQuery);

  const getFollowingIds = getFollowingUserIds.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const namesOfUserFollowsQuery = `select name from user where user.user_id in (${getFollowingIds})`;
  const namesOfUserFollowsArray = await db.all(namesOfUserFollowsQuery);

  response.send(namesOfUserFollowsArray);
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserIdQuery = `select user_id from user where username = '${username}'`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowerUserIdsQuery = `select follower_user_id from follower 
    where following_user_id=${getUserId.user_id};`;
  const getFollowerUserIds = await db.all(getFollowerUserIdsQuery);

  const getFollowerIds = getFollowerUserIds.map((eachUser) => {
    return eachUser.follower_user_id;
  });

  const namesOfUsersFollowingQuery = `select name from user where user.user_id in (${getFollowerIds})`;
  const namesOfUsersFollowingArray = await db.all(namesOfUsersFollowingQuery);

  response.send(namesOfUsersFollowingArray);
});

//API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const getUserIdQuery = `select user_id from user where username = '${username}'`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowingUserIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowingUserIds = await db.all(getFollowingUserIdsQuery);

  const getFollowingIds = getFollowingUserIds.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds})`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);

  const getTweetIds = getTweetIdsArray.map((each) => each.tweet_id);

  if (getTweetIds.includes(parseInt(tweetId))) {
    const getTweetAndDateQuery = `select tweet, date_time from tweet where tweet_id = ${tweetId}`;
    const getTweetAndDate = await db.get(getTweetAndDateQuery);

    const getLikesQuery = `select count(user_id) as likes from like where tweet_id = ${tweetId}`;
    const getLikes = await db.get(getLikesQuery);

    const getRepliesQuery = `select count(user_id) as replies from reply where tweet_id = ${tweetId}`;
    const getReplies = await db.get(getRepliesQuery);

    const finalResult = {
      tweet: getTweetAndDate.tweet,
      likes: getLikes.likes,
      replies: getReplies.replies,
      dateTime: getTweetAndDate.date_time,
    };

    response.send(finalResult);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getUserIdQuery = `select user_id from user where username = '${username}'`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingUserIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
    const getFollowingUserIds = await db.all(getFollowingUserIdsQuery);

    const getFollowingIds = getFollowingUserIds.map((eachUser) => {
      return eachUser.following_user_id;
    });

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds})`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);

    const getTweetIds = getTweetIdsArray.map((each) => each.tweet_id);

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikesByUserQuery = `select user.username as likes
      from user inner join like on user.user_id = like.user_id where like.tweet_id = ${tweetId}`;
      const getLikesByUser = await db.all(getLikesByUserQuery);

      const getNamesOfUsers = getLikesByUser.map((user) => user.likes);

      const getNamesOfUsersLiked = { likes: getNamesOfUsers };

      response.send(getNamesOfUsersLiked);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getUserIdQuery = `select user_id from user where username = '${username}'`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingUserIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
    const getFollowingUserIds = await db.all(getFollowingUserIdsQuery);

    const getFollowingIds = getFollowingUserIds.map((eachUser) => {
      return eachUser.following_user_id;
    });

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds})`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);

    const getTweetIds = getTweetIdsArray.map((each) => each.tweet_id);

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getRepliesByUserQuery = `select user.username, reply.reply
      from user inner join reply on user.user_id = reply.user_id where reply.tweet_id = ${tweetId}`;
      const getRepliesByUser = await db.all(getRepliesByUserQuery);

      const getUsersReplied = { replies: getRepliesByUser };

      response.send(getUsersReplied);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];

  const query = `
    SELECT tweet, COUNT() AS likes, date_time As dateTime
    FROM tweet INNER JOIN like
    ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;`;
  let likesData = await db.all(query);

  const repliesQuery = `
    SELECT tweet, COUNT() AS replies
    FROM tweet INNER JOIN reply
    ON tweet.tweet_id = reply.tweet_id
    WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;`;

  const repliesData = await db.all(repliesQuery);

  likesData.forEach((each) => {
    for (let data of repliesData) {
      if (each.tweet === data.tweet) {
        each.replies = data.replies;
        break;
      }
    }
  });
  response.send(likesData);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];

  const query = `
    INSERT INTO 
        tweet(tweet, user_id)
    VALUES ('${tweet}', ${userId});`;
  await db.run(query);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(getUserQuery);
    const userId = dbUser["user_id"];

    const userTweetsQuery = `
    SELECT tweet_id, user_id 
    FROM tweet
    WHERE user_id = ${userId};`;
    const userTweetsData = await db.all(userTweetsQuery);

    let isTweetUsers = false;
    userTweetsData.forEach((each) => {
      if (each["tweet_id"] == tweetId) {
        isTweetUsers = true;
      }
    });

    if (isTweetUsers) {
      const query = `
        DELETE FROM tweet
        WHERE tweet_id = ${tweetId};`;
      await db.run(query);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
