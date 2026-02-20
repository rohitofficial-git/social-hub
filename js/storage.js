const Storage = {
    profileCache: {},
    postsCache: null,
    usersCache: null,
    cacheTime: 0,
    pendingLikes: JSON.parse(localStorage.getItem('sh_pending_likes') || '{}'),

    savePendingLikes() {
        localStorage.setItem('sh_pending_likes', JSON.stringify(this.pendingLikes));
    },

    async callAPI(action, data = {}, method = "GET") {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            if (method === "GET") {
                const params = new URLSearchParams({ action, ...data });
                const res = await fetch(`${API_URL}?${params.toString()}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return await res.json();
            } else {
                const res = await fetch(`${API_URL}`, {
                    method: "POST",
                    body: JSON.stringify({ action, data }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return await res.json();
            }
        } catch (e) {
            console.error(`Storage: API error (${action}):`, e);
            return null;
        }
    },

    // --- MEGA SYNC (The Secret Sauce) ---
    async megaSync() {
        const user = this.getCurrentUser();
        const res = await this.callAPI("MEGA_SYNC", { user_id: user ? user.id : null });
        if (res) {
            // Update caches silently
            if (res.posts) {
                this.postsCache = this.fixPostsData(res.posts);
                localStorage.setItem('sh_cache_posts', JSON.stringify(this.postsCache));
            }
            if (res.users) {
                this.usersCache = res.users;
                localStorage.setItem('sh_cache_users', JSON.stringify(this.usersCache));
            }
            if (res.requests) {
                localStorage.setItem('sh_cache_requests', JSON.stringify(res.requests));
            }
            if (res.notifications) {
                localStorage.setItem('sh_cache_notifications', JSON.stringify(res.notifications));
            }
            this.cacheTime = Date.now();
            return true;
        }
        return false;
    },

    fixUserData(user) {
        if (!user || typeof user !== 'object' || !user.id) return null;
        if (typeof user.friends === 'string') {
            try { user.friends = JSON.parse(user.friends); } catch (e) { user.friends = []; }
        }
        if (!Array.isArray(user.friends)) user.friends = [];
        return user;
    },

    fixPostsData(posts) {
        const now = Date.now();
        // Clean up expired pending likes
        Object.keys(this.pendingLikes).forEach(id => {
            if (this.pendingLikes[id].expiry < now) delete this.pendingLikes[id];
        });
        this.savePendingLikes();

        return (Array.isArray(posts) ? posts : []).map(p => {
            if (typeof p.liked_by === 'string') {
                try { p.liked_by = JSON.parse(p.liked_by); } catch (e) { p.liked_by = []; }
            }
            if (!Array.isArray(p.liked_by)) p.liked_by = [];
            // Ensure likes is always a number to prevent "NaN" in UI
            p.likes = parseInt(p.likes) || 0;

            // --- State Lock Protection ---
            // If we have a fresh local update, IGNORE the server data for this post
            if (this.pendingLikes[p.id]) {
                p.likes = this.pendingLikes[p.id].likes;
                p.liked_by = this.pendingLikes[p.id].liked_by;
            }

            return p;
        });
    },

    async getPosts(force = false) {
        const now = Date.now();
        if (!force && this.postsCache && (now - this.cacheTime < 30000)) return this.postsCache;

        // Flash Load: Return cached posts instantly
        const cached = localStorage.getItem('sh_cache_posts');
        if (!force && cached && !this.postsCache) {
            this.postsCache = this.fixPostsData(JSON.parse(cached));
            return this.postsCache;
        }

        const res = await this.callAPI("GET_ALL_POSTS");
        this.postsCache = this.fixPostsData(res);
        if (this.postsCache && this.postsCache.length > 0) {
            this.cacheTime = now;
            localStorage.setItem('sh_cache_posts', JSON.stringify(this.postsCache));
        }
        return this.postsCache;
    },

    async getUserPosts(userId) {
        const res = await this.callAPI("GET_USER_POSTS", { user_id: userId });
        const freshPosts = this.fixPostsData(res);

        // Optimize: If these posts are also in our main cache, update them there too
        if (this.postsCache) {
            freshPosts.forEach(fp => {
                const idx = this.postsCache.findIndex(p => p.id === fp.id);
                if (idx !== -1) this.postsCache[idx] = fp;
            });
        }
        return freshPosts;
    },

    async updatePost(postId, updates) {
        // 1. Lock state locally for 60 seconds to prevent sync overwrite
        if (updates.likes !== undefined) {
            this.pendingLikes[postId] = {
                likes: updates.likes,
                liked_by: updates.liked_by,
                expiry: Date.now() + 60000
            };
            this.savePendingLikes();
        }

        // 2. Update memory cache
        if (this.postsCache) {
            const p = this.postsCache.find(post => post.id === postId);
            if (p) {
                Object.assign(p, updates);
                localStorage.setItem('sh_cache_posts', JSON.stringify(this.postsCache));
            }
        }

        // 3. Send to server
        return await this.callAPI("UPDATE_POST", { id: postId, ...updates }, "POST");
    },

    async getProfile(userId) {
        if (!userId) return null;
        if (this.profileCache[userId]) return this.profileCache[userId];
        const user = await this.callAPI("GET_PROFILE", { id: userId });
        const fixed = this.fixUserData(user);
        if (fixed) this.profileCache[userId] = fixed;
        return fixed;
    },

    async getAllUsers(force = false) {
        const now = Date.now();
        // Return from memory if fresh
        if (!force && this.usersCache && (now - this.cacheTime < 60000)) return this.usersCache;

        // Return from local storage instantly (Flash Load)
        const cached = localStorage.getItem('sh_cache_users');
        if (!force && cached) {
            this.usersCache = JSON.parse(cached);
            return this.usersCache;
        }

        const res = await this.callAPI("GET_USERS");
        this.usersCache = Array.isArray(res) ? res : [];
        if (this.usersCache.length > 0) {
            this.cacheTime = now;
            localStorage.setItem('sh_cache_users', JSON.stringify(this.usersCache));
        }
        return this.usersCache;
    },

    async savePost(post) {
        return await this.callAPI("ADD_POST", post, "POST");
    },

    async deletePost(postId) {
        return await this.callAPI("DELETE_POST", { id: postId }, "POST");
    },

    // --- Friend System ---
    async getFriendRequests(userId) {
        const cached = localStorage.getItem('sh_cache_requests');
        if (cached) return JSON.parse(cached);
        const res = await this.callAPI("GET_FRIEND_REQUESTS", { id: userId });
        const data = Array.isArray(res) ? res : [];
        localStorage.setItem('sh_cache_requests', JSON.stringify(data));
        return data;
    },

    async getNotifications(userId) {
        const cached = localStorage.getItem('sh_cache_notifications');
        if (cached) return JSON.parse(cached);
        const res = await this.callAPI("GET_NOTIFICATIONS", { id: userId });
        const data = Array.isArray(res) ? res : [];
        localStorage.setItem('sh_cache_notifications', JSON.stringify(data));
        return data;
    },

    async addNotification(userId, senderId, type, postId, message) {
        return await this.callAPI("ADD_NOTIFICATION", {
            id: 'n_' + Date.now(),
            user_id: userId,
            sender_id: senderId,
            type: type,
            post_id: postId,
            message: message,
            created_at: new Date().toISOString()
        }, "POST");
    },

    async getSentRequests(userId) {
        const res = await this.callAPI("GET_SENT_REQUESTS", { id: userId });
        return Array.isArray(res) ? res : [];
    },

    async sendFriendRequest(senderId, receiverId) {
        return await this.callAPI("ADD_FRIEND_REQUEST", { sender_id: senderId, receiver_id: receiverId }, "POST");
    },

    async acceptFriendRequest(currentUserId, targetUserId) {
        return await this.callAPI("ACCEPT_FRIEND_REQUEST", { user_id: currentUserId, friend_id: targetUserId }, "POST");
    },

    async deleteFriendRequest(senderId, receiverId) {
        return await this.callAPI("DELETE_FRIEND_REQUEST", { sender_id: senderId, receiver_id: receiverId }, "POST");
    },

    async removeFriend(currentUserId, targetUserId) {
        return await this.callAPI("REMOVE_FRIEND", { user_id: currentUserId, friend_id: targetUserId }, "POST");
    },

    getCurrentUser() {
        try {
            const data = localStorage.getItem('socialhub_user');
            if (!data) return null;
            return this.fixUserData(JSON.parse(data));
        } catch (e) { return null; }
    },

    setCurrentUser(user) {
        if (!user) return;
        localStorage.setItem('socialhub_user', JSON.stringify(user));
    },

    clearCurrentUser() {
        localStorage.removeItem('socialhub_user');
        localStorage.removeItem('sh_cache_posts');
        localStorage.removeItem('sh_cache_users');
        localStorage.removeItem('sh_cache_requests');
        this.profileCache = {};
        this.postsCache = null;
        this.usersCache = null;
    }
};
