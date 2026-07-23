// ========== SHARED JAVASCRIPT ==========

// Navbar scroll effect
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) navbar?.classList.add('scrolled');
  else navbar?.classList.remove('scrolled');
});

// Active nav link
const navLinks = document.querySelectorAll('.nav-links a');
const currentPage = location.pathname.split('/').pop() || 'index.html';
navLinks.forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

// Mobile menu
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
  document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.mobile-menu a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger?.classList.remove('open');
    mobileMenu?.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Scroll animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// Toast notification
function showToast(icon, message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// Counter animation
function animateCounter(el, target, suffix = '') {
  let start = 0;
  const duration = 2000;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const val = Math.floor(progress * target);
    el.textContent = val.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Animate counters when visible
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const target = parseInt(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, suffix);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-target]').forEach(el => counterObserver.observe(el));

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const filter = this.dataset.filter;
    document.querySelectorAll('.course-card, .lang-card').forEach(card => {
      if (filter === 'all' || !filter) {
        card.style.display = '';
      } else {
        card.style.display = card.dataset.lang === filter || card.dataset.level === filter ? '' : 'none';
      }
    });
  });
});

// Lesson items click
document.querySelectorAll('.unit-lesson-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.unit-lesson-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
    showToast('▶️', 'Loading: ' + this.querySelector('.lesson-item-title')?.textContent);
  });
});

// Contact form
const contactForm = document.getElementById('contactForm');
contactForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  showToast('✅', 'Message sent! We\'ll reply within 24 hours.');
  contactForm.reset();
});

// Enrollment button
document.querySelectorAll('[data-enroll]').forEach(btn => {
  btn.addEventListener('click', () => showToast('🎉', 'Enrolled! Check your dashboard.'));
});

// Play button
document.querySelector('.play-btn')?.addEventListener('click', () => {
  showToast('▶️', 'Video player would open here!');
});
