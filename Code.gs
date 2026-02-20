/* 🚀 SOCIALHUB MASTER SERVER v6.0 (Hybrid Speed Edition) */

const CONFIG = {
  SHEETS: {
    USERS: "users",
    POSTS: "posts",
    FRIEND_REQS: "friend_requests",
    NOTIFICATIONS: "notifications"
  }
};

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  try {
    // 1. Wait for up to 30 seconds for the lock
    lock.waitLock(30000);

    let params;
    if (e.postData && e.postData.contents) {
      const payload = JSON.parse(e.postData.contents);
      params = { action: payload.action, ...payload.data };
    } else {
      params = e.parameter;
    }

    const action = params.action;
    const db = new Database();

    let responseData;
    switch (action) {
      // --- AUTH ---
      case "LOGIN":
        responseData = db.login(params.email, params.password);
        break;
      case "SIGNUP":
        responseData = db.signup(params);
        break;
      case "UPDATE_USER":
        responseData = db.updateUser(params);
        break;
      case "GET_PROFILE":
        responseData = db.getProfile(params.id);
        break;
      case "GET_USERS":
        responseData = db.getRows(CONFIG.SHEETS.USERS).map(u => { delete u.password; return u; });
        break;

      // --- MEGA SYNC ---
      case "MEGA_SYNC":
        responseData = {
          posts: db.getPosts().slice(0, 50), 
          users: db.getRows(CONFIG.SHEETS.USERS).map(u => ({ id: u.id, username: u.username, avatar: u.avatar })),
          requests: params.user_id ? db.getFriendRequests(params.user_id) : [],
          notifications: params.user_id ? db.getNotifications(params.user_id) : [],
          server_time: new Date().toISOString()
        };
        break;

      // --- POSTS ---
      case "GET_ALL_POSTS":
        responseData = db.getPosts();
        break;
      case "GET_USER_POSTS":
        responseData = db.getUserPosts(params.user_id);
        break;
      case "ADD_POST":
        responseData = db.addRow(CONFIG.SHEETS.POSTS, params);
        break;
      case "DELETE_POST":
        responseData = db.deleteRow(CONFIG.SHEETS.POSTS, "id", params.id);
        break;
      case "UPDATE_POST":
        responseData = db.updateRow(CONFIG.SHEETS.POSTS, "id", params.id, params);
        break;

      // --- FRIENDS ---
      case "ADD_FRIEND_REQUEST":
        responseData = db.addFriendRequest(params.sender_id, params.receiver_id);
        break;
      case "ACCEPT_FRIEND_REQUEST":
        responseData = db.acceptFriendRequest(params.user_id, params.friend_id);
        break;
      case "GET_FRIEND_REQUESTS":
        responseData = db.getFriendRequests(params.id);
        break;
      case "GET_SENT_REQUESTS":
        responseData = db.getSentRequests(params.id);
        break;
      case "DELETE_FRIEND_REQUEST":
        responseData = db.deleteFriendRequest(params.sender_id, params.receiver_id);
        break;
      case "REMOVE_FRIEND":
        responseData = db.removeFriend(params.user_id, params.friend_id);
        break;

      // --- NOTIFICATIONS ---
      case "GET_NOTIFICATIONS":
        responseData = db.getNotifications(params.id);
        break;
      case "ADD_NOTIFICATION":
        responseData = db.addRow(CONFIG.SHEETS.NOTIFICATIONS, params);
        break;
      case "DELETE_NOTIFICATION":
        responseData = db.deleteRow(CONFIG.SHEETS.NOTIFICATIONS, "id", params.id);
        break;

      default:
        responseData = { success: false, msg: "Action not found: " + action };
    }

    // Release lock before sending response
    lock.releaseLock();
    return res(responseData);

  } catch (err) {
    if (lock.hasLock()) lock.releaseLock();
    return res({ success: false, msg: err.toString(), stack: err.stack });
  }
}

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
        if (name === CONFIG.SHEETS.NOTIFICATIONS) this.sheetCache[name].appendRow(["id", "user_id", "sender_id", "type", "post_id", "message", "created_at"]);
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

  getPosts() {
    const posts = this.getRows(CONFIG.SHEETS.POSTS);
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const userMap = {};
    users.forEach(u => userMap[String(u.id)] = { username: u.username, avatar: u.avatar });

    return posts.map(p => {
      p.profiles = userMap[String(p.user_id)] || { username: p.username, avatar: p.avatar };
      return p;
    }).reverse();
  }

  getUserPosts(userId) {
    const posts = this.getPosts();
    return posts.filter(p => String(p.user_id) === String(userId));
  }

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

  getNotifications(id) {
    const rows = this.getRows(CONFIG.SHEETS.NOTIFICATIONS);
    const users = this.getRows(CONFIG.SHEETS.USERS);
    const userMap = {};
    users.forEach(u => userMap[String(u.id)] = { username: u.username, avatar: u.avatar });

    return rows
      .filter(n => String(n.user_id) === String(id))
      .map(n => {
        n.sender_profile = userMap[String(n.sender_id)] || { username: "Someone" };
        return n;
      }).reverse().slice(0, 30);
  }

  addRow(sheetName, obj) {
    const sheet = this.getSheet(sheetName);
    const headers = sheet.getDataRange().getValues()[0];
    const row = headers.map(h => {
      const val = obj[h] !== undefined ? obj[h] : "";
      return (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
    });
    sheet.appendRow(row);
    // Force spreadsheet flush to ensure immediate write
    SpreadsheetApp.flush();
    return { success: true };
  }

  updateRow(sheetName, key, value, newData) {
    const sheet = this.getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colIndex = headers.indexOf(key);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colIndex]) === String(value)) {
        const newRow = headers.map(h => {
          const val = newData[h] !== undefined ? newData[h] : data[i][headers.indexOf(h)];
          return (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
        });
        sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, msg: "Row not found" };
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
    SpreadsheetApp.flush();
    return { success: true };
  }
}

function res(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
