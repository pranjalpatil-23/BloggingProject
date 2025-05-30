import {Link} from "react-router-dom";
import {useContext, useEffect} from "react";
import {UserContext} from "./UserContext";
import {DarkModeContext} from "./App";

export default function Header() {
  const {setUserInfo,userInfo} = useContext(UserContext);
  const {dark, setDark} = useContext(DarkModeContext);

  useEffect(() => {
    fetch('http://localhost:4000/profile', {
      credentials: 'include',
    }).then(response => {
      response.json().then(userInfo => {
        setUserInfo(userInfo);
      });
    });
  }, []);

  function logout() {
    fetch('http://localhost:4000/logout', {
      credentials: 'include',
      method: 'POST',
    });
    setUserInfo(null);
  }

  const username = userInfo?.username;

  return (
    <header>
      <Link to="/" className="logo">Blogger</Link>
      <nav>
        <button
          className="darkmode-btn"
          type="button"
          onClick={() => setDark(d => !d)}
          title="Toggle dark mode"
        >
          {dark ? "🌙" : "☀️"}
        </button>
        {username && (
          <>
            <Link to="/create">Create new post</Link>
            <a onClick={logout}>Logout ({username})</a>
          </>
        )}
        {!username && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
