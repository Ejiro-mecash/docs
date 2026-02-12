(function () {
    // Check if the popup has already been shown in this session
    // if (sessionStorage.getItem('loveInMotionShown')) {
    //     return;
    // }

    // Mark as shown immediately
    // sessionStorage.setItem('loveInMotionShown', 'true');

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(5px)';

    // Create the container
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.maxWidth = '90%';
    container.style.maxHeight = '90%';
    container.style.borderRadius = '12px';
    container.style.overflow = 'hidden';
    container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

    // Create the image
    const img = document.createElement('img');
    img.src = 'public/images/love-in-motion.png'; // Assuming mapping from public root
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '80vh';
    img.style.objectFit = 'contain';

    // Create the close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '10px';
    closeBtn.style.background = 'rgba(255, 255, 255, 0.8)';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '30px';
    closeBtn.style.height = '30px';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.color = '#333';
    closeBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    // Close function
    function closePopup() {
        document.body.removeChild(overlay);
    }

    closeBtn.onclick = closePopup;
    overlay.onclick = function (e) {
        if (e.target === overlay) {
            closePopup();
        }
    };

    // Assemble
    container.appendChild(img);
    container.appendChild(closeBtn);
    overlay.appendChild(container);

    // Add to body when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    } else {
        document.body.appendChild(overlay);
    }
})();
