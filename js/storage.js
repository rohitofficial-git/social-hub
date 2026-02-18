const Storage = {
    // Utility to call Google Apps Script
    async callAPI(action, target, data = {}) {
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action, target, data })
            });
            return await res.json();
        } catch (e) {
            console.error("API Call failed:", e);
            return null;
        }
    },

    // Profiles
    async getProfile(userId) {
        return await this.callAPI("GET_PROFILE", "users", { id: userId });
    },

    async getUserByUsername(username) {
        const users = await this.getAllUsers();
        return users.find(u => u.username === username.toLowerCase()) || null;
    },

    async getAllUsers() {
        const res = await fetch(`${API_URL}?action=GET_USERS`);
        if (!res.ok) return [];
        return await res.json();
    },

    // Friend Requests
    async getFriendRequests(userId) {
        const res = await fetch(`${API_URL}?action=GET_FRIEND_REQUESTS&id=${userId}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getSentRequests(userId) {
        const res = await fetch(`${API_URL}?action=GET_SENT_REQUESTS&id=${userId}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async sendFriendRequest(senderId, receiverId) {
        return await this.callAPI("ADD_FRIEND_REQUEST", "friend_requests", { sender_id: senderId, receiver_id: receiverId });
    },

    async deleteFriendRequest(senderId, receiverId) {
        return await this.callAPI("DELETE_FRIEND_REQUEST", "friend_requests", { sender_id: senderId, receiver_id: receiverId });
    },

    // Posts
    async getPosts() {
        const res = await fetch(`${API_URL}?action=GET_ALL_POSTS`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getUserPosts(userId) {
        const res = await fetch(`${API_URL}?action=GET_USER_POSTS&user_id=${userId}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async savePost(post) {
        return await this.callAPI("ADD_POST", "posts", post);
    },

    // Session
    getCurrentUser() {
        let user = JSON.parse(localStorage.getItem('socialhub_user'));
        if (user && typeof user.friends === 'string') user.friends = JSON.parse(user.friends);
        return user || null;
    },

    setCurrentUser(user) {
        localStorage.setItem('socialhub_user', JSON.stringify(user));
    },

    clearCurrentUser() {
        localStorage.removeItem('socialhub_user');
    }
};
