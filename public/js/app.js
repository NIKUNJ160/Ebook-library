// Client-side interactions for LibraryHub matching natomanga mechanics

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Nav Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const primaryNav = document.getElementById('primary-nav');
  if (mobileMenuBtn && primaryNav) {
    mobileMenuBtn.addEventListener('click', () => {
      primaryNav.classList.toggle('active');
    });
  }

  // Dark/Light Mode Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const body = document.body;
      const isDark = body.classList.contains('dark');
      if (isDark) {
        body.classList.remove('dark');
        body.classList.add('light');
        localStorage.setItem('themeMode', 'light');
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
      } else {
        body.classList.remove('light');
        body.classList.add('dark');
        localStorage.setItem('themeMode', 'dark');
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
      }
    });

    // Update icon on page load based on active class
    const initialDark = document.body.classList.contains('dark');
    themeToggle.innerHTML = initialDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }

  // Carousel Mechanics
  const track = document.getElementById('carousel-track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  if (track && prevBtn && nextBtn) {
    let index = 0;
    const getVisibleSlides = () => {
      const width = window.innerWidth;
      if (width <= 480) return 1;
      if (width <= 768) return 2;
      if (width <= 992) return 3;
      return 4; // default
    };

    const getSlideWidth = () => {
      const slide = track.querySelector('.carousel-slide-item');
      return slide ? slide.offsetWidth : 0;
    };

    const updateCarousel = () => {
      const maxIndex = track.children.length - getVisibleSlides();
      if (index < 0) index = 0;
      if (index > maxIndex) index = maxIndex;
      const offset = index * getSlideWidth();
      track.style.transform = `translateX(-${offset}px)`;
    };

    prevBtn.addEventListener('click', () => {
      index--;
      updateCarousel();
    });

    nextBtn.addEventListener('click', () => {
      index++;
      updateCarousel();
    });

    window.addEventListener('resize', updateCarousel);
    // Initial update
    setTimeout(updateCarousel, 200);
  }

  // Search Autocomplete Suggestion Logic
  const searchInput = document.getElementById('search_story');
  const autocompleteBox = document.getElementById('search-autocomplete');
  if (searchInput && autocompleteBox) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = searchInput.value.trim();
      if (query.length < 2) {
        autocompleteBox.style.display = 'none';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const items = await res.json();
          if (items.length === 0) {
            autocompleteBox.style.display = 'none';
            return;
          }

          autocompleteBox.innerHTML = '';
          items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.style.cursor = 'pointer';
            div.innerHTML = `
              <img src="${item.cover_url}" class="autocomplete-thumb">
              <div class="autocomplete-details">
                <h4>${item.title}</h4>
                <span>Type: ${item.type.toUpperCase()}</span>
              </div>
            `;
            div.addEventListener('click', () => {
              window.location.href = `/item/${item.slug}`;
            });
            autocompleteBox.appendChild(div);
          });
          autocompleteBox.style.display = 'block';
        } catch (e) {
          console.error(e);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !autocompleteBox.contains(e.target)) {
        autocompleteBox.style.display = 'none';
      }
    });
  }

  // Bookmark Feature Implementation
  const bookmarkBtn = document.getElementById('btn-bookmark');
  if (bookmarkBtn) {
    const slug = bookmarkBtn.getAttribute('data-slug');
    const title = bookmarkBtn.getAttribute('data-title');
    const cover = bookmarkBtn.getAttribute('data-cover');

    let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const isBookmarked = bookmarks.some(b => b.slug === slug);
    if (isBookmarked) {
      bookmarkBtn.classList.add('bookmarked');
      bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Bookmarked';
    }

    bookmarkBtn.addEventListener('click', () => {
      bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      const index = bookmarks.findIndex(b => b.slug === slug);
      if (index > -1) {
        // Remove bookmark
        bookmarks.splice(index, 1);
        bookmarkBtn.classList.remove('bookmarked');
        bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Bookmark Item';
      } else {
        // Add bookmark
        bookmarks.push({ slug, title, cover, time: new Date().toISOString() });
        bookmarkBtn.classList.add('bookmarked');
        bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Bookmarked';
      }
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    });
  }

  // History Page Render Logic
  const historyContainer = document.getElementById('history-page-list');
  if (historyContainer) {
    const historyData = JSON.parse(localStorage.getItem('readingHistory') || '[]');
    if (historyData.length === 0) {
      historyContainer.innerHTML = '<p class="no-results-msg">No viewing history recorded yet. Open a gallery or PDF to start tracking history!</p>';
    } else {
      historyContainer.innerHTML = '';
      historyData.forEach(item => {
        const dateStr = new Date(item.time).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const div = document.createElement('div');
        div.className = 'history-row-item';
        div.innerHTML = `
          <img src="${item.cover}" class="history-row-cover">
          <div class="history-row-meta">
            <h4><a href="/item/${item.slug}">${item.title}</a></h4>
            <p>Last read Page ${item.lastPage} of ${item.totalPages}</p>
            <p><i class="fa fa-clock"></i> ${dateStr}</p>
          </div>
          <a href="/item/${item.slug}/view/${item.lastPage}" class="btn-resume-history">Resume</a>
          <button class="btn-delete-history" data-slug="${item.slug}"><i class="fa fa-trash-can"></i></button>
        `;
        
        // Setup delete handler
        div.querySelector('.btn-delete-history').addEventListener('click', (e) => {
          const s = e.currentTarget.getAttribute('data-slug');
          let updated = JSON.parse(localStorage.getItem('readingHistory') || '[]');
          updated = updated.filter(h => h.slug !== s);
          localStorage.setItem('readingHistory', JSON.stringify(updated));
          div.remove();
          if (updated.length === 0) {
            historyContainer.innerHTML = '<p class="no-results-msg">No viewing history recorded yet.</p>';
          }
        });

        historyContainer.appendChild(div);
      });
    }
  }
});
