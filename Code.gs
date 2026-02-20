/* 🚀 SOCIALHUB MASTER SERVER v6.0 (Hybrid Speed Edition) */

const CONFIG = {
  SHEETS: {
    USERS: "users",
    POSTS: "posts",
    FRIEND_REQS: "friend_requests"
  }
};

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    let params;
    if (e.postData && e.postData.contents) {
      const payload = JSON.parse(e.postData.contents);
      params = { action: payload.action, ...payload.data };
    } else {
      params = e.parameter;
    }

    const action = params.action;
    const db = new Database();

    switch (action) {
      // --- AUTH ---
      case "LOGIN":
        return res(db.login(params.email, params.password));
      case "SIGNUP":
        return res(db.signup(params));
      case "UPDATE_USER":
        return res(db.updateUser(params));
      case "GET_PROFILE":
        return res(db.getProfile(params.id));
      case "GET_USERS":
        return res(db.getRows(CONFIG.SHEETS.USERS).map(u => { delete u.password; return u; }));

      // --- MEGA SYNC (Flash Fast Efficiency) ---
      case "MEGA_SYNC":
        return res({
          posts: db.getPosts().slice(0, 50), 
          users: db.getRows(CONFIG.SHEETS.USERS).map(u => ({ id: u.id, username: u.username, avatar: u.avatar })),
          requests: params.user_id ? db.getFriendRequests(params.user_id) : [],
          server_time: new Date().toISOString()
        });

      // --- POSTS ---
      case "GET_ALL_POSTS":
        return res(db.getPosts());
      case "GET_USER_POSTS":
        return res(db.getUserPosts(params.user_id));
      case "ADD_POST":
        return res(db.addRow(CONFIG.SHEETS.POSTS, params));
      case "DELETE_POST":
        return res(db.deleteRow(CONFIG.SHEETS.POSTS, "id", params.id));
      case "UPDATE_POST":
        return res(db.updateRow(CONFIG.SHEETS.POSTS, "id", params.id, params));

      // --- FRIENDS ---
      case "ADD_FRIEND_REQUEST":
        return res(db.addFriendRequest(params.sender_id, params.receiver_id));
      case "ACCEPT_FRIEND_REQUEST":
        return res(db.acceptFriendRequest(params.user_id, params.friend_id));
      case "GET_FRIEND_REQUESTS":
        return res(db.getFriendRequests(params.id));
      case "GET_SENT_REQUESTS":
        return res(db.getSentRequests(params.id));
      case "DELETE_FRIEND_REQUEST":
        return res(db.deleteFriendRequest(params.sender_id, params.receiver_id));
      case "REMOVE_FRIEND":
        return res(db.removeFriend(params.user_id, params.friend_id));

      default:
        return res({ success: false, msg: "Action not found: " + action });
    }
  } catch (err) {
    return res({ success: false, msg: err.toString(), stack: err.stack });
  }
}

// --- DATABASE ENGINE (Optimized) ---
class Database {
  constructor() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.sheetCache = {};
    this.rowCache = {};
  }

  getSheet(name) {
    if (!this.sheetCache[name]) {
      this.sheetCache[name] = this.ss.getSheetByName(name);
      if (!this.sheetCache[name]) {
        this.sheetCache[name] = this.ss.insertSheet(name);
        if (name === CONFIG.SHEETS.USERS) this.sheetCache[name].appendRow(["id", "username", "email", "password", "avatar", "bio", "friends", "created_at"]);
        if (name === CONFIG.SHEETS.POSTS) this.sheetCache[name].appendRow(["id", "user_id", "username", "avatar", "image", "caption", "likes", "liked_by", "visibility", "created_at"]);
        if (name === CONFIG.SHEETS.FRIEND_REQS) this.sheetCache[name].appendRow(["id", "sender_id", "receiver_id", "status", "created_at"]);
      }
    }
    return this.sheetCache[name];
  }

  getRows(sheetName) {
    if (this.rowCache[sheetName]) return this.rowCache[sheetName];
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data.shift();
    const rows = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    this.rowCache[sheetName] = rows;
    return rows;
  }

  // --- Core Auth Logic ---

  login(identifier, password) {
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const idLower = String(identifier).toLowerCase();
    const user = users.find(u => 
      (String(u.email).toLowerCase() === idLower || String(u.username).toLowerCase() === idLower) && 
      String(u.password) === String(password)
    );
    if (user) {
      const sessionUser = { ...user };
      delete sessionUser.password;
      return { success: true, user: sessionUser };
    }
    return { success: false, msg: "Invalid email/username or password" };
  }

  signup(userData) {
    const users = this.getRows(CONFIG.SHEETS.USERS);
    if (users.some(u => String(u.email).toLowerCase() === String(userData.email).toLowerCase())) return { success: false, msg: "Email already exists" };
    if (users.some(u => String(u.username).toLowerCase() === String(userData.username).toLowerCase())) return { success: false, msg: "Username already taken" };
    return this.addRow(CONFIG.SHEETS.USERS, userData);
  }

  updateUser(userData) {
    return { success: this.updateRow(CONFIG.SHEETS.USERS, "id", userData.id, userData) };
  }

  getProfile(id) {
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const user = users.find(u => String(u.id) === String(id));
    if (user) {
      const u = { ...user };
      delete u.password;
      return u;
    }
    return null;
  }

  // --- Optimized Posts (with JOIN) ---

  getPosts() {
    const posts = this.getRows(CONFIG.SHEETS.POSTS);
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const userMap = {};
    users.forEach(u => userMap[String(u.id)] = { username: u.username, avatar: u.avatar });

    return posts.map(p => {
      // Speed Optimization: Backend injection of profile data
      p.profiles = userMap[String(p.user_id)] || { username: p.username, avatar: p.avatar };
      return p;
    }).reverse();
  }

  getUserPosts(userId) {
    const posts = this.getPosts();
    return posts.filter(p => String(p.user_id) === String(userId));
  }

  // --- Optimized Friend System ---

  addFriendRequest(senderId, receiverId) {
    const reqs = this.getRows(CONFIG.SHEETS.FRIEND_REQS);
    const existing = reqs.find(r => 
      (String(r.sender_id) === String(senderId) && String(r.receiver_id) === String(receiverId)) ||
      (String(r.sender_id) === String(receiverId) && String(r.receiver_id) === String(senderId))
    );
    
    if (existing) {
      if (existing.status === 'pending') return { success: true, msg: "Request already pending" };
      if (existing.status === 'accepted') return { success: true, msg: "Already friends" };
    }
    
    return this.addRow(CONFIG.SHEETS.FRIEND_REQS, {
      id: "req_" + Date.now(),
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
      created_at: new Date().toISOString()
    });
  }

  acceptFriendRequest(userId, friendId) {
    const sheet = this.getSheet(CONFIG.SHEETS.FRIEND_REQS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const sIdx = headers.indexOf("sender_id");
    const rIdx = headers.indexOf("receiver_id");
    const stIdx = headers.indexOf("status");

    let found = false;
    for (let i = 1; i < data.length; i++) {
        const rowSender = String(data[i][sIdx]);
        const rowReceiver = String(data[i][rIdx]);
        if ((rowSender === String(friendId) && rowReceiver === String(userId)) || 
            (rowSender === String(userId) && rowReceiver === String(friendId))) {
          sheet.getRange(i + 1, stIdx + 1).setValue("accepted");
          found = true;
          break;
        }
    }

    if (found) {
      this.modifyFriends(userId, friendId, "add");
      this.modifyFriends(friendId, userId, "add");
    }
    
    return { success: true };
  }

  modifyFriends(userId, targetId, action) {
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const userIndex = users.findIndex(u => String(u.id) === String(userId));
    if (userIndex === -1) return;

    const user = users[userIndex];
    let friends = [];
    try { 
      friends = typeof user.friends === 'string' ? JSON.parse(user.friends || "[]") : (Array.isArray(user.friends) ? user.friends : []); 
    } catch(e) { friends = []; }
    
    if (action === "add" && !friends.includes(String(targetId))) friends.push(String(targetId));
    if (action === "remove") friends = friends.filter(id => String(id) !== String(targetId));

    const sheet = this.getSheet(CONFIG.SHEETS.USERS);
    const headers = sheet.getDataRange().getValues()[0];
    const fIdx = headers.indexOf("friends");
    sheet.getRange(userIndex + 2, fIdx + 1).setValue(JSON.stringify(friends));
  }

  getFriendRequests(id) {
    const reqs = this.getRows(CONFIG.SHEETS.FRIEND_REQS);
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const userMap = {};
    users.forEach(u => userMap[String(u.id)] = { username: u.username, avatar: u.avatar, bio: u.bio });

    return reqs
      .filter(r => String(r.receiver_id) === String(id) && r.status === "pending")
      .map(r => {
        // Enriched request with sender profile to save frontend calls
        r.sender_profile = userMap[String(r.sender_id)] || { username: "Unknown" };
        return r;
      });
  }

  getSentRequests(id) {
    const reqs = this.getRows(CONFIG.SHEETS.FRIEND_REQS);
    return reqs.filter(r => String(r.sender_id) === String(id) && r.status === "pending");
  }

  deleteFriendRequest(senderId, receiverId) {
    const sheet = this.getSheet(CONFIG.SHEETS.FRIEND_REQS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const sIdx = headers.indexOf("sender_id");
    const rIdx = headers.indexOf("receiver_id");

    for (let i = data.length - 1; i >= 1; i--) {
      const rowSender = String(data[i][sIdx]);
      const rowReceiver = String(data[i][rIdx]);
      if ((rowSender === String(senderId) && rowReceiver === String(receiverId)) ||
          (rowSender === String(receiverId) && rowReceiver === String(senderId))) {
        sheet.deleteRow(i + 1);
      }
    }
    return { success: true };
  }

  removeFriend(userId, friendId) {
    this.modifyFriends(userId, friendId, "remove");
    this.modifyFriends(friendId, userId, "remove");
    this.deleteFriendRequest(userId, friendId); 
    return { success: true };
  }

  // --- CRUD Engine ---

  addRow(sheetName, obj) {
    const sheet = this.getSheet(sheetName);
    const headers = sheet.getDataRange().getValues()[0];
    const row = headers.map(h => obj[h] !== undefined ? obj[h] : "");
    sheet.appendRow(row);
    return { success: true };
  }

  updateRow(sheetName, key, value, newData) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colIndex = headers.indexOf(key);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colIndex]) === String(value)) {
        const newRow = headers.map(h => newData[h] !== undefined ? newData[h] : data[i][headers.indexOf(h)]);
        sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
        return true;
      }
    }
    return false;
  }

  deleteRow(sheetName, key, value) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colIndex = headers.indexOf(key);
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][colIndex]) === String(value)) {
        sheet.deleteRow(i + 1);
      }
    }
    return { success: true };
  }
}

function res(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
