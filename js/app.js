const App = {
    allUsers: [], // Cache for performance

    async init() {
        try {
            console.log('SocialHub: Initializing...');
            this.bindEvents();

            // 1. Initial Route (Loads from local cache instantly)
            this.route();

            // 2. High Priority Sync (Immediately after load)
            this.syncData();

            // 3. Background sync (Every 30 seconds for real-time feel)
            setInterval(() => this.syncData(), 30000);
        } catch (error) {
            console.error('Initialization error:', error);
        }
    },

    async syncData() {
        try {
            // Mega Sync bundles posts, users, and requests in ONE request
            const success = await Storage.megaSync();
            if (success) {
                await this.refreshSession();
                this.updateBadge();
                this.allUsers = await Storage.getAllUsers();

                // Silently refresh current view with new data
                const hash = window.location.hash.substring(1) || 'home';
                if (hash === 'home') this.showHome(true);
                if (hash.startsWith('profile')) {
                    const params = new URLSearchParams(hash.split('?')[1]);
                    this.showProfile(params.get('id'), true);
                }
            }
        } catch (e) {
            console.warn('Sync failed:', e);
        }
    },

    async refreshSession() {
        const user = Storage.getCurrentUser();
        if (!user || !user.id) {
            if (user) Auth.logout(); // Clear malformed old session
            return;
        }
        try {
            const freshUser = await Storage.getProfile(user.id);
            if (freshUser && freshUser.id) {
                Storage.setCurrentUser(freshUser);
            }
        } catch (e) {
            console.warn('Could not refresh session.');
        }
    },

    bindEvents() {
        document.getElementById('logo-home').onclick = () => this.navigate('home');
        document.getElementById('nav-home').onclick = (e) => { e.preventDefault(); this.navigate('home'); };
        document.getElementById('nav-create').onclick = (e) => { e.preventDefault(); this.navigate('create'); };
        document.getElementById('nav-search').onclick = (e) => { e.preventDefault(); this.navigate('search'); };
        document.getElementById('nav-profile').onclick = (e) => { e.preventDefault(); this.navigate('profile'); };
        document.getElementById('nav-requests').onclick = (e) => { e.preventDefault(); this.navigate('requests'); };
        document.getElementById('btn-logout').onclick = () => Auth.logout();

        window.addEventListener('popstate', () => this.route());
    },

    async updateBadge() {
        const user = Storage.getCurrentUser();
        if (!user) return;
        const [requests, notifications] = await Promise.all([
            Storage.getFriendRequests(user.id),
            Storage.getNotifications(user.id)
        ]);

        const badge = document.getElementById('request-badge');
        const total = requests.length + notifications.length;

        if (total > 0) {
            badge.textContent = total;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    async refreshUsers() {
        const users = await Storage.getAllUsers();
        if (users) this.allUsers = users;
    },

    navigate(view, addToHistory = true) {
        window.location.hash = view;
        if (addToHistory) {
            window.history.pushState({ view }, '', `#${view}`);
        }
        this.route();
    },

    hideAllViews() {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    },

    async route() {
        const hash = window.location.hash.substring(1) || 'home';
        const user = Storage.getCurrentUser();

        this.hideAllViews();

        if (!user) {
            this.showAuth('login');
            document.getElementById('navbar').classList.add('hidden');
            return;
        }

        document.getElementById('navbar').classList.remove('hidden');
        this.updateBadge();

        const [view, params] = hash.split('?');
        const queryParams = new URLSearchParams(params);
        const userId = queryParams.get('id');

        switch (view) {
            case 'home':
                this.showHome();
                break;
            case 'search':
                this.showSearch();
                break;
            case 'profile':
                this.showProfile(userId);
                break;
            case 'create':
                this.showCreate();
                break;
            case 'requests':
                this.showRequests();
                break;
            case 'edit-profile':
                this.showEditProfile();
                break;
            default:
                this.showHome();
        }

        this.updateActiveNav(view);
    },

    updateActiveNav(activePath) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.id === `nav-${activePath}`);
        });
    },

    showLoader(element) {
        element.innerHTML = `
            <div class="loader-container">
                <div class="pulse-loader"></div>
                <p class="loading-text">Connecting to Hub...</p>
            </div>
        `;
    },

    showAuth(mode) {
        const view = document.getElementById('view-auth');
        view.classList.remove('hidden');
        const template = document.getElementById('tpl-auth');
        view.innerHTML = '';
        view.appendChild(template.content.cloneNode(true));

        const form = view.querySelector('#auth-form');
        const submitBtn = view.querySelector('#auth-submit');
        const signupFields = view.querySelector('#signup-fields');
        const title = view.querySelector('.auth-subtitle');
        const switchText = view.querySelector('#auth-switch-text');

        let currentMode = mode;

        const updateUI = () => {
            const idLabel = view.querySelector('#auth-identifier-label');
            if (currentMode === 'login') {
                signupFields.classList.add('hidden');
                submitBtn.textContent = 'Login';
                if (idLabel) idLabel.textContent = 'Email or Username';
                switchText.innerHTML = `Don't have an account? <a href="#" id="auth-switch">Sign Up</a><br><a href="#" id="auth-magic" style="display:inline-block; margin-top:1rem; color:var(--text-muted); font-size:0.8rem">Login with Email Link (Magic Link)</a>`;
                title.textContent = 'Connect with your community';
            } else {
                signupFields.classList.remove('hidden');
                submitBtn.textContent = 'Sign Up';
                if (idLabel) idLabel.textContent = 'Email';
                switchText.innerHTML = `Already have an account? <a href="#" id="auth-switch">Login</a>`;
                title.textContent = 'Join the SocialHub community';
            }

            view.querySelector('#auth-switch').onclick = (e) => {
                e.preventDefault();
                currentMode = currentMode === 'login' ? 'signup' : 'login';
                updateUI();
            };

            const magicBtn = view.querySelector('#auth-magic');
            if (magicBtn) {
                magicBtn.onclick = async (e) => {
                    e.preventDefault();
                    const email = form.email.value;
                    if (!email) return UI.showToast('Please enter your email first');
                    magicBtn.textContent = 'Sending link...';
                    const res = await Auth.sendMagicLink(email);
                    if (res.success) {
                        UI.showToast('Check your email for the magic link!');
                        magicBtn.textContent = 'Link Sent ✓';
                    } else {
                        UI.showToast('Error: ' + res.message);
                        magicBtn.textContent = 'Login with Email Link';
                    }
                };
            }
        };

        updateUI();

        form.onsubmit = async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            const email = form.email.value;
            const password = form.password.value;

            try {
                if (currentMode === 'login') {
                    const res = await Auth.login(email, password);
                    if (res.success) {
                        window.location.reload();
                    } else {
                        UI.showToast(res.message);
                    }
                } else {
                    const username = form.username.value;
                    if (!username) return UI.showToast('Username is required');
                    const res = await Auth.signup(username, email, password);
                    if (res.success) {
                        window.location.reload();
                    } else {
                        UI.showToast(res.message);
                    }
                }
            } catch (err) {
                UI.showToast('Authentication failed.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = currentMode === 'login' ? 'Login' : 'Sign Up';
            }
        };
    },

    async showHome(silent = false) {
        const user = Storage.getCurrentUser();
        if (!user || !user.username) {
            this.showAuth('login');
            return;
        }
        const view = document.getElementById('view-home');
        view.classList.remove('hidden');

        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

        // Update greeting and headers without clearing the whole view
        if (!silent || !view.querySelector('.feed')) {
            view.innerHTML = `
                <div class="welcome-header">
                    <h1>${greeting}, ${user.username}!</h1>
                    <p>See what's happening in the Hub today.</p>
                </div>
                <div class="stories-wrapper" id="home-stories"></div>
                <div class="feed-header-label">Recent Updates</div>
                <div class="feed"></div>
            `;
        }

        const feed = view.querySelector('.feed');
        const storiesContainer = view.querySelector('#home-stories');
        if (!feed) return;

        // Only show loader if we don't have existing posts
        if (!silent && (!feed.children.length || feed.querySelector('.loader-container'))) {
            this.showLoader(feed);
        }

        try {
            // Safety Check: Ensure allUsers exists
            const users = Array.isArray(this.allUsers) ? this.allUsers : [];
            const otherUsers = users.filter(u => u && u.id && String(u.id) !== String(user.id)).slice(0, 10);

            if (storiesContainer) {
                storiesContainer.innerHTML = ''; // Reset before render
                if (otherUsers.length > 0) {
                    storiesContainer.classList.remove('hidden');
                    otherUsers.forEach(u => {
                        const item = document.createElement('div');
                        item.className = 'story-item';
                        item.innerHTML = `
                            <div class="story-ring"><img src="${u.avatar || 'https://via.placeholder.com/50'}"></div>
                            <span class="story-name">${u.username || 'User'}</span>
                        `;
                        item.onclick = () => this.navigate(`profile?id=${u.id}`);
                        storiesContainer.appendChild(item);
                    });
                } else {
                    storiesContainer.classList.add('hidden');
                }
            }

            const allPosts = await Storage.getPosts();
            const postsArray = Array.isArray(allPosts) ? allPosts : [];
            const friends = Array.isArray(user.friends) ? user.friends.map(String) : [];

            // Privacy Logic for Home Feed:
            // 1. Show my own posts
            // 2. Show public posts from others
            // 3. Show private posts ONLY if I am friends with the author
            const filteredPosts = postsArray.filter(p => {
                if (!p) return false;
                const authorId = String(p.user_id);
                const isMe = authorId === String(user.id);
                const isFriend = friends.includes(authorId);
                const isPublic = p.visibility === 'public' || !p.visibility;

                return isMe || isPublic || isFriend;
            });

            feed.innerHTML = '';
            if (filteredPosts.length === 0) {
                feed.innerHTML = '<div class="card" style="text-align:center; padding: 4rem 1rem;"><p style="color:var(--text-muted)">No posts to show yet. Feel free to create one!</p></div>';
            } else {
                filteredPosts.forEach(post => {
                    try {
                        const postEl = UI.renderPost(post);
                        if (postEl) feed.appendChild(postEl);
                    } catch (renderErr) {
                        console.error("SocialHub: Post render failed", post, renderErr);
                    }
                });
            }
        } catch (err) {
            console.error("SocialHub: Home load error:", err);
            feed.innerHTML = `
                <div class="card" style="text-align:center; padding: 4rem 1rem;">
                    <p style="color:var(--text-muted)">Could not load the feed. We might be experiencing a minor glitch.</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem">Error: ${err.message || 'Unknown'}</p>
                    <button class="btn btn-primary" style="margin-top:1.5rem" onclick="App.showHome()">Retry</button>
                </div>
            `;
        }
    },

    async showProfile(targetUserId = null, silent = false) {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return;
        const view = document.getElementById('view-profile');
        view.classList.remove('hidden');

        if (!silent || !view.children.length) {
            this.showLoader(view);
        }

        const tid = targetUserId || currentUser.id;

        try {
            // Speed Fix: Use local data if viewing own profile
            let user = (tid === currentUser.id) ? currentUser : await Storage.getProfile(tid);

            if (!user) {
                view.innerHTML = '<div style="text-align:center; padding: 4rem 1rem;"><p>User not found.</p></div>';
                return;
            }

            // Load posts and requests quietly
            const [allUserPosts, sentReqs, receivedReqs] = await Promise.all([
                Storage.getUserPosts(user.id).catch(() => []),
                Storage.getSentRequests(currentUser.id).catch(() => []),
                Storage.getFriendRequests(currentUser.id).catch(() => [])
            ]);

            const isRequestSent = sentReqs.some(r => r.receiver_id === tid);
            const receivedRequest = receivedReqs.find(r => r.sender_id === tid);

            const isFriend = (currentUser.friends && currentUser.friends.includes(user.id)) || tid === currentUser.id;

            const renderProfileContent = (segment) => {
                // Privacy Logic: Non-friends can only see public segment
                if (segment === 'private' && !isFriend) {
                    view.querySelector('.profile-feed').innerHTML = `
                        <div class="card" style="text-align:center; padding: 3rem 1rem;">
                            <p style="color:var(--text-muted)">Private posts are only visible to friends.</p>
                        </div>`;
                    return;
                }

                const filteredPosts = allUserPosts.filter(p => {
                    const postVisibility = p.visibility || 'public';
                    return postVisibility === segment;
                });

                view.innerHTML = `
                    <div class="profile-header card">
                        <img src="${user.avatar}" class="profile-pic-large">
                        <h2 class="profile-username">@${user.username}</h2>
                        <div style="margin: 1rem 0;">
                            ${tid === currentUser.id ?
                        '<button class="btn btn-outline" id="btn-edit-profile">Edit Profile</button>' :
                        this.renderFriendButton(isFriend, isRequestSent, !!receivedRequest)}
                        </div>
                        <p class="profile-bio">${user.bio || 'No bio yet.'}</p>
                    </div>
                    <div class="feed-segments">
                        <button class="segment-btn ${segment === 'public' ? 'active' : ''}" data-type="public">🌍 Public</button>
                        <button class="segment-btn ${segment === 'private' ? 'active' : ''}" data-type="private">👥 Private</button>
                    </div>
                    <div class="profile-feed"></div>
                `;

                const profileFeed = view.querySelector('.profile-feed');
                if (filteredPosts.length === 0) {
                    profileFeed.innerHTML = `<div class="card" style="text-align:center; padding: 3rem 1rem; color:var(--text-muted)">No ${segment} posts yet.</div>`;
                } else {
                    filteredPosts.forEach(post => profileFeed.appendChild(UI.renderPost(post)));
                }

                view.querySelectorAll('.segment-btn').forEach(btn => {
                    btn.onclick = () => renderProfileContent(btn.dataset.type);
                });

                const editBtn = view.querySelector('#btn-edit-profile');
                if (editBtn) editBtn.onclick = () => this.navigate('edit-profile');
                this.bindFriendRequestAction(currentUser.id, user.id);
            };

            renderProfileContent('public');
        } catch (err) {
            console.error("Profile error:", err);
            view.innerHTML = '<div class="card" style="text-align:center; padding: 4rem 1rem;"><p>Something went wrong. Tap below to try again.</p><button class="btn btn-primary" onclick="App.showProfile()" style="margin-top:1rem">Refresh</button></div>';
        }
    },

    renderFriendButton(isFriend, isRequestSent, isRequestReceived) {
        if (isFriend) return `<button class="btn btn-outline btn-social" id="btn-friend-action" data-action="remove">Friends ✓</button>`;
        if (isRequestSent) return `<button class="btn btn-outline btn-social" id="btn-friend-action" data-action="cancel">Request Sent...</button>`;
        if (isRequestReceived) return `<button class="btn btn-primary btn-social" id="btn-friend-action" data-action="accept">Accept Request</button>`;
        return `<button class="btn btn-primary btn-social" id="btn-friend-action" data-action="request">+ Add Friend</button>`;
    },

    async bindFriendRequestAction(currentUserId, targetUserId) {
        const btn = document.getElementById('btn-friend-action');
        if (!btn) return;
        btn.onclick = async () => {
            const action = btn.dataset.action;
            btn.disabled = true;
            try {
                if (action === 'request') await Storage.sendFriendRequest(currentUserId, targetUserId);
                else if (action === 'accept') await this.handleFriendAction('accept', currentUserId, targetUserId);
                else if (action === 'cancel') await Storage.deleteFriendRequest(currentUserId, targetUserId);
                else if (action === 'remove' && confirm('Are you sure?')) await this.handleFriendAction('remove', currentUserId, targetUserId);
                this.showProfile(targetUserId);
            } catch (e) { UI.showToast('Action failed.'); }
            finally { btn.disabled = false; }
        };
    },

    async handleFriendAction(type, currentUserId, targetUserId) {
        if (type === 'accept') {
            await Storage.acceptFriendRequest(currentUserId, targetUserId);
            UI.showToast('Friend request accepted!');
        } else {
            await Storage.removeFriend(currentUserId, targetUserId);
            UI.showToast('Friend removed.');
        }
        const freshUser = await Storage.getProfile(currentUserId);
        Storage.setCurrentUser(freshUser);
        this.updateBadge();
    },

    showSearch() {
        const view = document.getElementById('view-search');
        view.classList.remove('hidden');
        view.innerHTML = `
            <div class="card form-card">
                <h1 style="font-size:1.75rem; font-weight:800; margin-bottom:0.5rem">Find People</h1>
                <div class="search-box">
                    <input type="text" id="user-search-input" placeholder="Search by username..." autocomplete="off">
                </div>
            </div>
            <div id="search-results" style="margin-top:2rem"></div>
        `;
        const input = view.querySelector('#user-search-input');
        const results = view.querySelector('#search-results');
        const currentUser = Storage.getCurrentUser();

        // Ensure users are fresh when searching
        this.refreshUsers();

        input.oninput = () => {
            const q = input.value.toLowerCase().trim();
            results.innerHTML = '';
            if (!q) return;

            const matches = this.allUsers.filter(u =>
                u && u.username &&
                u.username.toLowerCase().includes(q) &&
                String(u.id) !== String(currentUser.id)
            );

            if (matches.length === 0) {
                results.innerHTML = '<div class="card" style="text-align:center; padding: 2rem;"><p style="color:var(--text-muted)">No users found with that name.</p></div>';
                return;
            }

            matches.forEach(user => {
                const item = document.createElement('div');
                item.className = 'user-item card';
                item.innerHTML = `
                    <img src="${user.avatar || 'https://via.placeholder.com/50'}" class="user-item-avatar">
                    <div class="user-item-info">
                        <div class="user-item-name">@${user.username}</div>
                    </div>
                `;
                item.onclick = () => this.navigate(`profile?id=${user.id}`);
                results.appendChild(item);
            });
        };
    },

    async showRequests() {
        const view = document.getElementById('view-requests');
        view.classList.remove('hidden');
        this.showLoader(view);
        try {
            const currentUser = Storage.getCurrentUser();
            const [reqs, notifs] = await Promise.all([
                Storage.getFriendRequests(currentUser.id),
                Storage.getNotifications(currentUser.id)
            ]);

            view.innerHTML = `
                <div class="card form-card" style="margin-bottom:2rem">
                    <h1 style="font-size:1.75rem; font-weight:800">Notifications</h1>
                </div>
                <div id="notifications-combined-list"></div>
            `;
            const list = view.querySelector('#notifications-combined-list');

            if (reqs.length === 0 && notifs.length === 0) {
                list.innerHTML = '<p style="text-align:center; color:var(--text-muted)">No new notifications.</p>';
                return;
            }

            // Render Friend Requests
            reqs.forEach(req => {
                const sender = req.sender_profile;
                const item = document.createElement('div');
                item.className = 'request-item card';
                item.style.marginBottom = '1rem';
                item.innerHTML = `
                    <div class="request-user" style="display:flex; align-items:center; gap:1rem">
                        <img src="${sender.avatar || 'https://via.placeholder.com/50'}" class="user-item-avatar" style="width:40px; height:40px; border-radius:50%">
                        <div class="user-item-name" style="font-weight:700">@${sender.username} sent a friend request</div>
                    </div>
                    <div class="request-actions" style="margin-top:1rem; display:flex; gap:0.5rem">
                        <button class="btn btn-primary btn-sm btn-accept" style="flex:1">Accept</button>
                        <button class="btn btn-outline btn-sm btn-ignore" style="flex:1">Ignore</button>
                    </div>
                `;
                item.querySelector('.btn-accept').onclick = async () => {
                    await this.handleFriendAction('accept', currentUser.id, req.sender_id);
                    this.showRequests();
                };
                item.querySelector('.btn-ignore').onclick = async () => {
                    await Storage.deleteFriendRequest(req.sender_id, currentUser.id);
                    this.showRequests();
                };
                list.appendChild(item);
            });

            // Render Like Notifications
            notifs.forEach(n => {
                const sender = n.sender_profile;
                const item = document.createElement('div');
                item.className = 'notification-item card';
                item.style.marginBottom = '1rem';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '1rem';
                item.style.padding = '1rem';
                item.innerHTML = `
                    <img src="${sender.avatar || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:50%">
                    <div style="flex:1">
                        <span style="font-weight:700">@${sender.username}</span> ${n.message}
                        <div style="font-size:0.75rem; color:var(--text-muted)">${UI.formatDate(n.created_at)}</div>
                    </div>
                `;
                item.onclick = () => {
                    if (n.post_id) {
                        // In a real app, we'd scroll to post. For now, go to profile
                        this.navigate(`profile?id=${currentUser.id}`);
                    }
                };
                list.appendChild(item);
            });

        } catch (e) {
            console.error("Requests view error:", e);
            view.innerHTML = '<p>Error loading notifications.</p>';
        }
    },

    showCreate() {
        const view = document.getElementById('view-create');
        view.classList.remove('hidden');
        view.innerHTML = `
            <div class="card form-card">
                <h1 style="font-size:1.75rem; font-weight:800; margin-bottom:1.5rem">Create Post</h1>
                <div id="post-dropzone" class="post-dropzone">
                    <div id="dropzone-content">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <p>Click to upload or drag & drop</p>
                    </div>
                    <img id="post-preview" class="hidden" style="width:100%; border-radius:12px">
                </div>
                <input type="file" id="post-image-input" hidden accept="image/*">
                <div class="form-group" style="margin-top:1.5rem">
                    <label>Caption</label>
                    <textarea id="post-caption" rows="3" placeholder="What's on your mind?"></textarea>
                </div>
                <div class="form-group">
                    <label>Visibility</label>
                    <select id="post-visibility" class="btn-outline" style="width:100%; padding:0.75rem; border-radius:12px">
                        <option value="public">🌍 Public (Everyone)</option>
                        <option value="private">👥 Friends Only</option>
                    </select>
                </div>
                <button class="btn btn-primary" id="btn-share-post" style="width:100%; margin-top:1rem" disabled>Share Post</button>
            </div>
        `;
        const dropzone = view.querySelector('#post-dropzone');
        const input = view.querySelector('#post-image-input');
        const preview = view.querySelector('#post-preview');
        const postBtn = view.querySelector('#btn-share-post');
        let selectedImage = null;

        dropzone.onclick = () => input.click();
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                selectedImage = re.target.result;
                preview.src = selectedImage;
                preview.classList.remove('hidden');
                view.querySelector('#dropzone-content').classList.add('hidden');
                postBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        };
        postBtn.onclick = async () => {
            postBtn.disabled = true;
            postBtn.textContent = 'Sharing...';
            const user = Storage.getCurrentUser();
            try {
                const compressedImage = await UI.compressImage(selectedImage, 800, 800);
                const newPost = {
                    id: 'p_' + Date.now(),
                    user_id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    image: compressedImage,
                    caption: view.querySelector('#post-caption').value,
                    likes: 0,
                    liked_by: JSON.stringify([]),
                    visibility: view.querySelector('#post-visibility').value,
                    created_at: new Date().toISOString()
                };
                await Storage.savePost(newPost);
                this.navigate('home');
            } catch (err) {
                postBtn.disabled = false;
                postBtn.textContent = 'Share Post';
            }
        };
    },

    showEditProfile() {
        const view = document.getElementById('view-edit-profile');
        view.classList.remove('hidden');
        const user = Storage.getCurrentUser();
        view.innerHTML = `
            <div class="card form-card">
                <h1 style="font-size:1.75rem; font-weight:800; margin-bottom:1.5rem">Edit Profile</h1>
                <div style="text-align:center; margin-bottom:2rem">
                    <img src="${user.avatar}" id="edit-avatar-preview" class="profile-pic-large" style="cursor:pointer">
                    <p style="color:var(--primary); font-weight:600; cursor:pointer" id="change-photo-btn">Change Photo</p>
                    <input type="file" id="avatar-input" hidden accept="image/*">
                </div>
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="edit-username" value="${user.username || ''}">
                </div>
                <div class="form-group">
                    <label>Bio</label>
                    <textarea id="edit-bio" rows="3">${user.bio || ''}</textarea>
                </div>
                <div style="display:flex; gap:1rem">
                    <button class="btn btn-outline" style="flex:1" id="btn-cancel-edit">Cancel</button>
                    <button class="btn btn-primary" style="flex:1" id="btn-save-profile">Save</button>
                </div>
                <button class="btn btn-outline" style="width:100%; margin-top:2rem; color:var(--error); border-color:transparent" id="btn-delete-account">Delete Account</button>
            </div>
        `;
        const avatarInput = view.querySelector('#avatar-input');
        const preview = view.querySelector('#edit-avatar-preview');
        let newAvatar = user.avatar;

        view.querySelector('#change-photo-btn').onclick = () => avatarInput.click();
        preview.onclick = () => avatarInput.click();
        avatarInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                newAvatar = re.target.result;
                preview.src = newAvatar;
            };
            reader.readAsDataURL(file);
        };

        view.querySelector('#btn-cancel-edit').onclick = () => this.navigate('profile');
        view.querySelector('#btn-save-profile').onclick = async () => {
            const btn = view.querySelector('#btn-save-profile');
            btn.disabled = true;
            try {
                const res = await Auth.updateProfile({
                    username: view.querySelector('#edit-username').value,
                    bio: view.querySelector('#edit-bio').value,
                    avatar: newAvatar
                });
                if (res.success) this.navigate('profile');
                else UI.showToast(res.message);
            } finally { btn.disabled = false; }
        };

        view.querySelector('#btn-delete-account').onclick = async () => {
            if (confirm('Delete your account? This cannot be undone.')) {
                if (confirm('Are you REALLY sure? All posts and friends will be removed.')) {
                    const res = await Auth.deleteAccount();
                    if (res.success) window.location.href = '/';
                }
            }
        };
    }
};

App.init();
