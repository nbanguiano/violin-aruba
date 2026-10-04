(() => {
    document.getElementById('year').textContent = new Date().getFullYear();
    const form = document.getElementById('enquiry-form');
    const result = document.getElementById('enquiry-result');
    const submit = form.querySelector('button[type="submit"]');
    const date = document.getElementById('date');
    const today = new Date();
    date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let pending = false;
    let submission;
    let sent = false;
    form.noValidate = true;
    submit.disabled = false;
    const changed = () => {
        if (pending) return;
        result.hidden = true;
        sent = false;
        submit.disabled = false;
        submit.textContent = 'Send enquiry';
    };
    document.querySelectorAll('[data-occasion]').forEach(link => link.addEventListener('click', () => {
        if (!pending) { form.elements.occasion.value = link.dataset.occasion; changed(); }
    }));
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (pending || sent) return;
        let firstInvalid;
        for (const field of form.querySelectorAll('input, select, textarea')) {
            const error = document.getElementById(`${field.id}-error`);
            if (!error) continue;
            let message = '';
            if (field.required && !field.value.trim()) message = 'Please complete this field.';
            else if (field.validity.typeMismatch) message = 'Please enter a valid email address.';
            else if (field.validity.rangeUnderflow) message = 'Please choose today or a future date.';
            else if (!field.validity.valid) message = 'Please check this field.';
            field.setAttribute('aria-invalid', String(Boolean(message)));
            error.textContent = message;
            error.hidden = !message;
            if (message && !firstInvalid) firstInvalid = field;
        }
        if (firstInvalid) { result.hidden = true; firstInvalid.focus(); return; }
        const fields = Object.fromEntries(new FormData(form));
        for (const key of Object.keys(fields)) fields[key] = fields[key].trim();
        const serialized = JSON.stringify(fields);
        if (!submission || submission.serialized !== serialized) {
            submission = { serialized, requestId: crypto.randomUUID() };
        }
        const message = `Hi Nicola,\n\nI'd love to talk about live violin for my event.\n\nName: ${fields.name}\nEmail: ${fields.email}\nOccasion: ${fields.occasion}\nDate: ${fields.date || 'To be decided'}\nVenue: ${fields.venue || 'To be decided'}\n\n${fields.message}`;
        document.getElementById('message-preview').textContent = message;
        document.getElementById('send-whatsapp').href = `https://api.whatsapp.com/send?phone=2975924798&text=${encodeURIComponent(message)}`;
        document.getElementById('send-email').href = `mailto:nicola@violinaruba.com?subject=${encodeURIComponent('Enquiry for violin performance')}&body=${encodeURIComponent(message)}`;
        pending = true;
        result.hidden = true;
        form.setAttribute('aria-busy', 'true');
        const controls = [...form.querySelectorAll('input, select, textarea, button')];
        controls.forEach(control => { control.disabled = true; });
        submit.textContent = 'Sending…';
        document.getElementById('submission-status').textContent = 'Sending your enquiry…';
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...fields, requestId: submission.requestId }),
                signal: AbortSignal.timeout(20000)
            });
            const outcome = await response.json();
            if (!response.ok || outcome.ok !== true) throw new Error('Submission not confirmed');
            sent = true;
            document.getElementById('result-title').textContent = 'Thank you — your enquiry has been sent.';
            document.getElementById('result-message').textContent = `Your enquiry is on its way to Nicola. Your reply address is ${fields.email}. This is an enquiry, not a confirmed booking.`;
        } catch {
            document.getElementById('result-title').textContent = 'We couldn’t confirm your enquiry was sent.';
            document.getElementById('result-message').textContent = 'Your details are still here. Try again in a few minutes, or open WhatsApp or email below to send your message yourself.';
        } finally {
            pending = false;
            controls.forEach(control => { control.disabled = false; });
            submit.disabled = sent;
            submit.textContent = sent ? 'Enquiry sent' : 'Try sending again';
            form.removeAttribute('aria-busy');
            document.getElementById('submission-status').textContent = '';
            document.getElementById('submission-fallback').hidden = sent;
            result.hidden = false;
            result.focus();
        }
    });
    // A duplicated, decorative group makes the slow logo ribbon seamless.
    const logoRibbon = document.querySelector('.venue-logos');
    if (logoRibbon) {
        const track = logoRibbon.querySelector('.venue-logos__track');
        const group = logoRibbon.querySelector('.venue-logos__group');
        const copy = group.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.inert = true;
        copy.querySelectorAll('img').forEach(image => { image.alt = ''; });
        track.append(copy);
        logoRibbon.classList.add('is-enhanced');
        // A keyboard user can explore the stationary ribbon with native scrolling.
        const viewport = logoRibbon.querySelector('.venue-logos__viewport');
        viewport.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            viewport.scrollBy({ left: event.key === 'ArrowRight' ? 204 : -204 });
        });
        let visible = true;
        const syncMotion = () => logoRibbon.classList.toggle('is-offscreen', !visible || document.hidden);
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            syncMotion();
        }).observe(logoRibbon);
        document.addEventListener('visibilitychange', syncMotion);
    }
    // Keep one copy of each slide; recycle offscreen nodes instead of cloning media.
    document.querySelectorAll('[data-loop-gallery]').forEach(root => {
        const viewport = root.querySelector('.loop-viewport');
        const track = root.querySelector('.loop-track');
        const slides = [...track.children];
        const status = root.querySelector('[data-gallery-status]');
        const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const queue = [];
        const centerSlot = 2;
        let busy = false;
        let gesture = null;
        let wheelTime = 0;
        let suppressClick = false;

        slides.forEach((slide, index) => { slide.dataset.slideIndex = index; });
        // Two preceding slides provide the left-hand preview and animation buffer.
        track.prepend(...slides.slice(-centerSlot));
        const geometry = () => {
            const width = track.children[centerSlot].getBoundingClientRect().width;
            const step = width + (parseFloat(getComputedStyle(track).gap) || 0);
            return { step, base: (viewport.clientWidth - width) / 2 - centerSlot * step };
        };
        const place = offset => { track.style.transform = `translateX(${offset}px)`; };
        const pauseVideos = () => root.querySelectorAll('video').forEach(video => video.pause());
        const render = () => {
            place(geometry().base);
            const current = track.children[centerSlot];
            root.dataset.activeIndex = current.dataset.slideIndex;
            status.textContent = `${Number(current.dataset.slideIndex) + 1} of ${slides.length}`;
            const bounds = viewport.getBoundingClientRect();
            slides.forEach(slide => {
                const rect = slide.getBoundingClientRect();
                const offscreen = rect.right <= bounds.left + 1 || rect.left >= bounds.right - 1;
                slide.inert = offscreen;
                if (slide === current) slide.setAttribute('aria-current', 'true');
                else slide.removeAttribute('aria-current');
            });
        };
        const transition = async (from, to, duration = 320) => {
            if (motionPreference.matches) return;
            const animation = track.animate([
                { transform: `translateX(${from}px)` },
                { transform: `translateX(${to}px)` }
            ], { duration, easing: 'cubic-bezier(.22,.7,.25,1)' });
            await animation.finished.catch(() => {});
        };
        const advance = async () => {
            if (busy || !queue.length) return;
            busy = true;
            root.dataset.moving = 'true';
            const { direction, offset } = queue.shift();
            pauseVideos();
            slides.forEach(slide => { slide.inert = false; });
            const { base, step } = geometry();
            if (direction < 0) {
                track.prepend(track.lastElementChild);
                place(base - step + offset);
                await transition(base - step + offset, base);
            } else {
                place(base + offset);
                await transition(base + offset, base - step);
                track.append(track.firstElementChild);
            }
            render();
            busy = false;
            root.dataset.moving = 'false';
            advance();
        };
        const move = (direction, offset = 0) => {
            queue.push({ direction, offset });
            advance();
        };
        root.querySelector('[data-gallery-prev]').addEventListener('click', () => move(-1));
        root.querySelector('[data-gallery-next]').addEventListener('click', () => move(1));
        viewport.addEventListener('keydown', event => {
            if (event.target !== viewport) return;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                move(event.key === 'ArrowRight' ? 1 : -1);
            }
        });
        viewport.addEventListener('pointerdown', event => {
            if (busy || !event.isPrimary || event.button !== 0 || event.target.closest('button, a')) return;
            gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: 0, horizontal: false, prepared: false };
        });
        viewport.addEventListener('pointermove', event => {
            if (!gesture || gesture.id !== event.pointerId) return;
            const dx = event.clientX - gesture.x;
            const dy = event.clientY - gesture.y;
            if (!gesture.horizontal) {
                if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
                if (Math.abs(dx) < 12) return;
                gesture.horizontal = true;
                viewport.setPointerCapture(event.pointerId);
                viewport.classList.add('is-dragging');
                pauseVideos();
            }
            event.preventDefault();
            const { base, step } = geometry();
            gesture.offset = Math.max(-step * .95, Math.min(step * .95, dx));
            if (dx > 0 && !gesture.prepared) {
                track.prepend(track.lastElementChild);
                gesture.prepared = true;
            } else if (dx <= 0 && gesture.prepared) {
                track.append(track.firstElementChild);
                gesture.prepared = false;
            }
            place(base - (gesture.prepared ? step : 0) + gesture.offset);
        });
        const finishGesture = async event => {
            if (!gesture || gesture.id !== event.pointerId) return;
            const { horizontal, offset, prepared } = gesture;
            if (prepared) track.append(track.firstElementChild);
            gesture = null;
            viewport.classList.remove('is-dragging');
            if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
            if (!horizontal) return;
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            if (event.type !== 'pointercancel' && Math.abs(offset) > 40) move(offset < 0 ? 1 : -1, offset);
            else {
                busy = true;
                const { base } = geometry();
                await transition(base + offset, base, 160);
                render();
                busy = false;
                advance();
            }
        };
        viewport.addEventListener('click', event => {
            if (!suppressClick) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
        viewport.addEventListener('pointerup', finishGesture);
        viewport.addEventListener('pointercancel', finishGesture);
        viewport.addEventListener('wheel', event => {
            if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
            event.preventDefault();
            if (Math.abs(event.deltaX) < 8 || Date.now() - wheelTime < 350) return;
            wheelTime = Date.now();
            move(event.deltaX > 0 ? 1 : -1);
        }, { passive: false });
        new ResizeObserver(() => { if (!busy && !gesture) render(); }).observe(viewport);
        render();
    });

  const galleryVideos = document.querySelectorAll('.instagram-gallery video');
  galleryVideos.forEach(video => {
    const videoNumber = video.id.replace('instagram-video-', '');
    const sound = video.parentElement.querySelector('[data-video-sound]');
    const play = video.parentElement.querySelector('[data-video-play]');
    play.addEventListener('click', () => {
      if (!video.getAttribute('src')) video.src = video.dataset.src;
      video.controls = true;
      video.play().then(() => { play.hidden = true; video.focus({ preventScroll: true }); }).catch(() => {
        play.hidden = false;
        play.textContent = 'Try playing again';
      });
    });
    video.addEventListener('play', () => {
      galleryVideos.forEach(other => { if (other !== video) other.pause(); });
    });
    video.addEventListener('ended', () => { play.hidden = false; });
    video.addEventListener('error', () => {
      play.hidden = false;
      play.textContent = 'Clip unavailable';
      play.disabled = true;
    });
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) video.pause();
    }).observe(video);
    const syncSound = () => {
      sound.dataset.muted = String(video.muted || video.volume === 0);
      sound.setAttribute('aria-label', `${video.muted || video.volume === 0 ? 'Unmute' : 'Mute'} video ${videoNumber}`);
    };
    sound.addEventListener('click', () => {
      const silent = video.muted || video.volume === 0;
      video.muted = !silent;
      if (silent && video.volume === 0) video.volume = 1;
    });
    video.addEventListener('volumechange', syncSound);
    sound.hidden = false;
    syncSound();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) galleryVideos.forEach(video => video.pause()); });

    const hero = document.getElementById('hero-video');
    const motion = document.getElementById('hero-motion');
    const opener = document.getElementById('open-performance');
    const dialog = document.getElementById('performance-dialog');
    const performance = document.getElementById('performance-video');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let backgroundEnabled = !reducedMotion.matches;
    let heroVisible = false;

    const loadVideo = element => {
        if (!element.getAttribute('src')) element.src = element.dataset.src;
    };
    const syncBackground = () => {
        if (backgroundEnabled && heroVisible && !document.hidden && !dialog.open) {
            loadVideo(hero);
            hero.play().catch(() => {});
        } else {
            hero.pause();
        }
    };
    const syncMotionLabel = () => {
        motion.setAttribute('aria-label', hero.paused ? 'Play background' : 'Pause background');
        motion.dataset.paused = String(hero.paused);
    };
    hero.addEventListener('play', syncMotionLabel);
    hero.addEventListener('pause', syncMotionLabel);
    hero.addEventListener('error', () => { motion.hidden = true; });
    motion.addEventListener('click', () => {
        backgroundEnabled = hero.paused;
        syncBackground();
    });
    reducedMotion.addEventListener('change', () => {
        backgroundEnabled = !reducedMotion.matches;
        syncBackground();
    });
    new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
        syncBackground();
    }, { threshold: 0 }).observe(hero);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) performance.pause();
        syncBackground();
    });
    opener.addEventListener('click', () => {
        dialog.showModal();
        hero.pause();
        galleryVideos.forEach(video => video.pause());
        loadVideo(performance);
        performance.currentTime = 0;
        performance.play().catch(() => {});
    });
    document.getElementById('close-performance').addEventListener('click', () => dialog.close());
    // Only a click beginning and ending on the backdrop closes the dialog.
    const outsideDialog = event => {
        const rect = dialog.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    let backdropPress = false;
    dialog.addEventListener('pointerdown', event => { backdropPress = outsideDialog(event); });
    dialog.addEventListener('click', event => {
        if (backdropPress && outsideDialog(event)) dialog.close();
        backdropPress = false;
    });
    dialog.addEventListener('close', () => {
        performance.pause();
        performance.currentTime = 0;
        opener.focus({ preventScroll: true });
        syncBackground();
    });
    performance.addEventListener('error', () => {
        document.getElementById('performance-error').hidden = false;
    });
    motion.hidden = false;
    opener.hidden = false;
    syncMotionLabel();
})();
