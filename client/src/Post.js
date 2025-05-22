import {formatISO9075} from "date-fns";
import {Link} from "react-router-dom";
import {useContext, useState} from "react";
import {UserContext} from "./UserContext";

const REACTIONS = [
  { type: "like", emoji: "👍" },
  { type: "love", emoji: "❤️" },
  { type: "laugh", emoji: "😂" },
  { type: "dislike", emoji: "👎" }
];

export default function Post({_id,title,summary,cover,content,createdAt,author,reactions}) {
  const {userInfo} = useContext(UserContext);
  const [localReactions, setLocalReactions] = useState(reactions || {});

  async function handleReaction(type) {
    const res = await fetch(`http://localhost:4000/post/${_id}/react`, {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({reaction: type}),
    });
    if (res.ok) {
      const updated = await res.json();
      setLocalReactions(updated);
    }
  }

  function reactionCount(type) {
    return localReactions && localReactions[type] ? localReactions[type].length : 0;
  }

  function userReacted(type) {
    // Only one reaction per user, so check if userId is in this type
    return localReactions && localReactions[type] && userInfo?.id && localReactions[type].includes(userInfo.id);
  }

  function userReactionType() {
    if (!userInfo?.id) return null;
    for (const type in localReactions) {
      if (localReactions[type] && localReactions[type].includes(userInfo.id)) {
        return type;
      }
    }
    return null;
  }

  return (
    <div className="post">
      <div className="image">
        <Link to={`/post/${_id}`}>
          <img src={'http://localhost:4000/'+cover} alt=""/>
        </Link>
      </div>
      <div className="texts">
        <Link to={`/post/${_id}`}>
        <h2>{title}</h2>
        </Link>
        <p className="info">
          <a className="author">{author.username}</a>
          <time>{formatISO9075(new Date(createdAt))}</time>
        </p>
        <p className="summary">{summary}</p>
        <div className="reactions-row">
          {REACTIONS.map(r => (
            <button
              key={r.type}
              className={`reaction-btn${userReacted(r.type) ? " reacted" : ""}`}
              type="button"
              onClick={() => handleReaction(r.type)}
              disabled={!userInfo?.id}
              title={!userInfo?.id ? "Login to react" : ""}
            >
              {r.emoji} {reactionCount(r.type) > 0 ? reactionCount(r.type) : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}