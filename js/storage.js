const Storage = {
    // Utility to call Google Apps Script via GET (avoids CORS issues)
    async callAPI(action, data = {}) {
        try {
            const params = new URLSearchParams({ action, ...data });
            const res = await fetch(`${API_URL}?${params.toString()}`);
            return await res.json();
        } catch (e) {
            console.error("API Call failed:", e);
            return { success: false, msg: "Connection error" };
        }
    },

    // Profiles
    async getProfile(userId) {
        const user = await this.callAPI("GET_PROFILE", { id: userId });
        return this.fixUserData(user);
    },

    fixUserData(user) {
        if (!user || !user.id) return null;
        if (typeof user.friends === 'string') {
            try { user.friends = JSON.parse(user.friends); } catch (e) { user.friends = []; }
        }
        if (!Array.isArray(user.friends)) user.friends = [];
        return user;
    },

    async getUserByUsername(username) {
        const users = await this.getAllUsers();
        return users.find(u => u.username === username.toLowerCase()) || null;
    },

    async getAllUsers() {
        try {
            const res = await fetch(`${API_URL}?action=GET_USERS`);
            return await res.json() || [];
        } catch (e) { return []; }
    },

    // Friend Requests
    async getFriendRequests(userId) {
        try {
            const res = await fetch(`${API_URL}?action=GET_FRIEND_REQUESTS&id=${userId}`);
            return await res.json() || [];
        } catch (e) { return []; }
    },

    async getSentRequests(userId) {
        try {
            const res = await fetch(`${API_URL}?action=GET_SENT_REQUESTS&id=${userId}`);
            return await res.json() || [];
        } catch (e) { return []; }
    },

    async sendFriendRequest(senderId, receiverId) {
        return await this.callAPI("ADD_FRIEND_REQUEST", { sender_id: senderId, receiver_id: receiverId });
    },

    // Posts
    async getPosts() {
        try {
            const res = await fetch(`${API_URL}?action=GET_ALL_POSTS`);
            const posts = await res.json() || [];
            return posts.map(p => {
                if (typeof p.liked_by === 'string') {
                    try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
                }
                if (!Array.isArray(p.liked_by)) p.liked_by = [];
                return p;
            });
        } catch (e) { return []; }
    },

    async getUserPosts(userId) {
        try {
            const res = await fetch(`${API_URL}?action=GET_USER_POSTS&user_id=${userId}`);
            return await res.json() || [];
        } catch (e) { return []; }
    },

    async savePost(post) {
        return await this.callAPI("ADD_POST", post);
    },

    // Session
    getCurrentUser() {
        try {
            const user = JSON.parse(localStorage.getItem('socialhub_user'));
            return this.fixUserData(user);
        } catch (e) { return null; }
    },

    setCurrentUser(user) {
        localStorage.setItem('socialhub_user', JSON.stringify(user));
    },

    clearCurrentUser() {
        localStorage.removeItem('socialhub_user');
    }
};
