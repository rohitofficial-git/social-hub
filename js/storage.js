const Storage = {
    profileCache: {},

    // Hybrid API: Uses GET for small data, POST for large data (photos)
    async callAPI(action, data = {}, method = "GET") {
        try {
            if (method === "GET") {
                const params = new URLSearchParams({ action, ...data });
                const res = await fetch(`${API_URL}?${params.toString()}`);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                const json = await res.json();
                return json;
            } else {
                const res = await fetch(`${API_URL}`, {
                    method: "POST",
                    body: JSON.stringify({ action, data })
                });
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return await res.json();
            }
        } catch (e) {
            console.error(`Storage: API error (${action}):`, e);
            return null;
        }
    },

    async getProfile(userId) {
        if (!userId) return null;
        if (this.profileCache[userId]) return this.profileCache[userId];
        const user = await this.callAPI("GET_PROFILE", { id: userId });
        const fixed = this.fixUserData(user);
        if (fixed) this.profileCache[userId] = fixed;
        return fixed;
    },

    fixUserData(user) {
        if (!user || typeof user !== 'object' || !user.id) return null;
        if (typeof user.friends === 'string') {
            try { user.friends = JSON.parse(user.friends); } catch (e) { user.friends = []; }
        }
        if (!Array.isArray(user.friends)) user.friends = [];
        return user;
    },

    async getAllUsers() {
        const res = await this.callAPI("GET_USERS");
        return Array.isArray(res) ? res : [];
    },

    async getPosts() {
        const res = await this.callAPI("GET_ALL_POSTS");
        const posts = Array.isArray(res) ? res : [];
        return posts.map(p => {
            if (typeof p.liked_by === 'string') {
                try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
            }
            if (!Array.isArray(p.liked_by)) p.liked_by = [];
            return p;
        });
    },

    async getUserPosts(userId) {
        const res = await this.callAPI("GET_USER_POSTS", { user_id: userId });
        return Array.isArray(res) ? res : [];
    },

    async savePost(post) {
        return await this.callAPI("ADD_POST", post, "POST");
    },

    async deletePost(postId) {
        return await this.callAPI("DELETE_POST", { id: postId }, "POST");
    },

    async updatePost(postId, updates) {
        return await this.callAPI("UPDATE_POST", { id: postId, ...updates }, "POST");
    },

    async getFriendRequests(userId) {
        const res = await this.callAPI("GET_FRIEND_REQUESTS", { id: userId });
        return Array.isArray(res) ? res : [];
    },

    async getSentRequests(userId) {
        const res = await this.callAPI("GET_SENT_REQUESTS", { id: userId });
        return Array.isArray(res) ? res : [];
    },

    async sendFriendRequest(senderId, receiverId) {
        return await this.callAPI("ADD_FRIEND_REQUEST", { sender_id: senderId, receiver_id: receiverId }, "POST");
    },

    getCurrentUser() {
        try {
            const data = localStorage.getItem('socialhub_user');
            if (!data) return null;
            const user = JSON.parse(data);
            return this.fixUserData(user);
        } catch (e) { return null; }
    },

    setCurrentUser(user) {
        if (!user) return;
        localStorage.setItem('socialhub_user', JSON.stringify(user));
    },

    clearCurrentUser() { localStorage.removeItem('socialhub_user'); }
};
