const Auth = {
    async login(identifier, password) {
        try {
            let email = identifier;
            // If it doesn't look like an email, assume it's a username
            if (!identifier.includes('@')) {
                const user = await Storage.getUserByUsername(identifier);
                if (!user) return { success: false, message: 'Username not found' };
                email = user.email;
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            const userData = await Storage.getProfile(data.user.id);
            if (userData) {
                Storage.setCurrentUser(userData);
                return { success: true, user: userData };
            }
            return { success: false, message: 'User profile not found' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async sendMagicLink(email) {
        try {
            const { error } = await supabaseClient.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async signup(username, email, password) {
        try {
            // Check if username taken
            const { data: existingUser } = await supabaseClient
                .from('profiles')
                .select('username')
                .eq('username', username.toLowerCase())
                .single();

            if (existingUser) {
                return { success: false, message: 'Username already taken' };
            }

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            const newUser = {
                id: data.user.id,
                username: username.toLowerCase(),
                email,
                bio: '',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                friends: [],
                created_at: new Date().toISOString()
            };

            await Storage.saveUser(newUser);
            Storage.setCurrentUser(newUser);

            return { success: true, user: newUser };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async logout() {
        await supabaseClient.auth.signOut();
        Storage.clearCurrentUser();
        window.location.reload();
    },

    async updateProfile(updates) {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return { success: false };

        try {
            // Only upload if it's a new base64 image (not the existing cloud URL)
            if (updates.avatar && updates.avatar.startsWith('data:image')) {
                console.log('SocialHub: Uploading new avatar...');
                const fileName = `avatar-${currentUser.id}-${Date.now()}.jpg`;

                // Convert base64 to Blob correctly
                const base64Data = updates.avatar.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });

                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('avatars')
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) {
                    console.error('Storage Upload Error:', uploadError);
                    throw new Error('Image upload failed: ' + uploadError.message);
                }

                const { data: { publicUrl } } = supabaseClient.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                updates.avatar = publicUrl;
                console.log('SocialHub: Avatar uploaded successfully:', publicUrl);
            }

            // Clean the object to ONLY include what the database expects
            const cleanUser = {
                id: currentUser.id,
                username: (updates.username ?? currentUser.username).toLowerCase(),
                email: currentUser.email,
                bio: updates.bio ?? currentUser.bio,
                avatar: updates.avatar ?? currentUser.avatar,
                friends: currentUser.friends || [],
                created_at: currentUser.created_at || new Date().toISOString()
            };

            // Check if username is being changed and if it's taken
            if (updates.username && updates.username.toLowerCase() !== currentUser.username.toLowerCase()) {
                const existing = await Storage.getUserByUsername(updates.username);
                if (existing) throw new Error('Username already taken');
            }

            console.log('SocialHub: Attempting to save clean profile...', cleanUser);
            await Storage.saveUser(cleanUser);
            Storage.setCurrentUser(cleanUser);

            return { success: true, user: cleanUser };
        } catch (error) {
            console.error('Update profile error details:', error);
            return { success: false, message: error.message };
        }
    },

    async deleteAccount() {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return { success: false };

        try {
            await Storage.deleteUserProfile(currentUser.id);
            await this.logout();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    isLoggedIn() {
        return !!Storage.getCurrentUser();
    }
};
