// index.js
require('dotenv').config();          // 1) load env vars right away

const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const cookieParser = require('cookie-parser');
const multer     = require('multer');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');

const User = require('./models/User');
const Post = require('./models/Post');

const app = express();
const salt   = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET;

// 2) Connect to MongoDB (local or remote based on .env)
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/myBlogDatabase';
mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected:', mongoUri))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

const uploadMiddleware = multer({ dest: 'uploads/' });

const VIEW_COOKIE_PREFIX = 'viewed_';

// ─── AUTH ROUTES ─────────────────────────────────────────────────

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.error(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token).json({ id: userDoc._id, username });
    });
  } else {
    res.status(400).json('wrong credentials');
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

// ─── POSTS ROUTES ────────────────────────────────────────────────

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const ext    = originalname.split('.').pop();
  const newPath = `${path}.${ext}`;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title, summary, content,
      cover: newPath,
      author: info.id,
    });
    res.json(postDoc);
  });
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const ext = originalname.split('.').pop();
    newPath = `${path}.${ext}`;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = postDoc.author.toString() === info.id;
    if (!isAuthor) return res.status(400).json('you are not the author');

    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath || postDoc.cover,
    });
    res.json(postDoc);
  });
});

app.get('/post', async (req, res) => {
  const posts = await Post.find()
    .populate('author', ['username'])
    .sort({ createdAt: -1 })
    .limit(20);
  res.json(posts);
});

app.get('/post/:id', async (req, res) => {
  const postId = req.params.id;
  let viewerKey = null;
  let increment = false;

  // Try to use user id if logged in, else fallback to cookie
  let userId = null;
  if (req.cookies.token) {
    try {
      const info = jwt.verify(req.cookies.token, secret);
      userId = info.id;
    } catch (e) {}
  }
  if (userId) {
    viewerKey = VIEW_COOKIE_PREFIX + postId + "_user_" + userId;
    if (!req.cookies[viewerKey]) {
      increment = true;
      res.cookie(viewerKey, '1', { maxAge: 1000 * 60 * 60 * 24 * 7 }); // 7 days
    }
  } else {
    viewerKey = VIEW_COOKIE_PREFIX + postId;
    if (!req.cookies[viewerKey]) {
      increment = true;
      res.cookie(viewerKey, '1', { maxAge: 1000 * 60 * 60 * 24 * 7 }); // 7 days
    }
  }

  let postDoc;
  if (increment) {
    postDoc = await Post.findByIdAndUpdate(
      postId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', ['username']);
  } else {
    postDoc = await Post.findById(postId).populate('author', ['username']);
  }
  res.json(postDoc);
});

app.get('/post/:id/comments', async (req, res) => {
  const postDoc = await Post.findById(req.params.id).populate('comments.user', ['username']);
  if (!postDoc) return res.status(404).json('Post not found');
  res.json(postDoc.comments || []);
});

app.post('/post/:id/comment', async (req, res) => {
  const { token } = req.cookies;
  const { text } = req.body;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    const postDoc = await Post.findById(req.params.id);
    if (!postDoc) return res.status(404).json('Post not found');
    postDoc.comments = (postDoc.comments || []).filter(c => c.user.toString() !== info.id);
    postDoc.comments.push({
      user: info.id,
      username: info.username,
      text,
    });
    await postDoc.save();
    res.json(postDoc.comments);
  });
});

app.delete('/post/:id/comment/:commentId', async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    const postDoc = await Post.findById(req.params.id);
    if (!postDoc) return res.status(404).json('Post not found');
    const commentIdx = postDoc.comments.findIndex(
      c => c._id.toString() === req.params.commentId && c.user.toString() === info.id
    );
    if (commentIdx === -1) return res.status(403).json('Not allowed');
    postDoc.comments.splice(commentIdx, 1);
    await postDoc.save();
    res.json(postDoc.comments);
  });
});

app.delete('/post/:id', async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    const postDoc = await Post.findById(req.params.id);
    if (!postDoc) return res.status(404).json('Post not found');
    const isAuthor = postDoc.author.toString() === info.id;
    if (!isAuthor) return res.status(403).json('You are not the author');
    await Post.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  });
});

// Add or remove a reaction (only one per user per post)
app.post('/post/:id/react', async (req, res) => {
  const { token } = req.cookies;
  const { reaction } = req.body; // e.g. 'like', 'love'
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    const postDoc = await Post.findById(req.params.id);
    if (!postDoc) return res.status(404).json('Post not found');
    const userId = info.id;

    // Remove user from all reactions
    for (let [key, arr] of postDoc.reactions.entries()) {
      postDoc.reactions.set(key, arr.filter(id => id !== userId));
    }

    // Toggle reaction: add if not present, remove if already present
    let arr = postDoc.reactions.get(reaction) || [];
    if (!arr.includes(userId)) {
      arr.push(userId);
      postDoc.reactions.set(reaction, arr);
    } else {
      // Already removed above, so do nothing (user unreacted)
    }

    await postDoc.save();
    res.json(postDoc.reactions);
  });
});

// ─── START SERVER ─────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
