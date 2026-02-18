const Auth = {
    async login(identifier, password) {
        try {
            const res = await Storage.callAPI("LOGIN", { email: identifier, password: password });
            if (res && res.success) {
                Storage.setCurrentUser(res.user);
                return { success: true, user: res.user };
            }
            return { success: false, message: res ? res.msg : "Login failed" };
        } catch (error) {
            return { success: false, message: "Server error during login" };
        }
    },

    async signup(username, email, password) {
        try {
            const newUser = {
                id: 'u_' + Date.now(),
                username: username.toLowerCase(),
                email: email,
                password: password,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                bio: '',
                friends: JSON.stringify([]),
                created_at: new Date().toISOString()
            };

            const res = await Storage.callAPI("SIGNUP", newUser);
            if (res && res.success) {
                const sessionUser = { ...newUser };
                delete sessionUser.password;
                sessionUser.friends = [];
                Storage.setCurrentUser(sessionUser);
                return { success: true, user: sessionUser };
            }
            return { success: false, message: res ? res.msg : "Signup failed" };
        } catch (error) {
            return { success: false, message: "Server error during signup" };
        }
    },

    async logout() {
        Storage.clearCurrentUser();
        window.location.reload();
    },

    async updateProfile(updates) {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return { success: false };

        try {
            let avatar = updates.avatar;
            if (avatar && avatar.startsWith('data:image')) {
                avatar = await UI.compressImage(avatar);
            }

            const cleanUser = {
                id: currentUser.id,
                username: (updates.username ?? currentUser.username).toLowerCase(),
                email: currentUser.email,
                password: currentUser.password || '',
                avatar: avatar ?? currentUser.avatar,
                bio: updates.bio ?? currentUser.bio,
                friends: JSON.stringify(currentUser.friends || []),
                created_at: currentUser.created_at || new Date().toISOString()
            };

            const res = await Storage.callAPI("UPDATE_USER", cleanUser);
            if (res && res.success) {
                const sessionUser = { ...cleanUser, friends: currentUser.friends || [] };
                Storage.setCurrentUser(sessionUser);
                return { success: true, user: sessionUser };
            }
            return { success: false, message: res ? res.msg : "Update failed" };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async deleteAccount() {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return { success: false };
        const res = await Storage.callAPI("DELETE_USER", { id: currentUser.id });
        if (res && res.success) {
            this.logout();
            return { success: true };
        }
        return { success: false };
    },

    isLoggedIn() {
        return !!Storage.getCurrentUser();
    }
};
