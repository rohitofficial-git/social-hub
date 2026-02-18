const Storage = {
    // Utility to call Google Apps Script
    async callAPI(action, target, data = {}) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                mode: "no-cors", // Crucial for Google Apps Script redirects
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, target, data })
            });
            // Note: with no-cors, we can't see the response. 
            // Better to use a trick: use a normal fetch and wait for redirect.

            const realResponse = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action, target, data })
            });
            return await realResponse.json();
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

    async saveUser(user) {
        // This is handled by updateProfile in auth.js or LOGIN/SIGNUP
        return await this.callAPI("UPDATE_USER", "users", user);
    },

    async getAllUsers() {
        const res = await fetch(`${API_URL}?action=GET_USERS`);
        if (!res.ok) return [];
        return await res.json();
    },

    async deleteUserProfile(userId) {
        return await this.callAPI("DELETE_USER", "users", { id: userId });
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

    async deletePost(postId) {
        return await this.callAPI("DELETE_POST", "posts", { id: postId });
    },

    async updatePost(postId, updates) {
        return await this.callAPI("UPDATE_POST", "posts", { id: postId, ...updates });
    },

    // Session
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('socialhub_user')) || null;
    },

    setCurrentUser(user) {
        localStorage.setItem('socialhub_user', JSON.stringify(user));
    },

    clearCurrentUser() {
        localStorage.removeItem('socialhub_user');
    }
};
