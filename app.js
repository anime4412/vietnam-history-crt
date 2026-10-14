/**
 * BẢO TÀNG LỊCH SỬ QUỐC GIA VIỆT NAM (VNMH)
 * High-End Visual Choreography & Interaction
 */

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initMobileOverlay();
  initChronologyFilter();
  initTicketCalculator();
  initMouseSpotlight();
});

/* ==========================================================================
   1. SCROLL ENTRY CHOREOGRAPHY (IntersectionObserver - Zero Continuous Reflows)
   ========================================================================== */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.scroll-reveal');

  if (!('IntersectionObserver' in window)) {
    // Fallback if browser doesn't support IntersectionObserver
    revealElements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target); // Animate once
      }
    });
  }, {
    root: null,
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach((el, index) => {
    // Add subtle cascade delay for siblings
    el.style.transitionDelay = `${(index % 4) * 65}ms`;
    observer.observe(el);
  });
}

/* ==========================================================================
   2. MOBILE FULLSCREEN GLASS OVERLAY & HAMBURGER MORPH
   ========================================================================== */
function initMobileOverlay() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const overlay = document.getElementById('mobileOverlay');
  const links = overlay ? overlay.querySelectorAll('.mobile-nav-link') : [];

  if (!menuBtn || !overlay) return;

  function toggleMenu() {
    const isActive = overlay.classList.toggle('active');
    menuBtn.setAttribute('aria-expanded', isActive);

    const barTop = menuBtn.querySelector('.bar-top');
    const barBottom = menuBtn.querySelector('.bar-bottom');

    if (isActive) {
      if (barTop) barTop.style.transform = 'translateY(3.75px) rotate(45deg)';
      if (barBottom) barBottom.style.transform = 'translateY(-3.75px) rotate(-45deg)';
      document.body.style.overflow = 'hidden';
    } else {
      if (barTop) barTop.style.transform = 'none';
      if (barBottom) barBottom.style.transform = 'none';
      document.body.style.overflow = '';
    }
  }

  menuBtn.addEventListener('click', toggleMenu);

  links.forEach(link => {
    link.addEventListener('click', () => {
      toggleMenu();
    });
  });
}

/* ==========================================================================
   3. CHRONOLOGY FILTER (Fluid Period Pills)
   ========================================================================== */
function initChronologyFilter() {
  const pills = document.querySelectorAll('.filter-pill');
  const cards = document.querySelectorAll('.timeline-entry');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });

      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');

      const selectedEra = pill.getAttribute('data-era');

      cards.forEach(card => {
        const cardEra = card.getAttribute('data-era-group');
        if (selectedEra === 'all' || selectedEra === cardEra) {
          card.style.display = 'block';
          card.style.opacity = '0';
          card.style.transform = 'translateY(16px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 30);
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   4. TICKET RESERVATION & DYNAMIC TOTAL CALCULATOR
   ========================================================================== */
function initTicketCalculator() {
  const form = document.getElementById('ticketForm');
  const campusSelect = document.getElementById('campusSelect');
  const adultQtyInput = document.getElementById('adultQty');
  const studentQtyInput = document.getElementById('studentQty');
  const bookingDateInput = document.getElementById('bookingDate');
  const totalDisplay = document.getElementById('totalPriceOutput');

  // Set minimum date to tomorrow
  if (bookingDateInput) {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const tomorrowStr = today.toISOString().split('T')[0];
    bookingDateInput.min = tomorrowStr;
    bookingDateInput.value = tomorrowStr;
  }

  function calculatePrice() {
    if (!adultQtyInput || !studentQtyInput || !totalDisplay) return;

    const adultQty = Math.max(0, parseInt(adultQtyInput.value, 10) || 0);
    const studentQty = Math.max(0, parseInt(studentQtyInput.value, 10) || 0);
    const campus = campusSelect ? campusSelect.value : 'cs1';

    let adultPrice = 40000;
    let studentPrice = 20000;

    // Both campuses combined pass (15% discount)
    if (campus === 'both') {
      adultPrice = 70000;
      studentPrice = 35000;
    }

    const total = (adultQty * adultPrice) + (studentQty * studentPrice);
    totalDisplay.textContent = new Intl.NumberFormat('vi-VN').format(total) + ' VNĐ';
  }

  if (campusSelect) campusSelect.addEventListener('change', calculatePrice);
  if (adultQtyInput) adultQtyInput.addEventListener('input', calculatePrice);
  if (studentQtyInput) studentQtyInput.addEventListener('input', calculatePrice);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('visitorEmail').value;
      const refCode = 'VNMH-' + Math.floor(100000 + Math.random() * 900000);

      showToast(
        'ĐẶT VÉ TRỰC TUYẾN THÀNH CÔNG',
        `Mã vé: ${refCode}. Xác nhận và thẻ QR đã được gửi về email: ${email}`
      );

      form.reset();
      calculatePrice();
    });
  }
}

/* ==========================================================================
   5. LUXURY TOAST NOTIFICATION
   ========================================================================== */
function showToast(title, msg) {
  const toast = document.getElementById('toastBox');
  const titleEl = document.getElementById('toastTitleText');
  const msgEl = document.getElementById('toastMsgText');

  if (!toast || !titleEl || !msgEl) return;

  titleEl.textContent = title;
  msgEl.textContent = msg;

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4500);
}

/* ==========================================================================
   6. SUBTLE MOUSE SPOTLIGHT (Haptic Card Hover)
   ========================================================================== */
function initMouseSpotlight() {
  const cards = document.querySelectorAll('.double-bezel-card, .double-bezel-pedestal');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}
