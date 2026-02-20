const UI = {
    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    renderPost(post) {
        const template = document.getElementById('tpl-post-card');
        const clone = template.content.cloneNode(true);
        const currentUser = Storage.getCurrentUser();

        const card = clone.querySelector('.post-card');

        // Use the linked profile data from the database JOIN
        const profiles = post.profiles || {};
        const latestAvatar = profiles.avatar || post.avatar;
        const username = profiles.username || post.username;

        clone.querySelector('.post-avatar').src = latestAvatar;
        clone.querySelector('.post-username').textContent = username;
        clone.querySelector('.post-image').src = post.image;
        if (post.visibility === 'private') {
            const badge = document.createElement('span');
            badge.className = 'badge-private';
            badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Friends Only`;
            clone.querySelector('.post-user-info').appendChild(badge);
        }
        clone.querySelector('.caption-username').textContent = username;
        clone.querySelector('.caption-text').textContent = post.caption;
        clone.querySelector('.likes-count').textContent = `${post.likes} likes`;
        clone.querySelector('.post-date').textContent = this.formatDate(post.created_at);

        const likeBtn = clone.querySelector('.btn-like');
        const deleteBtn = clone.querySelector('.btn-delete');

        if (currentUser && post.liked_by && post.liked_by.includes(currentUser.id)) {
            likeBtn.classList.add('liked');
        }

        if (currentUser && String(post.user_id) === String(currentUser.id)) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.style.display = 'flex'; // Explicitly show
            deleteBtn.onclick = async () => {
                if (confirm('Are you sure you want to delete this post?')) {
                    await this.handleDelete(post.id);
                }
            };
        }

        likeBtn.addEventListener('click', async () => {
            if (!Auth.isLoggedIn()) {
                this.showToast('Please login to like posts');
                return;
            }
            await this.handleLike(post, likeBtn, card.querySelector('.likes-count'));
        });

        // Image full size click
        clone.querySelector('.post-image-container').addEventListener('click', () => {
            this.showImageModal(post.image, post.caption);
        });

        // Profile navigation
        const goToProfile = () => App.navigate(`profile?id=${post.user_id}`);
        clone.querySelector('.post-avatar').onclick = goToProfile;
        clone.querySelector('.post-username').onclick = goToProfile;
        clone.querySelector('.caption-username').onclick = goToProfile;

        return clone;
    },

    async handleDelete(postId) {
        await Storage.deletePost(postId);
        this.showToast('Post deleted');
        App.route();
    },

    showImageModal(imageSrc, caption) {
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('full-image');
        const captionText = document.getElementById('modal-caption');
        const closeBtn = document.getElementById('modal-close');

        modal.classList.remove('hidden');
        modalImg.src = imageSrc;
        captionText.textContent = caption;

        const closeModal = () => {
            modal.classList.add('hidden');
        };

        closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        document.onkeydown = (e) => {
            if (e.key === 'Escape') closeModal();
        };
    },

    async handleLike(post, button, countEl) {
        const currentUser = Storage.getCurrentUser();
        if (!currentUser) return;

        if (!post.liked_by) post.liked_by = [];

        // Use String() for ID comparison to ensure consistency
        const currentId = String(currentUser.id);
        const isLiked = post.liked_by.map(String).includes(currentId);

        // --- Toggle Logic ---
        let newLikedBy;
        let newLikes;

        if (isLiked) {
            // Remove like
            newLikedBy = post.liked_by.filter(id => String(id) !== currentId);
            newLikes = Math.max(0, (parseInt(post.likes) || 1) - 1);
            button.classList.remove('liked');
        } else {
            // Add like
            newLikedBy = [...post.liked_by, currentId];
            newLikes = (parseInt(post.likes) || 0) + 1;
            button.classList.add('liked');
        }

        // Update UI immediately (Flash Fast)
        countEl.textContent = `${newLikes} likes`;

        // Update local object state
        post.likes = newLikes;
        post.liked_by = newLikedBy;

        // --- Persistent Storage Update ---
        try {
            await Storage.updatePost(post.id, {
                likes: newLikes,
                liked_by: newLikedBy
            });
        } catch (err) {
            console.error('Like error:', err);
            this.showToast('Could not sync like to cloud.');
            // Note: We don't revert here to keep the "Flash Fast" feel, 
            // the next background sync will fix it if the server failed.
        }
    },

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    async compressImage(base64Str, maxWidth = 200, maxHeight = 200) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); // 0.7 quality saves massive space!
            };
        });
    }
};
