const Storage = {
    // Profiles
    async getProfile(userId) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) return null;
        return data;
    },

    async getUserByUsername(username) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('username', username.toLowerCase())
            .single();
        if (error) return null;
        return data;
    },

    async saveUser(user) {
        const { error } = await supabaseClient
            .from('profiles')
            .upsert(user);
        if (error) throw error;
    },

    async getAllUsers() {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, username, avatar');
        if (error) return [];
        return data;
    },

    async deleteUserProfile(userId) {
        // 1. Delete all posts by this user
        await supabaseClient.from('posts').delete().eq('user_id', userId);

        // 2. Delete all friend requests sent or received
        await supabaseClient.from('friend_requests').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        // 3. Delete the profile record
        const { error } = await supabaseClient.from('profiles').delete().eq('id', userId);
        if (error) throw error;
    },

    // Friend Requests
    async getFriendRequests(userId) {
        const { data, error } = await supabaseClient
            .from('friend_requests')
            .select('*, profiles:sender_id(username, avatar)')
            .eq('receiver_id', userId)
            .eq('status', 'pending');
        if (error) return [];
        return data;
    },

    async getSentRequests(userId) {
        const { data, error } = await supabaseClient
            .from('friend_requests')
            .select('*')
            .eq('sender_id', userId)
            .eq('status', 'pending');
        if (error) return [];
        return data;
    },

    async sendFriendRequest(senderId, receiverId) {
        const { error } = await supabaseClient
            .from('friend_requests')
            .insert({ sender_id: senderId, receiver_id: receiverId });
        if (error) throw error;
    },

    async deleteFriendRequest(senderId, receiverId) {
        const { error } = await supabaseClient
            .from('friend_requests')
            .delete()
            .eq('sender_id', senderId)
            .eq('receiver_id', receiverId);
        if (error) throw error;
    },

    // Posts
    async getPosts() {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*, profiles(username, avatar)')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            console.error('Fetch posts error:', error);
            return [];
        }
        return data;
    },

    async getUserPosts(userId) {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*, profiles(username, avatar)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Fetch user posts error:', error);
            return [];
        }
        return data;
    },

    async savePost(post) {
        // Handle image upload to Supabase Storage
        if (post.image && post.image.startsWith('data:image')) {
            const fileName = `${Date.now()}.jpg`;
            const blob = await (await fetch(post.image)).blob();

            const { data, error } = await supabaseClient.storage
                .from('posts')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = supabaseClient.storage
                .from('posts')
                .getPublicUrl(fileName);

            post.image = publicUrl;
        }

        const { error } = await supabaseClient
            .from('posts')
            .insert(post);
        if (error) throw error;
    },

    async deletePost(postId) {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);
        if (error) throw error;
    },

    async updatePost(postId, updates) {
        const { error } = await supabaseClient
            .from('posts')
            .update(updates)
            .eq('id', postId);
        if (error) throw error;
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
