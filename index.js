const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const saltRounds = 10;
const secret = "jeelisagoodboy";
const cookieParser = require("cookie-parser");
const Post = require("./models/Post");

app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect("mongodb+srv://jeel:jeel4580@jeel.wbjbv6r.mongodb.net/");

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    bcrypt.hash(password, saltRounds, async function (err, hash) {
      const userDoc = await User.create({ username: username, password: hash });
      res.json(userDoc);
    });
  } catch (err) {
    res.status(400).json(err);
    console.log(err);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });

    if (userDoc) {
      bcrypt.compare(password, userDoc.password, async function (err, result) {
        if (result) {
          jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
            if (err) throw err;
            return res.cookie("token", token).json({
              id: userDoc._id,
              username,
            });
          });
          //   return res.status(200).send("Logged in successfully!");
        } else {
          return res.status(401).send("Password is incorrect");
        }
      });
    } else {
      res.status(400).send("user not found!");
    }
  } catch (err) {
    res.status(400).json(err);
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, secret, {}, (err, info) => {
      if (err) {
        // Handle token verification error
        console.error(err);
        res.status(401).json("Invalid token");
      } else {
        res.json(info);
      }
    });
  }
});

app.get("/post", async (req, res) => {
  const posts = await Post.find()
    .populate("author", ["username"])
    .sort({ createdAt: -1 })
    .limit(20);
  res.json(posts);
});

app.post("/post", upload.single("files"), async (req, res) => {
  try {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) throw err;
      const { title, summary, content } = req.body;
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(postDoc);
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to process uploaded files" });
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

app.put("/post", upload.single("files"), async (req, res) => {
  try {
    let newPath = null;
    if (req.file) {
      const { originalname, path } = req.file;
      const parts = originalname.split(".");
      const ext = parts[parts.length - 1];
      const newPath = path + "." + ext;
      fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) throw err;
      const { title, summary, content, id } = req.body;
      const postDoc = await Post.findById(id);
      const isAuthor =
        JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json("You are not the author");
      }

      await postDoc.updateOne({
        title,
        summary,
        content,
        cover: newPath ? newPath : postDoc.cover,
      });
      return res.json(postDoc);
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to process uploaded files" });
  }
});

app.listen(4000, () => {
  console.log("server is running");
});
