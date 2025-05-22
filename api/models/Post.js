const mongoose = require('mongoose');
const {Schema,model} = mongoose;

const PostSchema = new Schema({
  title:String,
  summary:String,
  content:String,
  cover:String,
  author:{type:Schema.Types.ObjectId, ref:'User'},
  reactions: {
    type: Map,
    of: [String], // Array of user IDs for each reaction type
    default: {},
  },
  comments: [
    {
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      username: String,
      text: String,
    }
  ],
  views: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const PostModel = model('Post', PostSchema);

module.exports = PostModel;