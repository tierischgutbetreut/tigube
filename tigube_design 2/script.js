// Shared microinteractions for tigube
(function () {
  // Sticky header shadow
  const hdr = document.querySelector('.site-header');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Reveal on scroll — with safe fallbacks so above-the-fold content is never stuck hidden
  const reveals = Array.from(document.querySelectorAll('.reveal'));
  const reveal = (el) => el.classList.add('in');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -10% 0px' });
    reveals.forEach((el) => io.observe(el));

    // Immediately reveal anything already in (or above) the viewport on load
    const showVisible = () => {
      const vh = window.innerHeight || 800;
      reveals.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.95) reveal(el);
      });
    };
    if (document.readyState === 'complete') showVisible();
    else window.addEventListener('load', showVisible);
    // Final safety net — anything still hidden after 1.2s gets revealed
    setTimeout(() => reveals.forEach(reveal), 1200);
  } else {
    reveals.forEach(reveal);
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach((item) => {
    const trigger = item.querySelector('.faq-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      const open = item.hasAttribute('open');
      // Close siblings in same list (single-open behavior)
      item.parentElement?.querySelectorAll('.faq-item[open]').forEach((sib) => {
        if (sib !== item) sib.removeAttribute('open');
      });
      if (open) item.removeAttribute('open');
      else item.setAttribute('open', '');
    });
  });

  // Apply persisted theme on load
  try {
    const t = JSON.parse(localStorage.getItem('tigube-tweaks') || '{}');
    if (t.palette) document.documentElement.setAttribute('data-palette', t.palette);
    if (t.theme)   document.documentElement.setAttribute('data-theme', t.theme);
  } catch (e) {}
})();
