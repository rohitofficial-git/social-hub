const Storage = {
    profileCache: {},
    postsCache: null,
    usersCache: null,
    cacheTime: 0,

    // Hybrid API: Uses GET for small data, POST for large data (photos)
    async callAPI(action, data = {}, method = "GET") {
        try {
            if (method === "GET") {
                const params = new URLSearchParams({ action, ...data });
                const res = await fetch(`${API_URL}?${params.toString()}`);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return await res.json();
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

    async getAllUsers(force = false) {
        const now = Date.now();
        if (!force && this.usersCache && (now - this.cacheTime < 30000)) return this.usersCache;

        const res = await this.callAPI("GET_USERS");
        this.usersCache = Array.isArray(res) ? res : [];
        if (this.usersCache.length > 0) this.cacheTime = now;
        return this.usersCache;
    },

    async getPosts(force = false) {
        const now = Date.now();
        if (!force && this.postsCache && (now - this.cacheTime < 30000)) return this.postsCache;

        const res = await this.callAPI("GET_ALL_POSTS");
        const posts = Array.isArray(res) ? res : [];
        this.postsCache = posts.map(p => {
            if (typeof p.liked_by === 'string') {
                try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
            }
            if (!Array.isArray(p.liked_by)) p.liked_by = [];
            return p;
        });
        if (this.postsCache.length > 0) this.cacheTime = now;
        return this.postsCache;
    },

    async getUserPosts(userId) {
        // We fetch fresh for specific user views for accuracy
        const res = await this.callAPI("GET_USER_POSTS", { user_id: userId });
        const posts = Array.isArray(res) ? res : [];
        return posts.map(p => {
            if (typeof p.liked_by === 'string') {
                try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
            }
            if (!Array.isArray(p.liked_by)) p.liked_by = [];
            return p;
        });
    },

    async savePost(post) {
        this.postsCache = null; // Clear cache
        return await this.callAPI("ADD_POST", post, "POST");
    },

    async deletePost(postId) {
        this.postsCache = null;
        return await this.callAPI("DELETE_POST", { id: postId }, "POST");
    },

    async updatePost(postId, updates) {
        // Update local cache optimistically if it exists
        if (this.postsCache) {
            const p = this.postsCache.find(post => post.id === postId);
            if (p) Object.assign(p, updates);
        }
        return await this.callAPI("UPDATE_POST", { id: postId, ...updates }, "POST");
    },

    // --- Friend System ---
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

    async acceptFriendRequest(currentUserId, targetUserId) {
        this.profileCache = {}; // Reset profile cache as friends lists changed
        this.usersCache = null;
        return await this.callAPI("ACCEPT_FRIEND_REQUEST", { user_id: currentUserId, friend_id: targetUserId }, "POST");
    },

    async deleteFriendRequest(senderId, receiverId) {
        return await this.callAPI("DELETE_FRIEND_REQUEST", { sender_id: senderId, receiver_id: receiverId }, "POST");
    },

    async removeFriend(currentUserId, targetUserId) {
        this.profileCache = {};
        this.usersCache = null;
        return await this.callAPI("REMOVE_FRIEND", { user_id: currentUserId, friend_id: targetUserId }, "POST");
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

    clearCurrentUser() {
        localStorage.removeItem('socialhub_user');
        this.profileCache = {};
        this.postsCache = null;
        this.usersCache = null;
    }
};
