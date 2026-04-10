// api.js
// Broen mellom React-frontend og Node.js-backend

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("helptruth_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Noe gikk galt");
  return data;
}

// Fil-opplasting (FormData, ikke JSON)
async function uploadFile(path, file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Opplasting feilet");
  return data;
}

// ── AUTH ──────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login:    (data) => request("/auth/login",    { method: "POST", body: data }),
  me:       ()     => request("/auth/me"),
};

// ── POSTS ─────────────────────────────────────────────────────────────────
export const postsAPI = {
  getFeed:      (page = 1)    => request(`/posts?page=${page}`),
  getFollowing: (page = 1)    => request(`/posts/following?page=${page}`),
  getOne:       (id)          => request(`/posts/${id}`),
  create:       (data)        => request("/posts", { method: "POST", body: data }),
  delete:       (id)          => request(`/posts/${id}`, { method: "DELETE" }),
  like:         (id)          => request(`/posts/${id}/like`,     { method: "POST" }),
  repost:       (id)          => request(`/posts/${id}/repost`,   { method: "POST" }),
  bookmark:     (id)          => request(`/posts/${id}/bookmark`, { method: "POST" }),
  getBookmarks: ()            => request("/posts/bookmarks/all"),
  reply:        (id, content, image_url) => request(`/posts/${id}/reply`, { method: "POST", body: { content, image_url } }),
  getReplies:   (id)          => request(`/posts/${id}/replies`),
  vote:         (id, optIdx)  => request(`/posts/${id}/vote`, { method: "POST", body: { option_index: optIdx } }),
};

// ── USERS ─────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile:  (handle)         => request(`/users/${handle}`),
  getPosts:    (handle, page=1) => request(`/users/${handle}/posts?page=${page}`),
  follow:      (handle)         => request(`/users/${handle}/follow`, { method: "POST" }),
  search:      (q)              => request(`/users/search/query?q=${encodeURIComponent(q)}`),
  updateMe:    (data)           => request("/users/me/update", { method: "PUT", body: data }),
};

// ── UPLOAD ────────────────────────────────────────────────────────────────
export const uploadAPI = {
  image:  (file) => uploadFile("/upload", file),
  avatar: (file) => uploadFile("/upload/avatar", file),
};

// ── MESSAGES ──────────────────────────────────────────────────────────────
export const messagesAPI = {
  getConversations: ()          => request("/messages/conversations"),
  getMessages:      (userId)    => request(`/messages/${userId}`),
  send:             (data)      => request("/messages", { method: "POST", body: data }),
  unreadCount:      ()          => request("/messages/unread/count"),
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll:       (page = 1) => request(`/notifications?page=${page}`),
  unreadCount:  ()         => request("/notifications/unread/count"),
  readAll:      ()         => request("/notifications/read-all", { method: "PUT" }),
  read:         (id)       => request(`/notifications/${id}/read`, { method: "PUT" }),
};

// ── SEARCH ────────────────────────────────────────────────────────────────
export const searchAPI = {
  search:  (q, type = "all") => request(`/search?q=${encodeURIComponent(q)}&type=${type}`),
  hashtag: (tag, page = 1)   => request(`/search/hashtag/${encodeURIComponent(tag)}?page=${page}`),
};

// ── TOKEN ─────────────────────────────────────────────────────────────────
export function saveToken(token) { localStorage.setItem("helptruth_token", token); }
export function removeToken()    { localStorage.removeItem("helptruth_token"); }
export function isLoggedIn()     { return !!getToken(); }
