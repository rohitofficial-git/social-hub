const Storage = {
    // Shared Cache to avoid repeated slow loads
    profileCache: {},

    async callAPI(action, data = {}) {
        try {
            const params = new URLSearchParams({ action, ...data });
            const res = await fetch(`${API_URL}?${params.toString()}`);
            const json = await res.json();
            return json;
        } catch (e) {
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
        const res = await fetch(`${API_URL}?action=GET_USERS`);
        return await res.json() || [];
    },

    async getPosts() {
        const res = await fetch(`${API_URL}?action=GET_ALL_POSTS`);
        const posts = await res.json() || [];
        return posts.map(p => {
            if (typeof p.liked_by === 'string') {
                try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
            }
            if (!Array.isArray(p.liked_by)) p.liked_by = [];
            return p;
        });
    },

    async getUserPosts(userId) {
        const res = await fetch(`${API_URL}?action=GET_USER_POSTS&user_id=${userId}`);
        return await res.json() || [];
    },

    async savePost(post) { return await this.callAPI("ADD_POST", post); },

    async getFriendRequests(userId) {
        const res = await fetch(`${API_URL}?action=GET_FRIEND_REQUESTS&id=${userId}`);
        return await res.json() || [];
    },

    getCurrentUser() {
        const user = JSON.parse(localStorage.getItem('socialhub_user'));
        return this.fixUserData(user);
    },

    setCurrentUser(user) { localStorage.setItem('socialhub_user', JSON.stringify(user)); },
    clearCurrentUser() { localStorage.removeItem('socialhub_user'); }
};
