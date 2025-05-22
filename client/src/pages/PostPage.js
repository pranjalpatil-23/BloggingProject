import {useContext, useEffect, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {formatISO9075} from "date-fns";
import {UserContext} from "../UserContext";
import {Link} from 'react-router-dom';

export default function PostPage() {
  const [postInfo,setPostInfo] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const {userInfo} = useContext(UserContext);
  const {id} = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`http://localhost:4000/post/${id}`)
      .then(response => {
        response.json().then(postInfo => {
          setPostInfo(postInfo);
        });
      });
    fetch(`http://localhost:4000/post/${id}/comments`)
      .then(res => res.json())
      .then(setComments);
  }, [id]);

  async function deletePost() {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    const response = await fetch(`http://localhost:4000/post/${postInfo._id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (response.ok) {
      navigate('/');
    } else {
      alert('Failed to delete post');
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    setCommentLoading(true);
    const res = await fetch(`http://localhost:4000/post/${id}/comment`, {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ text: commentText }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComments(updated);
      setCommentText('');
    }
    setCommentLoading(false);
  }

  async function deleteComment(commentId) {
    if (!window.confirm('Delete your comment?')) return;
    const res = await fetch(`http://localhost:4000/post/${id}/comment/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      const updated = await res.json();
      setComments(updated);
    }
  }

  const userComment = userInfo?.id && comments.find(c => c.user === userInfo.id || c.user?._id === userInfo.id);

  if (!postInfo) return '';

  return (
    <div className="post-page">
      <h1>{postInfo.title}</h1>
      <time>{formatISO9075(new Date(postInfo.createdAt))}</time>
      <div className="author">by @{postInfo.author.username}</div>
      {userInfo.id === postInfo.author._id && (
        <div className="edit-row" style={{display: "flex", justifyContent: "center", gap: "10px"}}>
          <Link className="edit-btn" to={`/edit/${postInfo._id}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit post
          </Link>
          <button className="delete-btn small" onClick={deletePost}>
            Delete post
          </button>
        </div>
      )}
      <div className="image">
        <img src={`http://localhost:4000/${postInfo.cover}`} alt=""/>
      </div>
      <div className="content" dangerouslySetInnerHTML={{__html:postInfo.content}} />
      <div className="comments-section" style={{marginTop: 40}}>
        <h3>Comments</h3>
        {userInfo?.id && !userComment && (
          <form onSubmit={submitComment} style={{marginBottom: 20}}>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write your comment..."
              required
              rows={3}
              style={{width: "100%", borderRadius: 8, padding: 8, border: "1.5px solid #2563eb", marginBottom: 8}}
              disabled={commentLoading}
            />
            <button type="submit" disabled={commentLoading || !commentText.trim()} style={{width: "auto", minWidth: 120}}>
              {commentLoading ? "Posting..." : "Post Comment"}
            </button>
          </form>
        )}
        {userInfo?.id && userComment && (
          <div style={{marginBottom: 20, color: "#2563eb", display: "flex", alignItems: "center", gap: 10}}>
            You commented: <span style={{fontStyle: "italic"}}>{userComment.text}</span>
          </div>
        )}
        {comments.length === 0 && <div style={{color: "#64748b"}}>No comments yet.</div>}
        <ul style={{listStyle: "none", padding: 0}}>
          {comments.map((c, idx) => (
            <li key={c._id || c.user?._id || c.user || idx} style={{
              background: "#f3f4f6",
              color: "#222",
              borderRadius: 8,
              marginBottom: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span>
                <b>@{c.username || (c.user && c.user.username) || "user"}:</b> {c.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}