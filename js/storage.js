const Storage = {
    profileCache: {},

    // Hybrid API: Uses GET for small data, POST for large data (photos)
    async callAPI(action, data = {}, method = "GET") {
        try {
            if (method === "GET") {
                const params = new URLSearchParams({ action, ...data });
                const res = await fetch(`${API_URL}?${params.toString()}`);
                return await res.json();
            } else {
                const res = await fetch(`${API_URL}`, {
                    method: "POST",
                    body: JSON.stringify({ action, data })
                });
                return await res.json();
            }
        } catch (e) {
            console.error("API Error:", e);
            return null;
        }
    },

    async getProfile(userId) {
        if (this.profileCache[userId]) return this.profileCache[userId];
        const user = await this.callAPI("GET_PROFILE", { id: userId });
        const fixed = this.fixUserData(user);
        if (fixed) this.profileCache[userId] = fixed;
        return fixed;
    },

    fixUserData(user) {
        if (!user || !user.id) return null;
        if (typeof user.friends === 'string') {
            try { user.friends = JSON.parse(user.friends); } catch (e) { user.friends = []; }
        }
        if (!Array.isArray(user.friends)) user.friends = [];
        return user;
    },

    async getAllUsers() {
        return await this.callAPI("GET_USERS") || [];
    },

    async getPosts() {
        const posts = await this.callAPI("GET_ALL_POSTS") || [];
        return posts.map(p => {
            if (typeof p.liked_by === 'string') {
                try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
            }
            if (!Array.isArray(p.liked_by)) p.liked_by = [];
            return p;
        });
    },

    async getUserPosts(userId) {
        return await this.callAPI("GET_USER_POSTS", { user_id: userId }) || [];
    },

    async savePost(post) {
        return await this.callAPI("ADD_POST", post, "POST"); // Photos MUST use POST
    },

    async getFriendRequests(userId) {
        return await this.callAPI("GET_FRIEND_REQUESTS", { id: userId }) || [];
    },

    async getSentRequests(userId) {
        return await this.callAPI("GET_SENT_REQUESTS", { id: userId }) || [];
    },

    async sendFriendRequest(senderId, receiverId) {
        return await this.callAPI("ADD_FRIEND_REQUEST", { sender_id: senderId, receiver_id: receiverId }, "POST");
    },

    getCurrentUser() {
        try {
            const user = JSON.parse(localStorage.getItem('socialhub_user'));
            return this.fixUserData(user);
        } catch (e) { return null; }
    },

    setCurrentUser(user) { localStorage.setItem('socialhub_user', JSON.stringify(user)); },
    clearCurrentUser() { localStorage.removeItem('socialhub_user'); }
};
